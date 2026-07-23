from app.api.deps import get_current_user_id
from fastapi import Depends
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from dishka.integrations.fastapi import FromDishka, inject
from app.schemas.ai_search import AISearchRequest, ResumeChatRequest
from app.services.ai_search_service import AiSearchService
from app.services.openai_service import OpenAIService
from app.services.qdrant_service import QdrantService
from app.services.profile_service import ProfileService
from langchain_core.messages import HumanMessage, AIMessage
from app.services.agent_graph import root_agent
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/ai-search",
    tags=["AI Search"],
)

@router.post("/seed")
@inject
async def seed_data(
    ai_service: FromDishka[AiSearchService]
):
    """Automatically generate 5 mock Agencies and save them to Qdrant"""
    return await ai_service.seed_mock_agencies()

@router.post("/")
@inject
async def search(
    request: AISearchRequest,
    ai_service: FromDishka[AiSearchService],
    current_user_id: str = Depends(get_current_user_id)
):
    """Search for Agencies using natural language"""
    return await ai_service.search_agencies(prompt=request.prompt, limit=request.limit)


@router.post("/chat/stream")
@inject
async def chat_stream(
    request: AISearchRequest,
    qdrant_service: FromDishka[QdrantService],
    openai_service: FromDishka[OpenAIService],
    profile_service: FromDishka[ProfileService],
    current_user_id: str = Depends(get_current_user_id)
):
    """Stream a chat response from LangGraph Agent"""
    import uuid
    from app.models.conversation import Conversation

    # Use provided thread_id or generate a new one
    thread_id = request.thread_id or uuid.uuid4().hex

    # Check if this conversation exists, if not, create it
    existing_conv = await Conversation.find_one(Conversation.thread_id == thread_id)
    if not existing_conv:
        words = request.prompt.split()
        title = " ".join(words[:10]) + ("..." if len(words) > 10 else "")
        new_conv = Conversation(
            thread_id=thread_id,
            user_id=current_user_id,
            title=title
        )
        await new_conv.insert()

    new_input = {
        "messages": [HumanMessage(content=request.prompt)]
    }

    config = {
        "configurable": {
            "thread_id": thread_id,
            "qdrant_service": qdrant_service,
            "openai_service": openai_service,
            "profile_service": profile_service,
        }
    }

    async def event_generator():
        streamed_nodes = set()
        async for event in root_agent.astream_events(new_input, config=config, version="v2"):
            # ── DIAGNOSTIC: log every event type so we can trace what the graph emits ──
            event_name = event.get("name", "?")
            logger.info("[stream_event] type=%s name=%s", event["event"], event_name)
            if event["event"] == "on_chain_end" and event.get("name") == "search_db_node":
                node_output = event.get("data", {}).get("output", {})
                results = node_output.get("results", [])
                if results:
                    import json
                    json_data = json.dumps(results, ensure_ascii=False)
                    yield f"event: search_results\ndata: {json_data}\n\n"

            if event["event"] == "on_chain_end" and event.get("name") in ["ask_human_node", "consultant", "consultant_node"]:
                node_name = event.get("name")
                if node_name not in streamed_nodes:
                    node_output = event.get("data", {}).get("output", {})
                    messages = node_output.get("messages", [])
                    if messages and hasattr(messages[-1], "content"):
                        text = messages[-1].content
                        if isinstance(text, str) and text:
                            streamed_nodes.add(node_name)
                            safe_chunk = text.replace("\n", "\\n")
                            yield f"data: {safe_chunk}\n\n"

            if event["event"] == "on_chat_model_stream":
                meta_node = event.get("metadata", {}).get("langgraph_node", "")
                chunk = event["data"]["chunk"]
                # Skip tool_call chunks (structured output / function calls)
                if chunk.tool_call_chunks:
                    continue
                text = chunk.content
                if isinstance(text, str) and text:
                    logger.info("[stream] on_chat_model_stream langgraph_node=%r preview=%r", meta_node, text[:40])
                    # Only stream from text-generation nodes, not from structured-output nodes
                    # (supervisor_node / extractor_node emit JSON — we must exclude them).
                    # Use endswith() to handle subgraph namespace prefix e.g. "search_agent:generator_node".
                    STREAM_NODES = {"generator_node", "ask_human_node", "consultant", "consultant_node", "agent"}
                    if any(meta_node == n or meta_node.endswith(f":{n}") for n in STREAM_NODES):
                        safe_chunk = text.replace("\n", "\\n")
                        yield f"data: {safe_chunk}\n\n"

            if event["event"] == "on_chain_start":
                node_name = event.get("name")
                status_messages = {
                    "supervisor_node": "Analyzing request intent...",
                    "extractor_node": "Extracting search parameters...",
                    "ask_human_node": "Formatting clarification question...",
                    "search_db_node": "Searching database for agencies...",
                    "generator_node": "Generating final summary...",
                    "consultant": "Consulting with expert agent (this might take a bit)...",
                    "consultant_node": "Consulting with expert agent (this might take a bit)..."
                }
                if node_name in status_messages:
                    msg = status_messages[node_name]
                    import json
                    json_data = json.dumps({"status": msg}, ensure_ascii=False)
                    yield f"event: status_update\ndata: {json_data}\n\n"
            
            if event["event"] == "on_tool_start":
                tool_name = event.get("name", "")
                if tool_name:
                    tool_msg = f"Calling tool: {tool_name}..."
                    if "tavily" in tool_name.lower() or "search" in tool_name.lower():
                        tool_msg = "Searching the internet..."
                    elif "lunar" in tool_name.lower():
                        tool_msg = "Checking the lunar calendar..."
                    import json
                    json_data = json.dumps({"status": tool_msg}, ensure_ascii=False)
                    yield f"event: status_update\ndata: {json_data}\n\n"

            # ── Catch Human-in-the-Loop Interrupts ──
            if event["event"] == "on_chain_stream":
                chunk = event.get("data", {}).get("chunk", {})
                if isinstance(chunk, dict) and "__interrupt__" in chunk:
                    interrupts = chunk["__interrupt__"]
                    if interrupts:
                        # interrupts is a tuple of Interrupt objects
                        interrupt_obj = interrupts[0]
                        if isinstance(interrupt_obj, dict):
                            interrupt_value = interrupt_obj.get("value", {})
                        else:
                            interrupt_value = getattr(interrupt_obj, "value", {})
                        
                        import json
                        logger.info("[stream] Emitting interrupt event with value: %s", interrupt_value)
                        json_data = json.dumps(interrupt_value, ensure_ascii=False)
                        yield f"event: interrupt\ndata: {json_data}\n\n"


            if event["event"] == "on_tool_end":
                tool_name = event.get("name", "")
                tool_output = event.get("data", {}).get("output", "")
                logger.info("[stream] Tool '%s' executed → output: %s", tool_name, str(tool_output)[:300])
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/chat/resume")
@inject
async def chat_resume(
    request: ResumeChatRequest,
    qdrant_service: FromDishka[QdrantService],
    openai_service: FromDishka[OpenAIService],
    profile_service: FromDishka[ProfileService],
    current_user_id: str = Depends(get_current_user_id)
):
    """Resume a paused LangGraph thread after Human-in-the-Loop interrupt"""
    from langgraph.types import Command

    config = {
        "configurable": {
            "thread_id": request.thread_id,
            "qdrant_service": qdrant_service,
            "openai_service": openai_service,
            "profile_service": profile_service,
        }
    }

    async def event_generator():
        streamed_nodes = set()
        resume_command = Command(resume=request.approved)

        async for event in root_agent.astream_events(resume_command, config=config, version="v2"):
            if event["event"] == "on_chain_end" and event.get("name") == "search_db_node":
                node_output = event.get("data", {}).get("output", {})
                results = node_output.get("results", [])
                if results:
                    import json
                    json_data = json.dumps(results, ensure_ascii=False)
                    yield f"event: search_results\ndata: {json_data}\n\n"

            if event["event"] == "on_chain_end" and event.get("name") in ["ask_human_node", "consultant", "consultant_node"]:
                node_name = event.get("name")
                if node_name not in streamed_nodes:
                    node_output = event.get("data", {}).get("output", {})
                    messages = node_output.get("messages", [])
                    if messages and hasattr(messages[-1], "content"):
                        text = messages[-1].content
                        if isinstance(text, str) and text:
                            streamed_nodes.add(node_name)
                            safe_chunk = text.replace("\n", "\\n")
                            yield f"data: {safe_chunk}\n\n"

            if event["event"] == "on_chat_model_stream":
                meta_node = event.get("metadata", {}).get("langgraph_node", "")
                chunk = event["data"]["chunk"]
                if chunk.tool_call_chunks:
                    continue
                text = chunk.content
                if isinstance(text, str) and text:
                    STREAM_NODES = {"generator_node", "ask_human_node", "consultant", "consultant_node", "agent"}
                    if any(meta_node == n or meta_node.endswith(f":{n}") for n in STREAM_NODES):
                        if meta_node:
                            streamed_nodes.add(meta_node)
                        safe_chunk = text.replace("\n", "\\n")
                        yield f"data: {safe_chunk}\n\n"

            if event["event"] == "on_chain_start":
                node_name = event.get("name")
                status_messages = {
                    "search_db_node": "Searching database for agencies...",
                    "generator_node": "Generating final summary...",
                }
                if node_name in status_messages:
                    msg = status_messages[node_name]
                    import json
                    json_data = json.dumps({"status": msg}, ensure_ascii=False)
                    yield f"event: status_update\ndata: {json_data}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/chat/{thread_id}/history")
