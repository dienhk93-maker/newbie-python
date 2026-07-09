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

import asyncio
import json
import logging
from typing import Any, Literal, Optional, cast, TypedDict

from pydantic import SecretStr

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, BaseMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END, START

from app.config import settings
from app.constants.prompts import AGENCY_EXTRACTION_PROMPT
from app.schemas.ai_search import SearchFilters

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
      - is_sufficient   : True when the LLM has enough info to run a search.
      - budget          : Numeric filter for agency budget.
      - team_size       : Numeric filter for team headcount.
      - domain          : List of business/project domains (e.g. "fintech").
      - tech_stack      : List of requested technologies (e.g. "React Native").
      - semantic_query  : Rewritten query fed to the Qdrant vector search.
      - missing_fields  : Names of fields still needed from the user.

    Fields updated by search_db_node:
      - results         : Raw list of matching agency dicts from DB.

    Shared across all nodes:
      - messages        : Full conversation history (LangChain BaseMessage list).
    """
    messages: list[BaseMessage]
    is_sufficient: bool
    budget: Optional[NumericFilter]
    team_size: Optional[NumericFilter]
    domain: list[str]
    tech_stack: list[str]
    semantic_query: str
    missing_fields: list[str]
    results: list[dict]


# ---------------------------------------------------------------------------
# 2.  LLM CLIENT  (shared, instantiated once at module load)
# ---------------------------------------------------------------------------

# ChatOpenAI automatically uses the OPENAI_API_KEY env var if set; we pass it
# explicitly from settings to remain consistent with the rest of the project.
# Primary LLM used for conversation nodes.
# Do NOT pass `streaming=True` in the constructor — it is deprecated in
# langchain-openai >= 0.1.x.  Streaming is activated per-call via .astream().
_llm = ChatOpenAI(
    model=settings.AI_MODEL or "gpt-4o-mini",
    # Wrap in SecretStr: ChatOpenAI's `api_key` param is typed as
    # `SecretStr | Callable | None`, not plain `str`.
    api_key=SecretStr(settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None,
    temperature=0,
)

# Dedicated structured-output chain for the extractor node.
# `.with_structured_output()` wraps the model and forces JSON conforming to
# the SearchFilters Pydantic schema on every call.
_llm_structured = ChatOpenAI(
    model=settings.AI_MODEL or "gpt-4o-mini",
    api_key=SecretStr(settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None,
    temperature=0,
).with_structured_output(SearchFilters)


# ---------------------------------------------------------------------------
# 3.  MOCK DB HELPERS  (replace with real Qdrant / Motor calls later)
# ---------------------------------------------------------------------------

async def _mock_qdrant_search(
    semantic_query: str,
    budget: Optional[NumericFilter],
    team_size: Optional[NumericFilter],
) -> list[dict]:
    """
    Mock Qdrant vector search.

    In production, replace this with:
      - Get embedding for `semantic_query` via OpenAI Embeddings API.
      - Build qdrant_client.models.Filter from budget / team_size conditions.
      - Call AsyncQdrantClient.query_points(collection, vector, filter).
    """
    logger.info("[MOCK Qdrant] Searching with query='%s'", semantic_query)
    await asyncio.sleep(0)  # simulate I/O

    # Static mock dataset matching the seeded data in AiSearchService
    mock_results = [
        {
            "id": "qdrant-mock-001",
            "score": 0.91,
            "source": "qdrant",
            "name": "WebCraft Studio",
            "description": (
                "A team of 15 members specialising in React and Node.js web development. "
                "Typical project budget around 3 000 USD."
            ),
            "budget": 3000,
            "team_size": 15,
            "domain": ["web development"],
            "tech_stack": ["Node.js", "React"],
        },
        {
            "id": "qdrant-mock-002",
            "score": 0.87,
            "source": "qdrant",
            "name": "RealTime Labs",
            "description": (
                "Expert team of 5 focusing on real-time chat apps, messaging, and video calls. "
                "High quality app development, usually around 10 000 USD."
            ),
            "budget": 10000,
            "team_size": 5,
            "domain": ["chat", "real-time"],
            "tech_stack": ["Node.js", "React", "WebRTC"],
        },
        {
            "id": "qdrant-mock-003",
            "score": 0.82,
            "source": "qdrant",
            "name": "CodeOutsource Co.",
            "description": (
                "Large outsourcing company with 50 developers. Handles e-commerce and core systems. "
                "Very affordable, starting from 1 000 USD."
            ),
            "budget": 1000,
            "team_size": 50,
            "domain": ["e-commerce", "outsourcing"],
            "tech_stack": ["Node.js", "Golang"],
        },
    ]

    # Basic in-memory filter to simulate hard filters
    def _passes(agency: dict) -> bool:
        if budget:
            op, val = budget["operator"], budget["value"]
            b = agency["budget"]
            if op == "<=" and not (b <= val): return False
            if op == ">=" and not (b >= val): return False
            if op == "<"  and not (b <  val): return False
            if op == ">"  and not (b >  val): return False
            if op == "="  and not (b == val): return False
            if op == "between" and not (val[0] <= b <= val[1]): return False

        if team_size:
            op, val = team_size["operator"], team_size["value"]
            t = agency["team_size"]
            if op == "<=" and not (t <= val): return False
            if op == ">=" and not (t >= val): return False
            if op == "<"  and not (t <  val): return False
            if op == ">"  and not (t >  val): return False
            if op == "="  and not (t == val): return False
            if op == "between" and not (val[0] <= t <= val[1]): return False

        return True

    return [r for r in mock_results if _passes(r)]


async def _mock_mongodb_search(
    domain: list[str],
    tech_stack: list[str],
) -> list[dict]:
    """
    Mock MongoDB metadata search.

    In production, replace this with a Motor async query, e.g.:
      collection.find({
          "$or": [
              {"domain": {"$in": domain}},
              {"tech_stack": {"$in": tech_stack}},
          ]
      })
    """
    logger.info("[MOCK MongoDB] domain=%s  tech_stack=%s", domain, tech_stack)
    await asyncio.sleep(0)  # simulate I/O

    mongo_results = [
        {
            "id": "mongo-mock-A",
            "source": "mongodb",
            "name": "FinTech Wizards",
            "description": "Boutique fintech agency building payment systems and trading platforms.",
            "domain": ["fintech", "payments"],
            "tech_stack": ["Python", "FastAPI", "React"],
        },
        {
            "id": "mongo-mock-B",
            "source": "mongodb",
            "name": "MobileFirst Agency",
            "description": "Award-winning mobile agency for iOS and Android with React Native.",
            "domain": ["mobile app", "healthcare"],
            "tech_stack": ["React Native", "Flutter"],
        },
    ]

    def _matches(agency: dict) -> bool:
        if domain and any(d in agency["domain"] for d in domain):
            return True
        if tech_stack and any(t in agency["tech_stack"] for t in tech_stack):
            return True
        # Return all records when no domain/tech filter is specified
        return not domain and not tech_stack

    return [r for r in mongo_results if _matches(r)]


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
        "budget": budget_dict,
        "team_size": team_size_dict,
        "domain": extracted.domain,
        "tech_stack": extracted.tech_stack,
        "semantic_query": extracted.semantic_query,
        "missing_fields": extracted.missing_fields,
    }


def router(state: AgentState) -> Literal["ask_human_node", "search_db_node"]:
    """
    Conditional Edge – Router
    --------------------------
    Reads the `is_sufficient` flag set by extractor_node and decides which
    branch to take:
      - False -> ask_human_node  (request more information from the user)
      - True  -> search_db_node  (run the actual DB search)
    """
    # Use direct key access — `is_sufficient` is always initialised in the
    # initial_state dict, so KeyError is not a concern here.
    if state["is_sufficient"]:
        logger.info("[router] Sufficient info -> routing to search_db_node")
        return "search_db_node"

    logger.info("[router] Insufficient info -> routing to ask_human_node")
    return "ask_human_node"


async def ask_human_node(state: AgentState) -> dict:
    """
    Node 3 – Clarification Question Generator
    -------------------------------------------
    When the extracted information is insufficient, this node generates a
    natural follow-up question targeting the specific missing fields.
    The AI message is appended to the conversation history and the graph ends.
    """
    missing = state.get("missing_fields", [])
    logger.info("[ask_human_node] Generating follow-up for missing fields: %s", missing)

    # Build a targeted prompt so the LLM asks about exactly what's missing
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

    # Use ainvoke for a complete response (not streaming).
    response = await _llm.ainvoke(messages_for_llm)

    # `AIMessage.content` is typed as `str | list[str | dict]` in LangChain.
    # Guard against the list case (tool-call responses, multi-modal models, etc.)
    # to prevent a TypeError when we later concatenate it into `messages`.
    raw_content = response.content
    follow_up_text: str = (
        raw_content
        if isinstance(raw_content, str)
        else " ".join(
            part if isinstance(part, str) else str(part)
            for part in raw_content
        )
    )

    logger.info("[ask_human_node] Follow-up question: %s", follow_up_text)

    # Append the AI's follow-up question to the conversation history
    updated_messages = list(state["messages"]) + [AIMessage(content=follow_up_text)]
    return {"messages": updated_messages}


async def search_db_node(state: AgentState) -> dict:
    """
    Node 4 – Database Search
    -------------------------
    Runs parallel searches against Qdrant (vector/semantic) and MongoDB
    (structured metadata) using the extracted filters from the state.

    Results from both sources are merged and de-duplicated by agency id
    before being stored back in the state.
    """
    logger.info("[search_db_node] Running parallel DB searches ...")

    # Run both searches concurrently for maximum throughput
    qdrant_task = _mock_qdrant_search(
        semantic_query=state.get("semantic_query", ""),
        budget=state.get("budget"),
        team_size=state.get("team_size"),
    )
    mongo_task = _mock_mongodb_search(
        domain=state.get("domain", []),
        tech_stack=state.get("tech_stack", []),
    )

    qdrant_results, mongo_results = await asyncio.gather(qdrant_task, mongo_task)

    logger.info(
        "[search_db_node] Qdrant returned %d, MongoDB returned %d results",
        len(qdrant_results),
        len(mongo_results),
    )

    # Merge & deduplicate by 'id' — Qdrant results take precedence (higher rank).
    # Guard against missing/None ids so we never call set.add(None), which would
    # cause a Pyright type error and silently drop all id-less results as dupes.
    seen_ids: set[str] = set()
    merged: list[dict] = []
    for result in [*qdrant_results, *mongo_results]:
        rid: str | None = result.get("id")
        if rid is None:
            # No id field — include the result but don't track it for dedup
            merged.append(result)
            continue
        if rid not in seen_ids:
            seen_ids.add(rid)
            merged.append(result)

    return {"results": merged}


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

    # Serialise results for the LLM context
    results_json = json.dumps(results, ensure_ascii=False, indent=2)

    system_prompt = (
        "You are a helpful assistant for a software agency search platform. "
        "Given the following list of matching agencies (in JSON), write a clear, "
        "concise, and friendly response summarising the top matches for the user. "
        "Highlight each agency's name, budget, team size, domain, and tech stack. "
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
    async for chunk in _llm.astream(messages_for_llm):
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

    updated_messages = list(state["messages"]) + [AIMessage(content=full_response)]
    return {
        "messages": updated_messages,
        "results": results,      # keep results in state for the API layer to access
    }


# ---------------------------------------------------------------------------
# 5.  GRAPH ASSEMBLY & COMPILATION
# ---------------------------------------------------------------------------

def build_search_agent():
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
    logger.info("[build_search_agent] Graph compiled successfully.")
    return compiled_graph


# Singleton compiled graph — import this instance from the API layer
search_agent = build_search_agent()


# ---------------------------------------------------------------------------
# 6.  PUBLIC HELPER — invoke the agent for a new user message
# ---------------------------------------------------------------------------

async def run_agent_turn(
    user_message: str,
    history: list[BaseMessage] | None = None,
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
    history = history or []

    # Append the new user message to the history
    messages = list(history) + [HumanMessage(content=user_message)]

    # Build the initial state snapshot
    initial_state: AgentState = {
        "messages": messages,
        "is_sufficient": False,
        "budget": None,
        "team_size": None,
        "domain": [],
        "tech_stack": [],
        "semantic_query": "",
        "missing_fields": [],
        "results": [],
    }

    # ainvoke runs the full graph asynchronously and returns the final state.
    # LangGraph types ainvoke as returning `dict[str, Any] | Any`; use `cast`
    # to tell the type checker this is our AgentState shape.
    final_state: AgentState = cast(AgentState, await search_agent.ainvoke(initial_state))

    # Extract the last AI message as the "reply" for the API layer.
    # Guard against list-typed `.content` (same issue as in ask_human_node).
    last_ai_message = ""
    for msg in reversed(final_state["messages"]):
        if isinstance(msg, AIMessage):
            raw = msg.content
            last_ai_message = (
                raw
                if isinstance(raw, str)
                else " ".join(
                    part if isinstance(part, str) else str(part)
                    for part in raw
                )
            )
            break

    return {
        "messages": final_state["messages"],
        "results": final_state.get("results", []),
        "reply": last_ai_message,
    }
