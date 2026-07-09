from beanie import Document
from datetime import datetime, timezone
from typing import Optional
from pydantic import Field
from app.constants.user_constant import UserStatus
from app.models.user import User
from beanie import Link

class Profile(Document):
    user_id: Link[User]
    bio: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    address: str
    avatar: Optional[str] = None
    domain: list[str] = Field(default_factory=list)
    team_size: int = 1
    budget: Optional[float]
    status: UserStatus = UserStatus.ACTIVE
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "profiles"
    