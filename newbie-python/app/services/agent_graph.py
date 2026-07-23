"""
LangGraph Conversational Search Agent
======================================
This module implements a stateful, multi-turn conversational agent using LangGraph.
The agent helps Product Owners find suitable Software Agencies by:

  1. Extracting intent from conversation history (extractor_node)
  2. Deciding whether it has enough info to search (router / conditional edge)
  3. Asking a clarifying question if info is incomplete (ask_human_node)
  4. Searching Qdrant (vector) + MongoDB (metadata) if info is sufficient (search_db_node)
  5. Generating a natural-language summary of results (generator_node)

Graph topology:
  START → extractor_node → [router] → ask_human_node → END
                                    ↘ search_db_node  → generator_node → END
"""

from app.services.tools_agent import get_lunar_date
from langgraph.graph import add_messages
from typing import Annotated
from app.schemas.ai_search import SearchNextGraph
from app.constants.prompts import SUPERVISOR_SEARCH_NODE_PROMPT,AGENCY_EXTRACTION_PROMPT, CONSULTANT_NODE_PROMPT
from pymongo import MongoClient
import json
import logging
from typing import Any, Literal, Optional
from typing_extensions import TypedDict

from pydantic import SecretStr
from langchain_core.runnables import RunnableConfig

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, BaseMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END, START
from langchain.agents import create_agent

from app.config import settings
from app.schemas.ai_search import SearchFilters
from app.utils.common.normalize import normalize_tech_list
from app.utils.common.helpper import build_numeric_range_filter
from qdrant_client import models
from langgraph.checkpoint.mongodb import MongoDBSaver
import httpx
from app.services.tools_agent import tavily_tools

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 1.  GRAPH STATE
# ---------------------------------------------------------------------------

class NumericFilter(TypedDict):
    """Represents a numeric comparison filter (e.g. budget >= 5000)."""
    operator: str   # One of: <, <=, >=, >, =, between
    value: Any      # int | float | list[int | float]  (list used with "between")


class AgentState(TypedDict):
    """
    The shared state object that flows through every node in the graph.

    Fields updated by extractor_node:
      - is_sufficient      : True when the LLM has enough info to run a search.
      - confidence         : LLM confidence score [0.0, 1.0]. Enables soft-threshold
                             routing: a high-confidence partial match can bypass the
                             clarification branch even if some fields are missing.
      - budget             : Numeric filter for agency budget.
      - team_size          : Numeric filter for team headcount.
      - domain             : List of business/project domains (e.g. "fintech").
      - tech_stack         : List of requested technologies (e.g. "React Native").
      - semantic_query     : Rewritten query fed to the Qdrant vector search.
      - missing_fields     : Names of fields still needed from the user.
      - follow_up_question : Pre-generated clarification question from the extractor.
                             Reused directly by ask_human_node — avoids a second LLM call.

    Fields updated by search_db_node:
      - results            : Raw list of matching agency dicts from DB.

    Shared across all nodes:
      - messages           : Full conversation history (LangChain BaseMessage list).
    """
    messages: Annotated[
        list[BaseMessage],
        add_messages
    ]
    is_sufficient: bool
    confidence: float
    budget: Optional[NumericFilter]
    team_size: Optional[NumericFilter]
    domain: list[str]
    tech_stack: list[str]
    semantic_query: str
    missing_fields: list[str]
    follow_up_question: Optional[str]
    status: Optional[str]
    results: list[dict]

class SupervisorState(TypedDict):
    messages: Annotated[
        list[BaseMessage],
        add_messages
    ]
    next_agent: Literal["consultant", "search_agent", "FINISH"]
    status: Optional[str]
    results: list[dict]



# ---------------------------------------------------------------------------
# 2.  LLM CLIENT  (shared, instantiated once at module load)
# ---------------------------------------------------------------------------

# On corporate networks, a TLS-intercepting proxy causes OpenAI SDK to raise
# "Connection error." — bypass SSL verification for local dev.
# NOTE: Do NOT share a single httpx.AsyncClient across multiple ChatOpenAI
# instances — the SDK may close the underlying transport after use, causing
# subsequent requests to fail with APIConnectionError. Instead, use a factory.
import os
import ssl
import certifi

# Custom corporate TLS proxy certificate located in the project root.
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SSL_CERT_PATH = os.path.join(BASE_DIR, "lgcns.pem")

