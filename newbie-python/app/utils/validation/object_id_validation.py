from typing import Annotated
from bson import ObjectId
from pydantic import AfterValidator, BeforeValidator
from app.utils.error.error import BadRequestException


def validate_object_id(value: str) -> str:
    if not ObjectId.is_valid(value):
        raise BadRequestException("Invalid ObjectId")
    return value


PyObjectId = Annotated[
    str,
    BeforeValidator(str),
    AfterValidator(validate_object_id),
]