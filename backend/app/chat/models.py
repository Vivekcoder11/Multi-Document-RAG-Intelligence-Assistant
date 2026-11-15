from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class ChatMessageRequest(BaseModel):
    session_id: Optional[str] = None
    message: str = Field(..., min_length=1)
    workspace_id: Optional[str] = None
    document_ids: Optional[List[str]] = None
    top_k: Optional[int] = 5
    similarity_threshold: Optional[float] = 0.35
    hybrid_alpha: Optional[float] = 0.65
    gemini_model: Optional[str] = None

class CitationModel(BaseModel):
    id: Optional[str] = None
    document_id: str
    filename: str
    page_number: int
    chunk_id: str
    excerpt: str
    score: float

class ChatMessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    timestamp: str
    citations: Optional[List[CitationModel]] = None
    latency_ms: Optional[float] = None
    model_used: Optional[str] = None
    retrieval_count: Optional[int] = None

class ChatSessionCreate(BaseModel):
    title: Optional[str] = "New Conversation"
    workspace_id: Optional[str] = None

class ChatSessionResponse(BaseModel):
    id: str
    title: str
    workspace_id: str
    created_at: str
    updated_at: str
    message_count: int
    preview: Optional[str] = None

class PDFExportRequest(BaseModel):
    title: Optional[str] = "Document Intelligence Analysis"
    query: str
    answer: str
    citations: Optional[List[Dict[str, Any]]] = []
