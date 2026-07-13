from fastapi import File, UploadFile, BackgroundTasks
from app.schemas.profile import UploadAvatarResponse
from fastapi import APIRouter, Depends
from app.utils.validation.object_id_validation import PyObjectId
from app.schemas.profile import ProfileResponse, CreateProfileRequest
from dishka.integrations.fastapi import FromDishka, inject
from app.api.deps import get_current_user_id
from app.services.profile_service import ProfileService

router = APIRouter(prefix="/profiles", tags=["Profiles"])

@router.post("/new", response_model=ProfileResponse)
@inject
async def create_profile(body: CreateProfileRequest, background_tasks: BackgroundTasks, profile_service: FromDishka[ProfileService], current_user_id: str = Depends(get_current_user_id)):
    return await profile_service.create_profile(current_user_id, body, background_tasks)

@router.get("/{user_id}", response_model=ProfileResponse)
@inject
async def get_my_profile(
    user_id: PyObjectId,
    profile_service: FromDishka[ProfileService],
    current_user_id: str = Depends(get_current_user_id)
):
    return await profile_service.get_my_profile(user_id)

@router.post("/avatar/{profile_id}", response_model=UploadAvatarResponse)
@inject
async def upload_avatar(
    profile_id: PyObjectId,
    profile_service: FromDishka[ProfileService],
    file: UploadFile = File(...),
    current_user_id: str = Depends(get_current_user_id)
):
    return await profile_service.upload_avatar(current_user_id, profile_id, file)