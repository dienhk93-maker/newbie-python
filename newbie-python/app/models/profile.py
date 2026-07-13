from pymongo import ASCENDING, IndexModel
from beanie import Document, Link, Indexed
from datetime import datetime, timezone
from typing import Optional, Annotated
from pydantic import Field
from app.constants.user_constant import UserStatus
from app.models.user import User

class Profile(Document):
    address: str
    user: Annotated[Link[User], Indexed(unique=True)]
    bio: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    avatar: Optional[str] = None
    tech_stack: list[str] = Field(default_factory=list)
    domain: list[str] = Field(default_factory=list)
    team_size: int = 1
    budget: Optional[float] = None
    status: UserStatus = UserStatus.ACTIVE

    @property
    def user_id(self):
        return self.user.id if hasattr(self.user, "id") else self.user.ref.id
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "profiles"
        indexes = [
            IndexModel(
                [("user.$id", ASCENDING)],
                unique=True,
                name="uniq_profile_user"
            )
        ]
