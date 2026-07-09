from fastapi import APIRouter, Depends
from app.utils.validation.object_id_validation import PyObjectId
from dishka.integrations.fastapi import FromDishka, inject
from app.schemas.profile import ProfileResponse, CreateProfileRequest
from app.api.deps import get_current_user_id
from app.services.profile_service import ProfileService

router = APIRouter(prefix="/profiles", tags=["Profiles"])

@router.post("/{user_id}", response_model=ProfileResponse)
@inject
async def create_profile(user_id: PyObjectId, body: CreateProfileRequest, profile_service: FromDishka[ProfileService], current_user_id: str = Depends(get_current_user_id)):
    return await profile_service.create_profile(user_id, body)