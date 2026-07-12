from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional
from pydantic import Field
from app.constants.user_constant import UserStatus
from app.models.user import User
from beanie import Link
from app.utils.validation.object_id_validation import PyObjectId


class ProfileResponse(BaseModel):
    id: PyObjectId
    user: Link[User]
    bio: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    address: str
    avatar: Optional[str] = None
    tech_stack: list[str] = Field(default_factory=list)
    domain: list[str] = Field(default_factory=list)
    team_size: int = 1
    budget: Optional[float]
    status: UserStatus = UserStatus.ACTIVE
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        from_attributes = True

class CreateProfileRequest(BaseModel):
    bio: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    address: str
    avatar: Optional[str] = None
    domain: list[str] = Field(default_factory=list)
    tech_stack: list[str] = Field(default_factory=list)
    team_size: int = 1
    budget: Optional[float]

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "bio": "Experienced backend developer specializing in FastAPI and MongoDB.",
                    "website": "https://johndoe.dev",
                    "phone": "+1-555-0123",
                    "address": "123 Tech Lane, San Francisco, CA",
                    "avatar": "https://example.com/avatars/johndoe.png",
                    "domain": [
                        "Software Engineering",
                        "AI Research"
                    ],
                    "tech_stack": [
                        "Nodejs",
                        "MongoDB",
                        "Reactjs"
                    ],
                    "team_size": 5,
                    "budget": 15000.50
                }
            ]
        }
    }


class UploadAvatarResponse(BaseModel):
    avatar: str
    message: str
