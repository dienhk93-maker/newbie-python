from typing import Any
from app.utils.common.helpper import build_numeric_range_filter
from app.utils.common.normalize import normalize_tech_list
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


    async def embedding_data(self, profile_data: Any) -> None:
        """
        Embeds a newly created profile and upserts it into Qdrant.
        profile_data can be a dictionary or a Pydantic Profile model.
        """
        # Convert to dictionary if it's a Pydantic model
        if hasattr(profile_data, "model_dump"):
            profile_data = profile_data.model_dump(by_alias=True)
            
        # 1. Build the semantic text from profile data
        bio = profile_data.get("bio") or ""
        team_size = profile_data.get("team_size", 1)
        address = profile_data.get("address", "")
        budget = profile_data.get("budget", 0)
        avatar = profile_data.get("avatar")
        
        domain_list = profile_data.get("domain", [])
        tech_stack_list = normalize_tech_list(profile_data.get("tech_stack", []))
        domain_str = ", ".join(domain_list)
        tech_stack_str = ", ".join(tech_stack_list)

        text_to_embed = (
            f"{bio} "
            f"We are a team of {team_size} members located in {address}. "
            f"Our primary domains are {domain_str}. "
            f"We use technologies such as {tech_stack_str}. "
            f"Our typical budget is around {budget} USD."
        )

        # 2. Get the embedding vector from OpenAI
        vector = await self.openai_service.get_embedding(text_to_embed)

        # 3. Create a deterministic UUID for Qdrant from the MongoDB ObjectId
        profile_id_str = str(profile_data.get("id") or profile_data.get("_id", uuid.uuid4()))

        # 4. Prepare the payload for Qdrant filtering
        payload = {
            "id": profile_id_str,
            "budget": budget,
            "team_size": team_size,
            "domain": domain_list,
            "tech_stack": tech_stack_list,
            "description": text_to_embed,
            "avatar": avatar
        }

        # 5. Upsert to Qdrant
        await self.qdrant_service.upsert(
            id=uuid.uuid4(),
            vector=vector,
            payload=payload
        )

    async def search_agencies(self, prompt: str, limit: int = 5):
        # 1. Extract Filters using LLM
        filters = await self.openai_service.extract_filters(prompt)

        # 2. Build Qdrant Filter
        # must = hard constraints (budget, team_size) — bắt buộc phải đúng
        # should = soft constraints (tech_stack, domain) — ưu tiên nhưng không loại bỏ hoàn toàn
        must_conditions = []
        should_conditions = []

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

        # 4. Domain filter — dùng should (OR) để partial match vẫn trả kết quả
        if filters.domain:
            should_conditions.append(
                models.FieldCondition(
                    key="domain",
                    match=models.MatchAny(any=filters.domain),
                )
            )

        # 5. Tech stack filter — normalize tên rồi dùng should
        if filters.tech_stack:
            normalized_tech = normalize_tech_list(filters.tech_stack)
            should_conditions.append(
                models.FieldCondition(
                    key="tech_stack",
                    match=models.MatchAny(any=normalized_tech),
                )
            )

        query_filter = None
        if must_conditions or should_conditions:
            query_filter = models.Filter(
                must=must_conditions or None,
                should=should_conditions or None,
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

