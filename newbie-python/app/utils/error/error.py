from typing import Optional, Any
class AppException(Exception):
    def __init__(self, status_code: int, message: str, detail: Optional[Any] = None):
        self.status_code = status_code
        self.message = message
        self.detail = detail
        super().__init__(self.message)

class NotFoundException(AppException):
    def __init__(self, message: str = "Not found"):
        super().__init__(404, message)

class BadRequestException(AppException):
    def __init__(self, message: str = "Bad request"):
        super().__init__(400, message)

class ConflictException(AppException):
    def __init__(self, message: str = "Resource already exists"):
        super().__init__(409, message)

class UnauthorizedException(AppException):
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(401, message)

class ForbiddenException(AppException):
    def __init__(self, message: str = "Forbidden"):
        super().__init__(403, message)

class InternalServerException(AppException):
    def __init__(self, message: str = "Internal server error"):
        super().__init__(500, message)
        