# Auto-detect corporate network. If the cert exists, we MUST load BOTH the 
# standard Internet CAs (from certifi) AND the proxy custom cert.
if os.path.exists(SSL_CERT_PATH):
    VERIFY_SSL = ssl.create_default_context(cafile=certifi.where())
    VERIFY_SSL.load_verify_locations(cafile=SSL_CERT_PATH)
else:
    VERIFY_SSL = True


def _make_http_client() -> httpx.AsyncClient:
    """Return a new httpx.AsyncClient configured for the current environment.

    Key settings:
    - verify: Auto-switches between corporate CA bundle and standard TLS verification.
    - limits: generous pool size; keepalive_expiry=30 keeps connections open
      so the SDK never hits a "connection closed" error between back-to-back requests.
    - timeout: 60 s overall, 30 s connect — enough for cold-start GPT calls.
    """
    return httpx.AsyncClient(
        verify=VERIFY_SSL,

        timeout=httpx.Timeout(60.0, connect=30.0),
        limits=httpx.Limits(
            max_connections=20,
            max_keepalive_connections=10,
            keepalive_expiry=30,   # seconds; None = keep forever
        ),
    )


# Shared client used by the web_search tool (Tavily calls).
# This client lives outside the OpenAI SDK so its lifecycle is managed here.
_async_http_client = _make_http_client()


