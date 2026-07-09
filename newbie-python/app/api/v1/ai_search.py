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


@router.post("/chat/stream")
@inject
async def chat_stream(
    request: AISearchRequest,
    openai_service: FromDishka[OpenAIService]
):
    """Stream a chat response from OpenAI"""
    async def event_generator():
        async for chunk in openai_service.stream_chat(request.prompt):
            # SSE standard requires data to be formatted like this
            yield f"data: {chunk}\n\n"
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")
