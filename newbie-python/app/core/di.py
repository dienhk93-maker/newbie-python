from dishka import Provider, Scope, provide
from app.services.user_service import UserService
from app.services.common_service import CommonService
from app.services.auth_service import AuthService
from app.services.qdrant_service import QdrantService
from app.config import Settings, settings
from qdrant_client import AsyncQdrantClient
from app.services.openai_service import OpenAIService
from app.services.ai_search_service import AiSearchService

#Service Provider
class ServiceProvider(Provider):
    scope = Scope.REQUEST

    @provide
    def get_user_service(self) -> UserService:
        return UserService()

    @provide
    def get_common_service(self, qdrant_service: QdrantService) -> CommonService:
        return CommonService(qdrant_service)

    @provide
    def get_auth_service(self, user_service: UserService) -> AuthService:
        return AuthService(user_service)

    @provide
    def get_openai_service(self, settings: Settings) -> OpenAIService:
        return OpenAIService(api_key=settings.OPENAI_API_KEY)

    @provide
    def get_ai_search_service(
        self,
        openai_service: OpenAIService,
        qdrant_service: QdrantService
    ) -> AiSearchService:
        return AiSearchService(openai_service, qdrant_service)


# Qdrant Provider
class QdrantProvider(Provider):
    scope = Scope.APP

    @provide
    def get_settings(self) -> Settings:
        return settings

    @provide
    def get_qdrant_client(
        self,
        settings: Settings,
    ) -> AsyncQdrantClient:
        return AsyncQdrantClient(
            url=settings.QDRANT_URL,
        )

    @provide
    def get_qdrant_service(
        self,
        client: AsyncQdrantClient,
        settings: Settings,
    ) -> QdrantService:
        return QdrantService(
            client=client,
            collection_name=settings.QDRANT_COLLECTION_NAME,
            embedding_size=settings.QDRANT_EMBEDDING_SIZE,
        )