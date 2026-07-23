from typing import Optional
from typing import Literal
from typing import List
from pydantic import BaseModel, Field

class NumbericFilter(BaseModel):
    operator: str
    value: float | int | list[float | int]

class SearchFilters(BaseModel):
    is_sufficient: bool
    confidence: float = Field(ge=0, le=1)
    budget: Optional[NumbericFilter] = None
    team_size: Optional[NumbericFilter] = None
    domain: list[str] = Field(default_factory=list)
    tech_stack: list[str] = Field(default_factory=list)
    semantic_query: str
    missing_fields: list[str] = Field(default_factory=list)
    follow_up_question: str | None = None



class AISearchRequest(BaseModel):
    prompt: str = Field(..., description="The search query from the user")
    limit: int = Field(default=5, description="Number of results to return")
    messages: Optional[List[dict]] = Field(default=None, description="Previous conversation history")
    thread_id: Optional[str] = Field(default=None, description="Session ID for LangGraph Checkpointer")


class SearchNextGraph(BaseModel):
    next_agent: Literal["consultant", "search_agent", "FINISH"]


class ResumeChatRequest(BaseModel):
    thread_id: str = Field(..., description="Session ID for LangGraph Checkpointer")
    approved: bool = Field(default=True, description="User confirmation choice for search filters")

