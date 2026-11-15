import logging
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import db_manager
from app.auth.security import get_password_hash
from app.auth.router import router as auth_router
from app.documents.router import router as documents_router
from app.chat.router import router as chat_router
from app.rag.router import router as rag_router
from app.analytics.router import router as analytics_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("rag_intelligence.main")

async def seed_demo_data_if_needed():
    """Seeds a ready-to-test demo user & workspace if no users exist."""
    existing_user = await db_manager.find_user_by_email("demo@ragintelligence.ai")
    if not existing_user:
        demo_user_id = str(uuid.uuid4())
        demo_ws_id = str(uuid.uuid4())
        
        await db_manager.create_workspace({
            "id": demo_ws_id,
            "user_id": demo_user_id,
            "name": "Production Intelligence Workspace",
            "description": "Default workspace with multi-document RAG capabilities",
            "document_count": 0,
            "created_at": "2026-01-01T00:00:00Z"
        })
        
        await db_manager.create_user({
            "id": demo_user_id,
            "email": "demo@ragintelligence.ai",
            "hashed_password": get_password_hash("password123"),
            "full_name": "Senior AI Architect",
            "role": "admin",
            "active_workspace_id": demo_ws_id,
            "created_at": "2026-01-01T00:00:00Z"
        })
        logger.info("Demo user seeded: demo@ragintelligence.ai / password123")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Multi-Document RAG Intelligence Assistant backend...")
    await db_manager.initialize()
    await seed_demo_data_if_needed()
    yield
    # Shutdown
    logger.info("Shutting down backend services...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Production-Ready Multi-Document RAG Intelligence Platform",
    lifespan=lifespan
)

# Enable CORS for frontend Vite development & production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(documents_router, prefix=settings.API_V1_STR)
app.include_router(chat_router, prefix=settings.API_V1_STR)
app.include_router(rag_router, prefix=settings.API_V1_STR)
app.include_router(analytics_router, prefix=settings.API_V1_STR)

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "database": "mongodb" if db_manager.is_mongo else "local_store",
        "gemini_configured": bool(settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY.strip()) > 5),
        "model": settings.GEMINI_MODEL
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
