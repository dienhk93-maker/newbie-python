import logging
from bson import ObjectId
from app.utils.error.error import NotFoundException
from app.utils.validation.object_id_validation import PyObjectId
from app.utils.common.pagination import ConversationParams
from app.models.conversation import Conversation
from langgraph.checkpoint.mongodb import MongoDBSaver
import asyncio

logger = logging.getLogger(__name__)

class ConversationService:
    def __init__(self, checkpointer: MongoDBSaver) -> None:
        self._checkpointer = checkpointer

    async def get_conversations(
        self, 
        user_id: str, 
        pagination: ConversationParams
    ) -> tuple[list[Conversation], int]:
        query = Conversation.find(Conversation.user_id == user_id)
            
        [total, conversations] = await asyncio.gather(
            query.count(),
            query.sort("-" + "created_at").skip(pagination.skip).limit(pagination.item_page).to_list()
        )
        return conversations, total

    async def delete_conversation(
        self, 
        user_id: str, 
        conversation_id: PyObjectId
    ) -> None:
    
        conversation = await Conversation.find_one(
            Conversation.user_id == user_id, 
            Conversation.id == ObjectId(conversation_id)
        )
        if not conversation:
            raise NotFoundException("Conversation not found")

        await conversation.delete()

        if hasattr(self._checkpointer, "adelete_thread"):
            try:
                await self._checkpointer.adelete_thread(conversation.thread_id)
            except Exception as exc:
                logger.warning(
                    "Failed to delete LangGraph checkpointer state for thread '%s': %s",
                    conversation.thread_id,
                    exc,
                    exc_info=True,
                )
