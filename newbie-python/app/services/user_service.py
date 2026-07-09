from app.utils.error.error import ConflictException, NotFoundException
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from datetime import datetime, timezone
import bcrypt
from app.utils.validation.object_id_validation import PyObjectId
from app.utils.common.pagination import PaginationParams
import asyncio

class UserService:
    async def create_user(self, user_data: UserCreate) -> User:
        # Check if email exists
        existing = await User.find_one(User.email == user_data.email)
        if existing:
            raise ConflictException("Email already exists")
        
        # Hash password
        hashed = bcrypt.hashpw(
            user_data.password.encode(),
            bcrypt.gensalt()
        ).decode()
        
        # Create user
        user = User(
            email=user_data.email,
            user_name=user_data.user_name,
            full_name=user_data.full_name,
            hashed_password=hashed
        )
        return await user.insert()
    
    async def get_user_by_id(self, user_id: PyObjectId) -> User | None:
        user = await User.get(user_id)
        if not user:
            raise NotFoundException("User not found")
        return user
    
    async def list_users(self, pagination: PaginationParams) -> tuple[list[User], int]:
        sort = f"+{pagination.order_by}" if pagination.order_dir == "asc" else f"-{pagination.order_by}"
        query = User.find()
        if pagination.search_key:
            query = query.find({ "$or": [{"user_name": {"$regex": pagination.search_key, "$options": "i"}}, {"full_name": {"$regex": pagination.search_key, "$options": "i"}}, {"email": {"$regex": pagination.search_key, "$options": "i"}}]})
        [total, users] = await asyncio.gather(
            query.count(),
            query.sort(sort).skip(pagination.skip).limit(pagination.item_page).to_list()
        )
        return users, total
    
    async def update_user(self, user_id: PyObjectId, update_data: UserUpdate) -> User | None:
        user = await User.get(user_id)
        if not user:
            raise NotFoundException("User not found")
        
        update_dict = update_data.model_dump(exclude_unset=True)
        update_dict["updated_at"] = datetime.now(timezone.utc)
        
        await user.set(update_dict)
        return user
    
    async def delete_user(self, user_id: PyObjectId) -> bool | None:
        user = await User.get(user_id)
        if not user:
            raise NotFoundException("User not found")
        return await user.delete()
    
    async def get_by_email(self, email: str) -> User | None:
        return await User.find_one(User.email == email)