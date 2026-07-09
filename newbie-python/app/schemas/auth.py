from pydantic import BaseModel, EmailStr
from datetime import datetime
from app.constants.user_constant import Role

class LoginRequest(BaseModel):
    """Login request"""
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    """Registration request"""
    email: EmailStr
    user_name: str
    password: str
    full_name: str
    role: Role = Role.PO
    
    class Config:
        example = {
            "email": "user@example.com",
            "user_name": "johnuser",
            "password": "Password123!",
            "full_name": "John Doe",
            "role": "PROJECT_OWNER"
        }

class TokenResponse(BaseModel):
    """Token response after login/refresh"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until expiration

class RefreshTokenRequest(BaseModel):
    """Refresh token request"""
    refresh_token: str

class UserResponse(BaseModel):
    """User profile response"""
    id: str
    email: str
    user_name: str
    full_name: str
    is_active: bool
    role: Role
    created_at: datetime

class ChangePasswordRequest(BaseModel):
    """Change password request"""
    old_password: str
    new_password: str