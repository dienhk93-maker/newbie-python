import enum

AVATAR_FILE_SIZE_LIMIT = 10 * 1024 * 1024


class FileType(str, enum.Enum):
    IMAGE_JPG = "image/jpeg"
    IMAGE_PNG = "image/png"
    IMAGE_GIF = "image/gif"
    IMAGE_WEBP = "image/webp"

AVATAR_FILE_TYPE_LIST = [FileType.IMAGE_JPG, FileType.IMAGE_PNG, FileType.IMAGE_GIF, FileType.IMAGE_WEBP]

AVATAR_BUCKET = "avatar"