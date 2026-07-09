from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.utils.error.error import AppException

import logging
import traceback

logger = logging.getLogger(__name__)

def register_exception_handlers(app: FastAPI):
    """Register all exception handlers"""
    
    # 1. Custom exception handler
    @app.exception_handler(AppException)
    async def custom_exception_handler(request: Request, exc: AppException):
        """Handle custom exceptions"""
        detail = exc.detail if exc.detail else None
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": {
                    "message": exc.message,
                    "status_code": exc.status_code,
                    "detail": detail
                },
            },
        )
    
    # 2. Pydantic validation error handler
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """Handle Pydantic validation errors"""
        errors = []
        for error in exc.errors():
            errors.append({
                "field": ".".join(str(x) for x in error["loc"][1:]),
                "message": error["msg"],
                "type": error["type"],
            })
        
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "error": {
                    "status_code": status.HTTP_400_BAD_REQUEST,
                    "message": "Validation failed",
                    "details": errors,
                },
            },
        )
    
    # 3. Generic exception handler (catch-all)
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        """Handle all uncaught exceptions"""
        error_id = id(exc)  # Unique error ID for tracking
        
        logger.error(
            f"Uncaught exception: {error_id}",
            exc_info=exc,
            extra={
                "path": request.url.path,
                "method": request.method,
                "error_type": type(exc).__name__,
            }
        )
        
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "Internal server error",
                    "error_id": error_id,
                    # Only in development
                    "detail": str(exc) if False else None,  # Set True in DEBUG mode
                },
            },
        )