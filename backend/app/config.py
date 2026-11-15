import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env")),
            ".env"
        ],
        extra="allow"
    )

    PROJECT_NAME: str = "Multi-Document RAG Intelligence Assistant"
    API_V1_STR: str = "/api"
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-rag-jwt-key-production-change-this-938210")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Gemini AI
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
    
    # Database
    USE_MONGODB: bool = os.getenv("USE_MONGODB", "false").lower() == "true"
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://127.0.0.1:27017")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "rag_intelligence_db")
    
    # Storage & Persistence
    BASE_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    UPLOAD_DIR: str = os.path.join(BASE_DIR, "uploads")
    DATA_DIR: str = os.path.join(BASE_DIR, "data")
    CHROMA_PERSIST_DIR: str = os.path.join(DATA_DIR, "chroma")
    LOCAL_DB_FILE: str = os.path.join(DATA_DIR, "local_store.json")
    
    # Document limits
    MAX_UPLOAD_SIZE_MB: int = 50
    ALLOWED_EXTENSIONS: set = {"pdf", "docx", "txt", "md"}
    
    # Default RAG Parameters
    DEFAULT_CHUNK_SIZE: int = 800
    DEFAULT_CHUNK_OVERLAP: int = 150
    DEFAULT_TOP_K: int = 5
    DEFAULT_SIMILARITY_THRESHOLD: float = 0.35
    DEFAULT_HYBRID_ALPHA: float = 0.65  # 0.65 semantic vector, 0.35 BM25 keyword

settings = Settings()

def update_env_file(key: str, value: str):
    """Persists an environment variable to the .env file in BASE_DIR and updates settings."""
    env_paths = [
        os.path.join(settings.BASE_DIR, ".env"),
        os.path.join(settings.BASE_DIR, "..", ".env"),
    ]
    for env_path in env_paths:
        try:
            lines = []
            found = False
            if os.path.exists(env_path):
                with open(env_path, "r", encoding="utf-8") as f:
                    lines = f.readlines()
                new_lines = []
                for line in lines:
                    stripped = line.strip()
                    if stripped.startswith(f"{key}=") or stripped.startswith(f"{key} ="):
                        new_lines.append(f'{key}="{value}"\n')
                        found = True
                    else:
                        new_lines.append(line)
                lines = new_lines
            if not found:
                lines.append(f'{key}="{value}"\n')
            
            with open(env_path, "w", encoding="utf-8") as f:
                f.writelines(lines)
        except Exception as e:
            pass
    
    os.environ[key] = value

# Ensure directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
