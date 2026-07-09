import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import bcrypt
from app.config import settings
from app.utils.error.error import UnauthorizedException

class JWTHandler:
    """
    Pure PyJWT implementation for token creation and verification
    """
    
    @staticmethod
    def hash_password(password: str) -> str:
        """
        Hash password using bcrypt
        
        Args:
            password: Plain text password
            
        Returns:
            Hashed password
        """
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """
        Verify password against hash
        
        Args:
            plain_password: Plain text password from user
            hashed_password: Hashed password from database
            
        Returns:
            True if password matches, False otherwise
        """
        try:
            return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
        except (ValueError, TypeError):
            return False
    
    @staticmethod
    def create_access_token(
        data: Dict[str, Any],
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """
        Create JWT access token (short-lived)
        
        Args:
            data: Payload data (e.g., {"sub": user_id})
            expires_delta: Custom expiration time
            
        Returns:
            Encoded JWT token string
            
        Example:
            token = JWTHandler.create_access_token({"sub": "user_123"})
        """
        to_encode = data.copy()
        
        # Set expiration
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(
                minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
            )
        
        # Add standard claims
        to_encode.update({
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "access"
        })
        
        # Encode token
        encoded_jwt = jwt.encode(
            to_encode,
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM
        )
        
        return encoded_jwt
    
    @staticmethod
    def create_refresh_token(
        data: Dict[str, Any],
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """
        Create JWT refresh token (long-lived)
        
        Args:
            data: Payload data
            expires_delta: Custom expiration time
            
        Returns:
            Encoded JWT token string
        """
        to_encode = data.copy()
        
        # Set expiration (longer than access token)
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(
                days=settings.REFRESH_TOKEN_EXPIRE_DAYS
            )
        
        # Add standard claims
        to_encode.update({
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "refresh"
        })
        
        # Encode token
        encoded_jwt = jwt.encode(
            to_encode,
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM
        )
        
        return encoded_jwt
    
    @staticmethod
    def verify_token(token: str) -> Dict[str, Any]:
        """
        Verify and decode JWT token
        
        Args:
            token: JWT token string
            
        Returns:
            Decoded payload dictionary
            
        Raises:
            UnauthorizedError: If token is invalid or expired
            
        Example:
            payload = JWTHandler.verify_token(token)
            user_id = payload["sub"]
        """
        try:
            # Decode token
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM]
            )
            return payload
            
        except jwt.ExpiredSignatureError:
            raise UnauthorizedException("Token has expired")
            
        except jwt.InvalidTokenError:
            raise UnauthorizedException("Invalid token")
            
        except Exception as e:
            raise UnauthorizedException(f"Token verification failed: {str(e)}")
    
    @staticmethod
    def get_user_id_from_token(token: str) -> str:
        """
        Extract user_id from token
        
        Args:
            token: JWT token string
            
        Returns:
            User ID from token payload
            
        Raises:
            UnauthorizedError: If extraction fails
        """
        payload = JWTHandler.verify_token(token)
        user_id = payload.get("sub")
        
        if not user_id:
            raise UnauthorizedException("Invalid token: missing user_id")
        
        return user_id
    
    @staticmethod
    def get_role_from_token(token: str) -> str:
        """
        Extract role from token
        
        Args:
            token: JWT token string
            
        Returns:
            Role from token payload
            
        Raises:
            UnauthorizedException: If extraction fails
        """
        payload = JWTHandler.verify_token(token)
        role = payload.get("role")
        
        if not role:
            raise UnauthorizedException("Invalid token: missing role")
        
        return role
    
    @staticmethod
    def decode_token_unsafe(token: str) -> Dict[str, Any]:
        """
        Decode token WITHOUT verification (use carefully!)
        Only for debugging or JWT inspection
        
        Args:
            token: JWT token string
            
        Returns:
            Decoded payload
        """
        return jwt.decode(
            token,
            options={"verify_signature": False}
        )
    
    @staticmethod
    def is_token_expired(token: str) -> bool:
        """Check if token is expired"""
        try:
            payload = JWTHandler.verify_token(token)
            return False
        except UnauthorizedException as e:
            if "expired" in str(e).lower():
                return True
            raise