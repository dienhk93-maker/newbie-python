from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from dishka.integrations.fastapi import FromDishka, inject
from app.schemas.ai_search import AISearchRequest
from app.services.ai_search_service import AiSearchService
from app.services.openai_service import OpenAIService

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
    ai_service: FromDishka[AiSearchService]
):
    """Search for Agencies using natural language"""
    return await ai_service.search_agencies(prompt=request.prompt, limit=request.limit)


from langchain_core.messages import HumanMessage, AIMessage
from app.services.agent_graph import search_agent

@router.post("/chat/stream")
@inject
async def chat_stream(
    request: AISearchRequest,
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

    async def event_generator():
        async for event in search_agent.astream_events(initial_state, version="v2"):
            if event["event"] == "on_chat_model_stream":
                node_name = event.get("metadata", {}).get("langgraph_node")
                if node_name in ["generator_node", "ask_human_node"]:
                    chunk = event["data"]["chunk"].content
                    if isinstance(chunk, str) and chunk:
                        safe_chunk = chunk.replace("\n", "\\n")
                        yield f"data: {safe_chunk}\n\n"
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")
