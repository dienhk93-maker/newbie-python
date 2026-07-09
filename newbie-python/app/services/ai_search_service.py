from app.utils.common.helpper import build_numeric_range_filter
import uuid
from qdrant_client import models
from app.services.openai_service import OpenAIService
from app.services.qdrant_service import QdrantService


class AiSearchService:
    def __init__(self, openai_service: OpenAIService, qdrant_service: QdrantService):
        self.openai_service = openai_service
        self.qdrant_service = qdrant_service

    async def seed_mock_agencies(self):
        """Mock data generation and vector ingestion"""
        mock_agencies = [
            {
                "id": str(uuid.uuid4()),
                "text": "A team of 15 members specializing in React and Nodejs web development. Typical project budget is around 3000 USD.",
                "budget": 3000,
                "team_size": 15,
                "domain": ["web development"],
                "tech_stack": ["Node.js", "React"]
            },
            {
                "id": str(uuid.uuid4()),
                "text": "Expert team of 5 focusing on real-time chat apps, messaging, and video calls. High quality app development, usually around 10000 USD.",
                "budget": 10000,
                "team_size": 5,
                "domain": ["chat"],
                "tech_stack": ["Node.js", "React"]
            },
            {
                "id": str(uuid.uuid4()),
                "text": "Large Outsourcing company with 50 developers. Can handle any E-commerce and core systems. Very affordable, starting from 1000 USD.",
                "budget": 1000,
                "team_size": 50,
                "tech_stack": ["Node.js", "Golang"],
                "domain": ["e-commerce", "outsourcing"]
            }
        ]

        ids = []
        vectors = []
        payloads = []

        for agency in mock_agencies:
            vector = await self.openai_service.get_embedding(str(agency["text"]))
            ids.append(agency["id"])
            vectors.append(vector)
            payloads.append({
                "budget": agency["budget"],
                "team_size": agency["team_size"],
                "domain": agency["domain"],
                "tech_stack": agency["tech_stack"],
                "description": agency["text"]
            })

        await self.qdrant_service.upsert_points(
            ids=ids,
            vectors=vectors,
            payloads=payloads
        )
        return {"status": "success", "inserted": len(mock_agencies)}

    async def search_agencies(self, prompt: str, limit: int = 5):
        # 1. Extract Filters using LLM
        filters = await self.openai_service.extract_filters(prompt)

        # 2. Build Qdrant Filter from JSON
        must_conditions = []
        
        
        if filters.budget is not None:
            must_conditions.append(
                build_numeric_range_filter(
                    field_name="budget",
                    numeric_filter=filters.budget,
                )
            )

        # 3. Team size filter
        if filters.team_size is not None:
            must_conditions.append(
                build_numeric_range_filter(
                    field_name="team_size",
                    numeric_filter=filters.team_size,
                )
            )

        # 4. Domain filter
        if filters.domain:
            must_conditions.append(
                models.FieldCondition(
                    key="domain",
                    match=models.MatchAny(any=filters.domain),
                )
            )

        
        if filters.tech_stack:
            must_conditions.append(
                models.FieldCondition(
                    key="tech_stack",
                    match=models.MatchAny(any=filters.tech_stack),
                )
            )


        query_filter = (
            models.Filter(must=must_conditions)
            if must_conditions
            else None
        )

        # 7. Generate vector for semantic query
        query_text = filters.semantic_query or prompt

        query_vector = await self.openai_service.get_embedding(query_text)

        # 8. Search in Qdrant
        results = await self.qdrant_service.search(
            query_vector=query_vector,
            limit=limit,
            filter_=query_filter,
        )

        # 9. Format result
        formatted_results = [
            {
                "id": result.id,
                "score": result.score,
                "payload": result.payload,
            }
            for result in results
        ]

        return {
            "extracted_filters": filters.model_dump(),
            "results": formatted_results,
        }

