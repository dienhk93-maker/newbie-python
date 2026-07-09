from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from app.utils.validation.object_id_validation import PyObjectId
from app.constants.user_constant import Role

class UserBase(BaseModel):
    email: EmailStr
    user_name: str
    full_name: str
    role: Role

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    user_name: Optional[str] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None

class UserResponse(UserBase):
    id: PyObjectId = Field(alias="_id")  # MongoDB ObjectId
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True
        populate_by_name = True  # Allow both id and _id

class UserInDB(UserResponse):
    hashed_password: str