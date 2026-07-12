from app.api.deps import get_current_user_id
from fastapi import Depends
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from dishka.integrations.fastapi import FromDishka, inject
from app.schemas.ai_search import AISearchRequest
from app.services.ai_search_service import AiSearchService
from app.services.openai_service import OpenAIService
from app.services.qdrant_service import QdrantService
from app.services.profile_service import ProfileService
from langchain_core.messages import HumanMessage, AIMessage
from app.services.agent_graph import search_agent

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
    # Reconstruct history
    history = []
    if request.messages:
        for msg in request.messages:
            if msg.get("role") == "user":
                history.append(HumanMessage(content=msg.get("content", "")))
            elif msg.get("role") == "ai":
                history.append(AIMessage(content=msg.get("content", "")))
                
    history.append(HumanMessage(content=request.prompt))

    initial_state = {
        "messages": history,
        "is_sufficient": False,
        "budget": None,
        "team_size": None,
        "domain": [],
        "tech_stack": [],
        "semantic_query": "",
        "missing_fields": [],
        "results": [],
    }

    # Truyền real services vào LangGraph qua config["configurable"]
    config = {
        "configurable": {
            "qdrant_service": qdrant_service,
            "openai_service": openai_service,
            "profile_service": profile_service,
        }
    }

    async def event_generator():
        async for event in search_agent.astream_events(initial_state, config=config, version="v2"):
            # 1. Real-world pattern: Gửi raw data dạng JSON qua Custom SSE Event 
            # để frontend tự do render ra thẻ UI thay vì ép chung vào luồng text markdown.
            if event["event"] == "on_chain_end" and event.get("name") == "search_db_node":
                node_output = event.get("data", {}).get("output", {})
                results = node_output.get("results", [])
                if results:
                    import json
                    json_data = json.dumps(results, ensure_ascii=False)
                    # Yield event với tên 'search_results'
                    yield f"event: search_results\ndata: {json_data}\n\n"

            # 2. Luồng text chat thông thường của LLM
            if event["event"] == "on_chat_model_stream":
                node_name = event.get("metadata", {}).get("langgraph_node")
                if node_name in ["generator_node", "ask_human_node"]:
                    chunk = event["data"]["chunk"].content
                    if isinstance(chunk, str) and chunk:
                        safe_chunk = chunk.replace("\n", "\\n")
                        # Mặc định của SSE là event 'message'
                        yield f"data: {safe_chunk}\n\n"
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")

