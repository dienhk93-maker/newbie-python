from openai import AsyncOpenAI
from app.constants.prompts import AGENCY_EXTRACTION_PROMPT
from app.schemas.ai_search import SearchFilters
from app.config import settings


class OpenAIService:
    def __init__(self, api_key: str | None):
        if not api_key:
            # We allow initialization without key for setup, but it will fail on call
            self.client = None
        else:
            self.client = AsyncOpenAI(api_key=api_key)

    async def extract_filters(self, prompt: str) -> SearchFilters:
        if not self.client:
            raise ValueError("OPENAI_API_KEY is not set.")

        completion = await self.client.beta.chat.completions.parse(
            model=settings.AI_MODEL,
            messages=[
                {"role": "system", "content": AGENCY_EXTRACTION_PROMPT},
                {"role": "user", "content": prompt},
            ],
            response_format=SearchFilters,
        )

        parsed = completion.choices[0].message.parsed
        if parsed is None:
            return SearchFilters(semantic_query=prompt, is_sufficient=False, confidence=0)
            
        return parsed

    async def get_embedding(self, text: str) -> list[float]:
        if not self.client:
            raise ValueError("OPENAI_API_KEY is not set.")

        response = await self.client.embeddings.create(
            input=text,
            model=settings.EMBEDDING_MODEL
        )
        return response.data[0].embedding

    async def stream_chat(self, prompt: str):
        if not self.client:
            raise ValueError("OPENAI_API_KEY is not set.")

        stream = await self.client.chat.completions.create(
            model=settings.AI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            stream=True,
        )

        async for chunk in stream:
            if chunk.choices[0].delta.content is not None:
                # SSE format requires "data: <content>\n\n"
                # We yield the raw text chunks. We can let the API layer handle the formatting if we want,
                # but doing it here is fine for a simple implementation.
                # Actually, standard SSE expects a specific format. Let's yield just the text string.
                yield chunk.choices[0].delta.content
