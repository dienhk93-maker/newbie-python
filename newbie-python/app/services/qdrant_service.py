from typing import Any
from qdrant_client import AsyncQdrantClient, models


class QdrantService:
    def __init__(
        self,
        client: AsyncQdrantClient,
        collection_name: str,
        embedding_size: int,
    ):
        self.client = client
        self.collection_name = collection_name
        self.embedding_size = embedding_size

    async def ensure_collection(self) -> None:
        collections = await self.client.get_collections()
        collection_names = [
            collection.name
            for collection in collections.collections
        ]

        if self.collection_name in collection_names:
            return

        await self.client.create_collection(
            collection_name=self.collection_name,
            vectors_config=models.VectorParams(
                size=self.embedding_size,
                distance=models.Distance.COSINE,
            ),
        )

    async def upsert_points(
        self,
        *,
        ids: list[str],
        vectors: list[list[float]],
        payloads: list[dict[str, Any]],
    ) -> None:
        points = [
            models.PointStruct(
                id=point_id,
                vector=vector,
                payload=payload,
            )
            for point_id, vector, payload in zip(ids, vectors, payloads)
        ]

        await self.client.upsert(
            collection_name=self.collection_name,
            points=points,
        )

    async def search(
        self,
        *,
        query_vector: list[float],
        limit: int = 5,
        filter_: models.Filter | None = None,
    ):
        result = await self.client.query_points(
            collection_name=self.collection_name,
            query=query_vector,
            limit=limit,
            query_filter=filter_,
            score_threshold=0.5
        )

        return result.points

    async def delete_points(
        self,
        ids: list[models.ExtendedPointId],
    ) -> None:
        await self.client.delete(
            collection_name=self.collection_name,
            points_selector=models.PointIdsList(
                points=ids,
            ),
        )