from app.utils.validation.object_id_validation import PyObjectId
from app.utils.common.pagination import get_conversation_params
from app.utils.common.pagination import ConversationParams
from dishka.integrations.fastapi import FromDishka, inject
from app.services.conversation_service import ConversationService
from app.api.deps import get_current_user_id
from fastapi import APIRouter, Depends
from app.schemas.conversation import ConversationResponse
from app.utils.common.pagination import (
    PaginatedResponse, 
    build_paginated_response
)

router = APIRouter(
    prefix="/conversations",
    tags=["Conversations"],
)

@router.get("/", response_model=PaginatedResponse[ConversationResponse])
@inject
async def get_conversations(
    conversation_service: FromDishka[ConversationService],
    pagination: ConversationParams = Depends(get_conversation_params),
    current_user_id: str = Depends(get_current_user_id)
):
    """List conversations for current user with pagination"""
    conversations, total = await conversation_service.get_conversations(current_user_id, pagination)
    return build_paginated_response(
        docs=conversations,
        total=total,
        pagination=pagination
    )

@router.delete("/{conversation_id}", status_code=204)
@inject 
async def delete_conversation(
    conversation_id: PyObjectId,
    conversation_service: FromDishka[ConversationService],
    current_user_id: str = Depends(get_current_user_id)
) -> None:
    await conversation_service.delete_conversation(current_user_id, conversation_id)

