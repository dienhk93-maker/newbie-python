from app.utils.error.error import NotFoundException
from app.utils.validation.object_id_validation import PyObjectId
from app.utils.common.pagination import ConversationParams
from app.models.conversation import Conversation
from app.services.agent_graph import root_agent
import asyncio

class ConversationService:
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
            Conversation.id == conversation_id
        )
        if not conversation:
            raise NotFoundException("Conversation not found")

        # Clean up LangGraph checkpointer state/history for this thread
        checkpointer = getattr(root_agent, "checkpointer", None)
        if checkpointer and not isinstance(checkpointer, bool) and hasattr(checkpointer, "adelete_thread"):
            try:
                await checkpointer.adelete_thread(conversation.thread_id)
            except Exception:
                pass

        await conversation.delete()


        