@inject
async def get_chat_history(
    thread_id: str,
    current_user_id: str = Depends(get_current_user_id)
):
    """Retrieve chat history from LangGraph checkpointer"""
    config = {"configurable": {"thread_id": thread_id}}
    
    # Sử dụng aget_state vì checkpointer là AsyncMongoDBSaver
    state_snapshot = await root_agent.aget_state(config)
    
    messages_for_ui = []
    if state_snapshot and getattr(state_snapshot, "values", None):
        raw_messages = state_snapshot.values.get("messages", [])
        for msg in raw_messages:
            if isinstance(msg, HumanMessage):
                messages_for_ui.append({"role": "user", "content": msg.content})
            elif isinstance(msg, AIMessage):
                if msg.content:
                    agencies = msg.response_metadata.get("agencies", [])
                    messages_for_ui.append({"role": "ai", "content": msg.content, "agencies": agencies})
                
    return {"history": messages_for_ui}


@router.get("/conversations")
async def get_conversations(
    current_user_id: str = Depends(get_current_user_id)
):
    """Retrieve all conversations for the current round"""
    from app.models.conversation import Conversation
    # Ngược chiều kim đồng hồ thời gian tạo
    convs = await Conversation.find(Conversation.user_id == current_user_id).sort("-created_at").to_list()
    return {"conversations": convs}
