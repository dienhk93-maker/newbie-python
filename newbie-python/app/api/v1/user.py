from fastapi import APIRouter
from app.schemas.user import UserResponse, UserUpdate
from app.utils.validation.object_id_validation import PyObjectId
from dishka.integrations.fastapi import FromDishka, inject
from app.services.user_service import UserService
from fastapi import Depends
from app.api.deps import get_current_user_id
from app.utils.common.pagination import PaginatedResponse, PaginationParams, get_pagination_params, build_paginated_response

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/{user_id}", response_model=UserResponse)
@inject
async def get_user(
    user_id: PyObjectId, 
    user_service: FromDishka[UserService],
    current_user_id: str = Depends(get_current_user_id)
):
    """Get user by ID"""
    return await user_service.get_user_by_id(user_id)

@router.get("/", response_model=PaginatedResponse[UserResponse])
@inject
async def list_users(
    user_service: FromDishka[UserService], 
    pagination: PaginationParams = Depends(get_pagination_params),
    current_user_id: str = Depends(get_current_user_id),
):
    """List users"""
    users, total = await user_service.list_users(pagination)
    return build_paginated_response(
        docs=users,
        total=total,
        pagination=pagination
    )

@router.put("/{user_id}", response_model=UserResponse)
@inject
async def update_user(
    user_id: PyObjectId, 
    user_data: UserUpdate, 
    user_service: FromDishka[UserService],
    current_user_id: str = Depends(get_current_user_id)
):
    """Update user"""
    return await user_service.update_user(user_id, user_data)

@router.delete("/{user_id}", status_code=204)
@inject
async def delete_user(
    user_id: PyObjectId, 
    user_service: FromDishka[UserService],
    current_user_id: str = Depends(get_current_user_id)
):
    """Delete user"""
    return await user_service.delete_user(user_id)