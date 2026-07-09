from typing import Optional
from typing import Literal
from typing import List
from pydantic import BaseModel, Field

class NumbericFilter(BaseModel):
    operator: Literal["<", "<=", ">=", ">", "=", "between"]
    value: float | int | list[float | int]

class SearchFilters(BaseModel):
    is_sufficient: bool
    confidence: float = Field(ge=0, le=1)
    budget: Optional[NumbericFilter] = None
    team_size: Optional[NumbericFilter] = None
    domain: List[str] = Field(default_factory=list)
    tech_stack: list[str] = Field(default_factory=list)
    semantic_query: str
    missing_fields: list[str] = Field(default_factory=list)
    follow_up_question: str | None = None



class AISearchRequest(BaseModel):
    prompt: str = Field(..., description="The search query from the user")
    limit: int = Field(default=5, description="Number of results to return")
    messages: Optional[List[dict]] = Field(default=None, description="Previous conversation history")


