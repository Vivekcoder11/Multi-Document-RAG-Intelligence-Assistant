from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class DocumentResponse(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size: int
    page_count: int
    chunk_count: int
    status: str
    error_message: Optional[str] = None
    workspace_id: str
    created_at: str
    updated_at: str
    summary: Optional[str] = None
    extracted_preview: Optional[str] = None

class UploadBatchResponse(BaseModel):
    uploaded: List[DocumentResponse]
    failed: List[Dict[str, str]]
    duplicate: List[Dict[str, str]]

class ReindexRequest(BaseModel):
    chunk_size: Optional[int] = 800
    chunk_overlap: Optional[int] = 150

class DocumentSummaryRequest(BaseModel):
    document_ids: List[str]
    max_length: Optional[str] = "comprehensive"  # short, comprehensive, bullet_points

class DocumentCompareRequest(BaseModel):
    document_ids: List[str]
    focus_topic: Optional[str] = None

class DocumentQuestionGenRequest(BaseModel):
    document_ids: List[str]
    count: Optional[int] = 5
    question_type: Optional[str] = "comprehension" # comprehension, conceptual, technical