# Primary LLM used for conversation nodes.
# Each ChatOpenAI instance gets its OWN dedicated httpx.AsyncClient so the
# OpenAI SDK cannot close the transport used by other nodes.
# Do NOT pass `streaming=True` in the constructor — it is deprecated in
# langchain-openai >= 0.1.x.  Streaming is activated per-call via .astream().
_llm_agent = ChatOpenAI(
    model=settings.AI_MODEL or "gpt-4o-mini",
    api_key=SecretStr(settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None,
    temperature=0,
    http_async_client=_make_http_client(),
)


# Dedicated structured-output chain for the extractor node.
# `.with_structured_output()` wraps the model and forces JSON conforming to
# the SearchFilters Pydantic schema on every call.
_llm_structured = _llm_agent.with_structured_output(
    SearchFilters
)

# Dedicated structured-output chain for the supervisor node.
_llm_agent_structured = _llm_agent.with_structured_output(
    SearchNextGraph
)

consultant_agent = create_agent(
    _llm_agent,
    tools=[get_lunar_date, tavily_tools],
    system_prompt=CONSULTANT_NODE_PROMPT
)

# ---------------------------------------------------------------------------
# 3.  REAL DB SEARCH HELPER
# ---------------------------------------------------------------------------

def _build_qdrant_filter(
    state: "AgentState",
) -> models.Filter | None:
    """
    Build Qdrant filter from extracted state — same logic as
    AiSearchService.search_agencies but reusable for the agent graph.
    """
    must_conditions: list[models.FieldCondition] = []
    should_conditions: list[models.FieldCondition] = []

    # Budget filter (hard constraint)
    budget = state.get("budget")
    if budget:
        from app.schemas.ai_search import NumbericFilter
        must_conditions.append(
            build_numeric_range_filter(
                field_name="budget",
                numeric_filter=NumbericFilter(operator=budget["operator"], value=budget["value"]),
            )
        )

    # Team size filter (hard constraint)
    team_size = state.get("team_size")
    if team_size:
        from app.schemas.ai_search import NumbericFilter
        must_conditions.append(
            build_numeric_range_filter(
                field_name="team_size",
                numeric_filter=NumbericFilter(operator=team_size["operator"], value=team_size["value"]),
            )
        )

    # Domain filter (soft constraint)
    domain = state.get("domain", [])
    if domain:
        should_conditions.append(
            models.FieldCondition(
                key="domain",
                match=models.MatchAny(any=domain),
            )
        )

    # Tech stack filter (soft constraint + normalize)
    tech_stack = state.get("tech_stack", [])
    if tech_stack:
        normalized_tech = normalize_tech_list(tech_stack)
        should_conditions.append(
            models.FieldCondition(
                key="tech_stack",
                match=models.MatchAny(any=normalized_tech),
            )
        )

    if not must_conditions and not should_conditions:
        return None

    return models.Filter(
        must=must_conditions or None,
        should=should_conditions or None,
    )


# ---------------------------------------------------------------------------
# 4.  NODE IMPLEMENTATIONS
# ---------------------------------------------------------------------------

async def extractor_node(state: AgentState) -> dict:
    """
    Node 1 – Intent Extractor
    --------------------------
    Reads the full conversation history and uses gpt-4o-mini with Pydantic
    Structured Outputs to extract search parameters from the latest user message.

    Returns a partial state update with all extracted filter fields.
    """
    logger.info("[extractor_node] Extracting intent from conversation ...")

    # Build the message list for the LLM:
    #  - System prompt as the very first message
    #  - Full conversation history after that
    messages_for_llm: list[BaseMessage] = [
        SystemMessage(content=AGENCY_EXTRACTION_PROMPT),
        *state["messages"],
    ]

    # `.with_structured_output()` returns `Runnable[..., SearchFilters | dict]`.
    # We cast the result to SearchFilters; if the model fails to parse (returns
    # None or a plain dict), fall back to a safe default that triggers the
    # ask_human branch so the conversation can recover gracefully.
    raw = await _llm_structured.ainvoke(messages_for_llm)

    if not isinstance(raw, SearchFilters):
        logger.warning("[extractor_node] Structured output returned unexpected type %s; using fallback.", type(raw))
        return {
            "is_sufficient": False,
            "budget": None,
            "team_size": None,
            "domain": [],
            "tech_stack": [],
            "semantic_query": "",
            "missing_fields": ["domain", "budget", "team_size", "tech_stack"],
        }

    extracted: SearchFilters = raw

    logger.info(
        "[extractor_node] is_sufficient=%s  missing=%s",
        extracted.is_sufficient,
        extracted.missing_fields,
    )

    # Map the Pydantic model back to plain dicts for the TypedDict state
    budget_dict: Optional[NumericFilter] = None
    if extracted.budget is not None:
        budget_dict = {
            "operator": extracted.budget.operator,
            "value": extracted.budget.value,
        }

    team_size_dict: Optional[NumericFilter] = None
    if extracted.team_size is not None:
        team_size_dict = {
            "operator": extracted.team_size.operator,
            "value": extracted.team_size.value,
        }

    return {
        "is_sufficient": extracted.is_sufficient,
        "confidence": extracted.confidence,
        "budget": budget_dict,
        "team_size": team_size_dict,
        "domain": extracted.domain,
        "tech_stack": extracted.tech_stack,
        "semantic_query": extracted.semantic_query,
        "missing_fields": extracted.missing_fields,
        # Reuse the LLM-generated question in ask_human_node — no second LLM call needed.
        "follow_up_question": extracted.follow_up_question,
        "status": "Extracted search parameters"
    }


# Create superviser_node
async def supervisor_node(state: SupervisorState):
    messages_for_llm: list[BaseMessage] = [
        SystemMessage(content=SUPERVISOR_SEARCH_NODE_PROMPT),
        *state["messages"],
    ]

    try:
        raw = await _llm_agent_structured.ainvoke(messages_for_llm)
        data = raw.next_agent if isinstance(raw, SearchNextGraph) else "FINISH"
    except Exception as e:
        import traceback
        logger.error(f"[supervisor_node] Routing failed, defaulting to FINISH: {e}")
        logger.error(f"[supervisor_node] Full traceback:\n{traceback.format_exc()}")
        logger.error(f"[supervisor_node] Exception type: {type(e).__name__}")
        logger.error(f"[supervisor_node] _http_client verify setting: {_async_http_client}")
        data = "FINISH"

    return {
        "next_agent": data,
        "status": f"Routing to {data}"
    }


async def consultant_node(state: SupervisorState):
    """
    Acts as a software development consultant with web search capability.
    Provides advice, architectures, estimations, etc.
    """
    logger.info("[consultant_node] Invoking React sub-agent for consultation ...")
    logger.info("[consultant_node] Last user message: %s", state["messages"][-1].content if state["messages"] else "(empty)")
    
    # We invoke the sub-agent with the conversation history.
    # create_react_agent handles the state_modifier (SystemMessage) automatically.
    result = await consultant_agent.ainvoke({"messages": state["messages"]})
    
    # Log the full message chain to see if the tool was actually called
    for i, msg in enumerate(result["messages"]):
        logger.info("[consultant_node] result.messages[%d] type=%s content=%s",
                    i, type(msg).__name__, str(msg.content)[:200])

    # The sub-agent returns the full messages array, which might include internal ToolMessages.
    # We only extract the final AIMessage to append back to the main graph's state
    # to keep the master history clean without exposing internal search traces to the user.
    final_message = result["messages"][-1]

    # Return ONLY the new message — LangGraph's add_messages reducer merges it
    # into the existing state automatically. Returning the full list would cause
    # duplicates because add_messages appends on top of what's already stored.
    return {
        "messages": [final_message],
        "status": "Consultation complete"
    }

# Confidence threshold below which we always ask for clarification,
# even when is_sufficient is technically False.
# 0.75 = at least domain + budget/tech_stack are present; team_size alone missing is OK.
_CONFIDENCE_SOFT_THRESHOLD = 0.75

def router(state: AgentState) -> Literal["ask_human_node", "search_db_node"]:
    """
    Conditional Edge – Router
    --------------------------
    Combines two signals from extractor_node:

    1. is_sufficient (hard rule): all four fields provided → always search.
    2. confidence (soft rule): LLM confidence >= 0.75 even with partial info
       → proceed to search rather than frustrate the user with an extra question.
       Example: domain + budget + tech_stack present, team_size missing →
                confidence 0.8 → route to search_db_node anyway.

    Only when both flags are False do we ask the user for more info.
    """
    if state["is_sufficient"]:
        logger.info("[router] Sufficient info -> routing to search_db_node")
        return "search_db_node"

    confidence = state.get("confidence", 0.0)
    if confidence >= _CONFIDENCE_SOFT_THRESHOLD:
        logger.info(
            "[router] Partial info but high confidence (%.2f >= %.2f) -> routing to search_db_node",
            confidence, _CONFIDENCE_SOFT_THRESHOLD,
        )
        return "search_db_node"

    logger.info("[router] Insufficient info (confidence=%.2f) -> routing to ask_human_node", confidence)
    return "ask_human_node"


async def ask_human_node(state: AgentState) -> dict:
    """
    Node 3 – Clarification Question
    ---------------------------------
    Reuses the `follow_up_question` already generated by extractor_node
    (stored in state) — no second LLM call needed.

    Falls back to a generic prompt-based generation only if the field is
    missing (e.g. extractor fallback path).
    """
    missing = state.get("missing_fields", [])
    follow_up_text = state.get("follow_up_question") or ""

    if follow_up_text:
        # Fast path: reuse pre-generated question from extractor_node
        logger.info("[ask_human_node] Reusing pre-generated question: %s", follow_up_text)
    else:
        # Slow path (fallback): extractor didn't produce a question — generate one now
        logger.info("[ask_human_node] No pre-generated question; generating for missing fields: %s", missing)
        missing_str = ", ".join(missing) if missing else "more details"
        clarification_prompt = (
            f"You are a helpful assistant for a software agency search platform. "
            f"The user has not provided enough information to search yet. "
            f"The following fields are missing or unclear: {missing_str}. "
            f"Ask ONE short, friendly question in the same language as the user's last message "
            f"to collect the missing information. Do not list the fields by name; "
            f"incorporate them naturally into a single question."
        )
        messages_for_llm: list[BaseMessage] = [
            SystemMessage(content=clarification_prompt),
            *state["messages"],
        ]
        response = await _llm_agent.ainvoke(messages_for_llm)
        raw_content = response.content
        follow_up_text = (
            raw_content
            if isinstance(raw_content, str)
            else " ".join(
                part if isinstance(part, str) else str(part)
                for part in raw_content
            )
        )
        logger.info("[ask_human_node] Generated follow-up: %s", follow_up_text)

    # Return ONLY the new AIMessage — add_messages reducer handles merging.
    return {
        "messages": [AIMessage(content=follow_up_text)],
        "status": "Asked for clarification"
    }


async def search_db_node(state: AgentState, config: RunnableConfig) -> dict:
    """
    Node 4 – Database Search (Real Qdrant)
    ----------------------------------------
    Uses real QdrantService and OpenAIService passed via config["configurable"]
    to perform vector search with extracted filters.
    """
    logger.info("[search_db_node] Running Qdrant search ...")

    # Get services from config (passed from API layer)
    configurable = config.get("configurable", {})
    qdrant_service = configurable.get("qdrant_service")
    openai_service = configurable.get("openai_service")
    profile_service = configurable.get("profile_service")

    if not qdrant_service or not openai_service or not profile_service:
        logger.error("[search_db_node] Missing qdrant_service, openai_service or profile_service in config!")
        return {"results": []}

    # 1. Get embedding for semantic query
    semantic_query = state.get("semantic_query", "")
    query_vector = await openai_service.get_embedding(semantic_query)

    # 2. Build Qdrant filter from extracted state
    query_filter = _build_qdrant_filter(state)

    logger.info("[search_db_node] Filter: %s", query_filter)

    # 3. Search Qdrant
    results = await qdrant_service.search(
        query_vector=query_vector,
        limit=5,
        filter_=query_filter,
    )

    # 4. Extract MongoDB IDs and scores from Qdrant results
    point_ids: list[str] = []
    score_map: dict[str, float] = {}

    for point in results:
        payload = point.payload or {}
        mongo_id = payload.get("id")
        if mongo_id:
            point_ids.append(mongo_id)
            score_map[mongo_id] = point.score

    logger.info("[search_db_node] Qdrant matched %d points with MongoDB IDs", len(point_ids))

    # 5. Hydrate with real-time data from MongoDB
    profiles = await profile_service.get_profiles_by_ids(point_ids)
    logger.info("[search_db_node] MongoDB returned %d profiles", len(profiles))

    # 6. Format results — merge live MongoDB data with Qdrant score
    formatted: list[dict] = []
    for profile in profiles:
        pid = str(profile.id)
        user_name = "Unknown Agency"
        if hasattr(profile, "user") and profile.user:
            user_name = getattr(profile.user, "full_name", user_name)

        formatted.append({
            "id": pid,
            "score": score_map.get(pid, 0.0),
            "name": user_name,
            "budget": profile.budget,
            "team_size": profile.team_size,
            "domain": profile.domain,
            "tech_stack": profile.tech_stack,
            "description": profile.bio or "",
            "avatar": profile.avatar,
        })

    # Sort by Qdrant relevance score descending
    formatted.sort(key=lambda x: x["score"], reverse=True)

    logger.info("[search_db_node] Returning %d hydrated results", len(formatted))
    return {
        "results": formatted,
        "status": f"Found {len(formatted)} agencies"
    }


async def generator_node(state: AgentState) -> dict:
    """
    Node 5 – Response Generator
    ----------------------------
    Takes the merged search results and uses gpt-4o-mini to produce a
    natural-language summary for the user. The model streams its response
    token-by-token; we collect the full text and append it as an AIMessage.

    Note: To expose true streaming to the frontend, call
    `graph.astream_events(...)` from the API layer and filter for
    `on_chat_model_stream` events instead of collecting here.
    """
    results = state.get("results", [])
    logger.info("[generator_node] Generating response for %d results ...", len(results))

    # Strip unnecessary fields (like avatar URLs) to prevent the LLM from trying to render massive markdown images
    llm_context_results = [
        {k: v for k, v in r.items() if k not in ["avatar"]}
        for r in results
    ]
    results_json = json.dumps(llm_context_results, ensure_ascii=False, indent=2)

    system_prompt = (
        "You are a helpful assistant for a software agency search platform. "
        "Given the following list of matching agencies (in JSON), write a clear, "
        "concise, and friendly response summarising ALL the agencies provided in the list. "
        "Do not omit any agency from your summary. Highlight each agency's name, budget, team size, domain, and tech stack. "
        "Do NOT include any images, avatars, or markdown picture syntax in your response. "
        "If the list is empty, politely inform the user and suggest broadening the search. "
        "Reply in the same language as the user's last message.\n\n"
        f"Matching agencies:\n{results_json}"
    )

    messages_for_llm: list[BaseMessage] = [
        SystemMessage(content=system_prompt),
        *state["messages"],
    ]

    # Collect all streamed chunks into a single string.
    # Each chunk's `.content` can be `str | list` — extract the string part only.
    full_response = ""
    async for chunk in _llm_agent.astream(messages_for_llm):
        chunk_content = getattr(chunk, "content", "")
        if isinstance(chunk_content, str):
            full_response += chunk_content
        elif isinstance(chunk_content, list):
            # Multi-part content block (e.g. tool-call or vision response)
            full_response += "".join(
                part if isinstance(part, str) else ""
                for part in chunk_content
            )

    logger.info("[generator_node] Response generated (%d chars)", len(full_response))
    # Custom metadata include search data
    final_ai_msg = AIMessage(
        content=full_response,
        response_metadata={"agencies": state.get("results", [])}
    )

    # Return ONLY the new AIMessage — add_messages reducer handles merging.
    return {
        "messages": [final_ai_msg],
        "results": results,      # keep results in state for the API layer to access
        "status": "Generated final summary"
    }




# ---------------------------------------------------------------------------
# 5.  GRAPH ASSEMBLY & COMPILATION
# ---------------------------------------------------------------------------

def build_search_subgraph():
    """
    Assembles and compiles the LangGraph StateGraph.

    Graph structure:
        START
          |
          v
      extractor_node          <- always runs first
          |
          v  (conditional edge via router())
       [router]
        /       \\
       v          v
    ask_human   search_db_node
       |              |
       v              v
      END         generator_node
                       |
                       v
                      END

    Returns the compiled graph (a LangGraph CompiledStateGraph).
    """



    # -- Step 1: Create the StateGraph, declaring AgentState as the schema --
    # pyrefly: ignore [bad-specialization]
    graph_builder = StateGraph(AgentState)

    # -- Step 2: Register all nodes ------------------------------------------
    graph_builder.add_node("extractor_node", extractor_node)
    graph_builder.add_node("ask_human_node", ask_human_node)
    graph_builder.add_node("search_db_node", search_db_node)
    graph_builder.add_node("generator_node", generator_node)

    # -- Step 3: Define edges (linear flow) -----------------------------------

    # The graph always starts at extractor_node
    graph_builder.add_edge(START, "extractor_node")

    # After extraction, the router decides the next step.
    # add_conditional_edges(source, path_fn, mapping)
    #   - source     : the node that just finished
    #   - path_fn    : a function that returns a string key
    #   - mapping    : dict mapping string keys -> node names (or END)
    graph_builder.add_conditional_edges(
        "extractor_node",
        router,
        {
            "ask_human_node": "ask_human_node",
            "search_db_node": "search_db_node",
        },
    )

    # After asking the human -> end the turn (wait for user's next reply)
    graph_builder.add_edge("ask_human_node", END)

    # After searching the DB -> generate a response
    graph_builder.add_edge("search_db_node", "generator_node")

    # After generating the response -> end the turn
    graph_builder.add_edge("generator_node", END)

    # -- Step 4: Compile the graph -------------------------------------------
    # compile() validates the graph structure and returns a runnable object.
    compiled_graph = graph_builder.compile()
    logger.info("[build_search_subgraph] Graph compiled successfully.")
    return compiled_graph


# Singleton compiled subgraph
search_agent = build_search_subgraph()

def build_root_graph():
    """
    Assembles the multi-agent supervisor graph.
    """
    db_client = MongoClient(settings.MONGODB_URL)
    checkpointer = MongoDBSaver(client=db_client, db_name=settings.MONGODB_DB)

    # pyrefly: ignore [bad-specialization]
    root_graph_builder = StateGraph(SupervisorState)
    root_graph_builder.add_node("supervisor_node", supervisor_node)
    
    # Add our worker nodes
    root_graph_builder.add_node("consultant", consultant_node)
    root_graph_builder.add_node("search_agent", search_agent)

    # Route at start to the supervisor
    root_graph_builder.add_edge(START, "supervisor_node")

    # The supervisor decides where to go next based on its LLM output
    root_graph_builder.add_conditional_edges(
        "supervisor_node",
        lambda state: state.get("next_agent", "FINISH"),
        {
            "consultant": "consultant",
            "search_agent": "search_agent",
            "FINISH": END,
        },
    )

    # After a worker finishes its task, the agent completes the turn to yield to the user.
    root_graph_builder.add_edge("consultant", END)
    root_graph_builder.add_edge("search_agent", END)

    return root_graph_builder.compile(checkpointer=checkpointer)

# Singleton compiled graph — import this instance from the API layer
root_agent = build_root_graph()


# ---------------------------------------------------------------------------
# 6.  PUBLIC HELPER — invoke the agent for a new user message
# ---------------------------------------------------------------------------

async def run_agent_turn(
    user_message: str,
    thread_id: str,
) -> dict:
    """
    Convenience wrapper to invoke the compiled graph for one conversational turn.

    Args:
        user_message : The latest message from the user.
        history      : Previous conversation messages (LangChain BaseMessage list).
                       Pass an empty list or None for the first turn.

    Returns:
        A dict with:
          - "messages"  : Updated full conversation history.
          - "results"   : List of matched agencies (empty if clarification was needed).
          - "reply"     : The last AI message content (either follow-up Q or summary).
    """

    thread_config = {"configurable": {"thread_id": thread_id}}

    new_input = {
        "messages": [HumanMessage(content=user_message)]
    }

    final_state = await root_agent.ainvoke(new_input, config=thread_config)

    # Extract the last AI message as the "reply" for the API layer.
    # Guard against list-typed `.content` (same issue as in ask_human_node).
    last_ai_message = ""
    for msg in reversed(final_state["messages"]):
        if isinstance(msg, AIMessage):
            last_ai_message = msg.content
            break

    return {
        "results": final_state.get("results", []),
        "reply": last_ai_message,
    }
