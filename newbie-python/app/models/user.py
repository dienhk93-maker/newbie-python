from beanie import Document, Indexed
from pydantic import EmailStr, Field
from datetime import datetime, timezone
from typing import Optional
from app.constants.user_constant import Role

class User(Document):
    email: EmailStr = Indexed(unique=True)
    user_name: str = Indexed(unique=True)
    full_name: str
    role: Role = Role.PO
    hashed_password: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Settings:
        name = "users"  # Collection name
        
    def __repr__(self):
        return f"<User {self.user_name}>"