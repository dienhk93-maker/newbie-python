from app.schemas.profile import CreateProfileRequest
from app.models.profile import Profile
from app.utils.validation.object_id_validation import PyObjectId
from app.services.user_service import UserService
from app.utils.error.error import NotFoundException
from app.models.profile import Profile

class ProfileService:
    def __init__(self, user_service: UserService):
        self.user_service = user_service

    async def create_profile(self, user_id: PyObjectId, body: CreateProfileRequest) -> Profile:
        user = await self.user_service.get_user_by_id(user_id)
        if not user:
            raise NotFoundException("User not found")
        
        profile = Profile(
            user_id=user._id,
            bio=body.bio,
            website=body.website,
            phone=body.phone,
            address=body.address,
            avatar=body.avatar,
            domain=body.domain,
            team_size=body.team_size,
            budget=body.budget,
        )
        return await profile.insert()