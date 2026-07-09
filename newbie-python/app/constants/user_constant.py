import enum

class Role(str, enum.Enum):
    PO = "PROJECT_OWNER"
    AC = "AGENCY"

class UserStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"