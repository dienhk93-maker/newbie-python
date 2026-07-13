from bson import ObjectId
from annotated_types import doc
from app.schemas.profile import UploadAvatarResponse
from app.constants.profile_constant import AVATAR_BUCKET
from app.constants.profile_constant import AVATAR_FILE_TYPE_LIST
from app.constants.profile_constant import AVATAR_FILE_SIZE_LIMIT
from app.utils.error.error import BadRequestException
from fastapi import UploadFile, BackgroundTasks
from app.schemas.profile import CreateProfileRequest
from app.models.profile import Profile
from app.utils.validation.object_id_validation import PyObjectId
from app.services.user_service import UserService
from app.utils.error.error import NotFoundException
from app.models.profile import Profile
from app.services.storage_service import StorageService
from app.constants.user_constant import Role
from datetime import datetime, timezone
from app.services.ai_search_service import AiSearchService
import asyncio

class ProfileService:
    def __init__(self, user_service: UserService, storage_service: StorageService, ai_search_service: AiSearchService):
        self.user_service = user_service
        self.storage_service = storage_service
        self.ai_search_service = ai_search_service


    async def create_profile(self, user_id: PyObjectId, body: CreateProfileRequest, background_tasks: BackgroundTasks) -> Profile:
        user = await self.user_service.get_user_by_id(user_id)
        if not user:
            raise NotFoundException("User not found")

        if user.role != Role.AC:
            raise BadRequestException("You are not authorized to create a profile")

        profile_exists = await Profile.find({"user.$id": user_id}).exists()
        if profile_exists:
            raise BadRequestException("Profile already exists")
        
        profile = Profile(
            user=user,
            bio=body.bio,
            website=body.website,
            phone=body.phone,
            address=body.address,
            avatar=body.avatar,
            domain=body.domain,
            tech_stack=body.tech_stack,
            team_size=body.team_size,
            budget=body.budget,
        )

        await profile.insert()
        
        # Run the embedding in the background
        if background_tasks is not None:
            background_tasks.add_task(self.ai_search_service.embedding_data, profile)
        else:
            # Fallback if no background_tasks is provided
            asyncio.create_task(self.ai_search_service.embedding_data(profile))

        return profile
        
    async def get_my_profile(self, user_id: str) -> Profile:
        from bson import ObjectId
        # Support looking up by User ID or directly by Profile ID
        profile = await Profile.find_one({
            "$or": [
                {"user.$id": ObjectId(user_id)},
                {"_id": ObjectId(user_id)}
            ]
        })
        if not profile:
            raise NotFoundException("Profile not found")
        return profile


    async def upload_avatar(
        self, user_id: PyObjectId, profile_id: PyObjectId, file: UploadFile
    ) -> UploadAvatarResponse:
        if file is None:
            raise BadRequestException("File not found")

        if file.size is not None and file.size > AVATAR_FILE_SIZE_LIMIT:
            raise BadRequestException("File size must be less than 10MB")
        
        if file.content_type not in AVATAR_FILE_TYPE_LIST:
            raise BadRequestException("File type not allowed")

        profile = await Profile.get(profile_id)
        if not profile:
            raise NotFoundException("Profile not found")
        
        if str(profile.user.to_ref().id) != user_id:
            raise BadRequestException("You are not authorized to upload avatar for this profile")
        
        avatar_url = await self.storage_service.upload_avatar(file, AVATAR_BUCKET)
        
        profile.avatar = avatar_url
        profile.updated_at = datetime.now(timezone.utc)
        await profile.save()

        return UploadAvatarResponse(
            avatar=avatar_url,
            message="Upload avatar successfully"
        )

    async def get_profiles_by_ids(self, ids: list[str]) -> list[Profile]:
        import logging
        _logger = logging.getLogger(__name__)
        from bson import ObjectId
        from beanie.operators import In
        
        _logger.info("[get_profiles_by_ids] Input IDs: %s", ids)
        
        object_ids = []
        for i in ids:
            if ObjectId.is_valid(i):
                object_ids.append(ObjectId(i))
                
        _logger.info("[get_profiles_by_ids] Valid ObjectIds: %s", object_ids)
        
        if not object_ids:
            _logger.warning("[get_profiles_by_ids] No valid ObjectIds found!")
            return []
            
        results = await Profile.find(In(Profile.id, object_ids), fetch_links=True).to_list()
        _logger.info("[get_profiles_by_ids] Profiles found: %d", len(results))
        return results
