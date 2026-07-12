from app.core.di import MinIOProvider
import sys
from pathlib import Path
from app.database import connection
import warnings

# Suppress annoying Pydantic serialization warnings from Langchain/LangGraph
warnings.filterwarnings("ignore", message=".*Pydantic serializer warnings.*")

from fastapi import FastAPI
from contextlib import asynccontextmanager

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


from app.utils.error.error_handler import register_exception_handlers
from dishka import make_async_container
from dishka.integrations.fastapi import setup_dishka
from app.core.di import ServiceProvider, QdrantProvider
from app.services.qdrant_service import QdrantService
from app.api.router.index import setup_routers
from fastapi.middleware.cors import CORSMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Mongo init
    await connection.init()
    
    # Qdrant init
    async with container() as request_container:
        qdrant_service = await request_container.get(QdrantService)
        await qdrant_service.ensure_collection()

    yield
    # Shutdown
    await app.state.dishka_container.close()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register exception handlers
register_exception_handlers(app)

# Router
setup_routers(app)

# Setup Dishka
container = make_async_container(ServiceProvider(), QdrantProvider(), MinIOProvider())
setup_dishka(container, app)