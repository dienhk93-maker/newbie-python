from datetime import datetime, timezone
from typing import Annotated
from beanie import Indexed, Document
from pydantic import Field

class Conversation(Document):
    thread_id: Annotated[str, Indexed(unique=True)]
    title: str
    user_id: Annotated[str, Indexed()]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "conversations"