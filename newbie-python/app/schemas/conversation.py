from datetime import datetime
from pydantic import BaseModel, Field
from app.utils.validation.object_id_validation import PyObjectId

class ConversationResponse(BaseModel):
    id: PyObjectId = Field(alias="_id")
    thread_id: str
    title: str
    user_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True
