from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from app.config import settings, update_env_file
from app.auth.security import get_current_user
from app.rag.hybrid_search import HybridSearchEngine
from app.rag.vector_store import vector_store

router = APIRouter(prefix="/search", tags=["Search & RAG Pipeline"])

class SearchRequest(BaseModel):
    query: str
    workspace_id: Optional[str] = None
    document_ids: Optional[List[str]] = None
    top_k: Optional[int] = 5
    similarity_threshold: Optional[float] = 0.3
    hybrid_alpha: Optional[float] = 0.65
    mode: Optional[str] = "hybrid" # hybrid, semantic, keyword

class RAGSettingsUpdate(BaseModel):
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = None
    chunk_size: Optional[int] = None
    chunk_overlap: Optional[int] = None
    top_k: Optional[int] = None
    similarity_threshold: Optional[float] = None
    hybrid_alpha: Optional[float] = None

@router.post("")
async def search_documents(
    req: SearchRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    active_ws = req.workspace_id or current_user.get("active_workspace_id")
    
    alpha = req.hybrid_alpha or settings.DEFAULT_HYBRID_ALPHA
    if req.mode == "semantic":
        alpha = 1.0
    elif req.mode == "keyword":
        alpha = 0.0

    results = HybridSearchEngine.search(
        workspace_id=active_ws,
        query=req.query,
        top_k=req.top_k or settings.DEFAULT_TOP_K,
        similarity_threshold=req.similarity_threshold or settings.DEFAULT_SIMILARITY_THRESHOLD,
        hybrid_alpha=alpha,
        document_ids=req.document_ids
    )

    return {
        "query": req.query,
        "mode": req.mode,
        "alpha": alpha,
        "results_count": len(results),
        "results": [r.to_dict() for r in results]
    }

@router.get("/sources")
async def get_indexed_sources(
    document_id: Optional[str] = Query(None),
    workspace_id: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    active_ws = workspace_id or current_user.get("active_workspace_id")
    doc_filter = [document_id] if document_id else None
    chunks = vector_store.get_all_chunks(active_ws, document_ids=doc_filter)
    
    return {
        "workspace_id": active_ws,
        "total_chunks": len(chunks),
        "chunks": chunks[:50]  # Return up to 50 sample chunks
    }

@router.get("/settings")
async def get_rag_settings(current_user: Dict[str, Any] = Depends(get_current_user)):
    return {
        "has_api_key": bool(settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY.strip()) > 5),
        "gemini_model": settings.GEMINI_MODEL,
        "chunk_size": settings.DEFAULT_CHUNK_SIZE,
        "chunk_overlap": settings.DEFAULT_CHUNK_OVERLAP,
        "top_k": settings.DEFAULT_TOP_K,
        "similarity_threshold": settings.DEFAULT_SIMILARITY_THRESHOLD,
        "hybrid_alpha": settings.DEFAULT_HYBRID_ALPHA,
        "supported_models": [
            {"id": "gemini-3.1-flash-lite", "name": "Gemini 3.1 Flash Lite (Ultra-Fast 1.0s - Recommended)"},
            {"id": "gemini-3.5-flash-lite", "name": "Gemini 3.5 Flash Lite (Fast & Efficient)"},
            {"id": "gemini-3.5-flash", "name": "Gemini 3.5 Flash (Balanced Reasoning)"}
        ]
    }

@router.post("/settings")
async def update_rag_settings(
    update: RAGSettingsUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    if update.gemini_api_key is not None:
        clean_key = update.gemini_api_key.strip()
        settings.GEMINI_API_KEY = clean_key
        update_env_file("GEMINI_API_KEY", clean_key)
    if update.gemini_model is not None:
        clean_model = update.gemini_model.strip()
        settings.GEMINI_MODEL = clean_model
        update_env_file("GEMINI_MODEL", clean_model)
    if update.chunk_size is not None:
        settings.DEFAULT_CHUNK_SIZE = max(100, min(3000, update.chunk_size))
        update_env_file("DEFAULT_CHUNK_SIZE", str(settings.DEFAULT_CHUNK_SIZE))
    if update.chunk_overlap is not None:
        settings.DEFAULT_CHUNK_OVERLAP = max(0, min(500, update.chunk_overlap))
        update_env_file("DEFAULT_CHUNK_OVERLAP", str(settings.DEFAULT_CHUNK_OVERLAP))
    if update.top_k is not None:
        settings.DEFAULT_TOP_K = max(1, min(20, update.top_k))
        update_env_file("DEFAULT_TOP_K", str(settings.DEFAULT_TOP_K))
    if update.similarity_threshold is not None:
        settings.DEFAULT_SIMILARITY_THRESHOLD = max(0.0, min(1.0, update.similarity_threshold))
        update_env_file("DEFAULT_SIMILARITY_THRESHOLD", str(settings.DEFAULT_SIMILARITY_THRESHOLD))
    if update.hybrid_alpha is not None:
        settings.DEFAULT_HYBRID_ALPHA = max(0.0, min(1.0, update.hybrid_alpha))
        update_env_file("DEFAULT_HYBRID_ALPHA", str(settings.DEFAULT_HYBRID_ALPHA))

    return {
        "status": "success",
        "message": "RAG pipeline settings updated successfully",
        "settings": {
            "has_api_key": bool(settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY.strip()) > 5),
            "gemini_model": settings.GEMINI_MODEL,
            "chunk_size": settings.DEFAULT_CHUNK_SIZE,
            "chunk_overlap": settings.DEFAULT_CHUNK_OVERLAP,
            "top_k": settings.DEFAULT_TOP_K,
            "similarity_threshold": settings.DEFAULT_SIMILARITY_THRESHOLD,
            "hybrid_alpha": settings.DEFAULT_HYBRID_ALPHA
        }
    }
