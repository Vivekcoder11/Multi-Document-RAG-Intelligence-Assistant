import os
import uuid
import hashlib
import aiofiles
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query, BackgroundTasks, status
from app.config import settings
from app.auth.security import get_current_user
from app.database import db_manager
from app.documents.models import (
    DocumentResponse, UploadBatchResponse, ReindexRequest,
    DocumentSummaryRequest, DocumentCompareRequest, DocumentQuestionGenRequest
)
from app.documents.extractor import DocumentExtractor
from app.documents.chunker import RecursiveChunker
from app.rag.vector_store import vector_store
from app.rag.generator import RAGGenerator

logger = logging.getLogger("rag_intelligence.documents")
router = APIRouter(prefix="/documents", tags=["Documents"])

async def process_document_pipeline(
    doc_id: str,
    file_path: str,
    file_ext: str,
    filename: str,
    workspace_id: str,
    chunk_size: int = settings.DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = settings.DEFAULT_CHUNK_OVERLAP
):
    """Background task to extract, chunk, embed, and index an uploaded document."""
    try:
        await db_manager.update_document(doc_id, {"status": "processing"})
        
        # 1. Extraction
        pages = DocumentExtractor.extract(file_path, file_ext)
        if not pages:
            await db_manager.update_document(doc_id, {
                "status": "failed",
                "error_message": "Document contains no extractable text or is empty."
            })
            return

        # 2. Intelligent Chunking
        chunker = RecursiveChunker(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        chunks = chunker.chunk_document(
            pages=pages,
            document_id=doc_id,
            filename=filename,
            workspace_id=workspace_id
        )

        if not chunks:
            await db_manager.update_document(doc_id, {
                "status": "failed",
                "error_message": "Could not generate valid chunks from document text."
            })
            return

        # 3. Vector Database Storage (Embedding + Indexing)
        vector_store.delete_document_chunks(workspace_id=workspace_id, document_id=doc_id)
        vector_store.add_chunks(workspace_id=workspace_id, chunks=chunks)

        # 4. Generate short preview text
        preview_text = " ".join([p.text for p in pages[:2]])[:400]

        # 5. Update Document metadata to Indexed
        await db_manager.update_document(doc_id, {
            "status": "indexed",
            "page_count": len(pages),
            "chunk_count": len(chunks),
            "extracted_preview": preview_text,
            "error_message": None
        })
        logger.info(f"Successfully indexed {filename}: {len(pages)} pages, {len(chunks)} chunks.")

    except Exception as e:
        logger.error(f"Error processing document {filename} ({doc_id}): {e}", exc_info=True)
        await db_manager.update_document(doc_id, {
            "status": "failed",
            "error_message": f"Processing failed: {str(e)}"
        })

@router.post("/upload", response_model=UploadBatchResponse)
async def upload_documents(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    workspace_id: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    active_ws = workspace_id or current_user.get("active_workspace_id")
    if not active_ws:
        raise HTTPException(status_code=400, detail="No active workspace found")

    uploaded = []
    failed = []
    duplicate = []

    for file in files:
        filename = file.filename or "unknown"
        ext = filename.split(".")[-1].lower() if "." in filename else ""

        if ext not in settings.ALLOWED_EXTENSIONS:
            failed.append({
                "filename": filename,
                "reason": f"Unsupported format '.{ext}'. Supported: {', '.join(settings.ALLOWED_EXTENSIONS)}"
            })
            continue

        try:
            content = await file.read()
            file_size = len(content)

            # Check file size limit
            if file_size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
                failed.append({
                    "filename": filename,
                    "reason": f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB}MB"
                })
                continue

            if file_size == 0:
                failed.append({"filename": filename, "reason": "Uploaded file is 0 bytes."})
                continue

            # Duplicate detection via SHA-256 hash
            file_hash = hashlib.sha256(content).hexdigest()
            existing_doc = await db_manager.find_document_by_hash(active_ws, file_hash)
            if existing_doc:
                duplicate.append({
                    "filename": filename,
                    "existing_id": existing_doc["id"],
                    "reason": "Duplicate file detected in this workspace"
                })
                continue

            doc_id = str(uuid.uuid4())
            safe_filename = f"{doc_id}_{filename}"
            save_path = os.path.join(settings.UPLOAD_DIR, safe_filename)

            # Save file to disk
            async with aiofiles.open(save_path, "wb") as f:
                await f.write(content)

            doc_data = {
                "id": doc_id,
                "filename": filename,
                "file_type": ext,
                "file_size": file_size,
                "file_hash": file_hash,
                "file_path": save_path,
                "page_count": 0,
                "chunk_count": 0,
                "status": "processing",
                "error_message": None,
                "workspace_id": active_ws,
                "user_id": current_user["id"],
                "summary": None,
                "extracted_preview": None
            }
            created_doc = await db_manager.create_document(doc_data)

            # Enqueue background extraction and indexing
            background_tasks.add_task(
                process_document_pipeline,
                doc_id=doc_id,
                file_path=save_path,
                file_ext=ext,
                filename=filename,
                workspace_id=active_ws
            )

            uploaded.append(DocumentResponse(**created_doc))

        except Exception as e:
            logger.error(f"Failed to upload file {filename}: {e}")
            failed.append({"filename": filename, "reason": str(e)})

    return UploadBatchResponse(uploaded=uploaded, failed=failed, duplicate=duplicate)

@router.get("", response_model=List[DocumentResponse])
async def list_documents(
    workspace_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    active_ws = workspace_id or current_user.get("active_workspace_id")
    docs = await db_manager.get_documents(active_ws, search=search)
    if status:
        docs = [d for d in docs if d.get("status") == status]
    return [DocumentResponse(**d) for d in docs]

@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    doc = await db_manager.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentResponse(**doc)

@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    doc = await db_manager.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    ws_id = doc.get("workspace_id")
    # Delete chunks from vector store
    vector_store.delete_document_chunks(workspace_id=ws_id, document_id=document_id)

    # Delete disk file
    file_path = doc.get("file_path")
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            logger.warning(f"Failed to remove file from disk {file_path}: {e}")

    # Remove from database
    await db_manager.delete_document(document_id)
    return {"status": "success", "message": "Document deleted successfully"}

@router.post("/{document_id}/reindex", response_model=DocumentResponse)
async def reindex_document(
    document_id: str,
    req: ReindexRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    doc = await db_manager.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = doc.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=400, detail="Original document file not found on disk")

    background_tasks.add_task(
        process_document_pipeline,
        doc_id=document_id,
        file_path=file_path,
        file_ext=doc.get("file_type"),
        filename=doc.get("filename"),
        workspace_id=doc.get("workspace_id"),
        chunk_size=req.chunk_size or settings.DEFAULT_CHUNK_SIZE,
        chunk_overlap=req.chunk_overlap or settings.DEFAULT_CHUNK_OVERLAP
    )

    doc["status"] = "processing"
    return DocumentResponse(**doc)

@router.post("/summary")
async def summarize_documents(
    req: DocumentSummaryRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Generates an executive summary across one or multiple documents."""
    active_ws = current_user.get("active_workspace_id")
    chunks = vector_store.get_all_chunks(workspace_id=active_ws, document_ids=req.document_ids)
    if not chunks:
        raise HTTPException(status_code=400, detail="No indexed chunks found for the selected documents")

    # Limit to top representative chunks
    from app.rag.hybrid_search import HybridSearchResult
    synthetic_chunks = [
        HybridSearchResult(
            chunk_id=c["chunk_id"],
            text=c["text"],
            metadata=c["metadata"],
            score=0.9,
            semantic_score=0.9,
            keyword_score=0.9
        )
        for c in chunks[:10]
    ]

    prompt = f"Please provide a {req.max_length} summary covering the key findings, methodologies, conclusions, and notable figures across these documents."
    ans = await RAGGenerator.generate_response(query=prompt, chunks=synthetic_chunks)
    return ans.to_dict()

@router.post("/compare")
async def compare_documents(
    req: DocumentCompareRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Performs side-by-side comparative analysis of selected documents."""
    if len(req.document_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 documents must be selected for comparison")

    active_ws = current_user.get("active_workspace_id")
    chunks = vector_store.get_all_chunks(workspace_id=active_ws, document_ids=req.document_ids)
    if not chunks:
        raise HTTPException(status_code=400, detail="No indexed chunks found for the selected documents")

    from app.rag.hybrid_search import HybridSearchResult
    synthetic_chunks = [
        HybridSearchResult(
            chunk_id=c["chunk_id"],
            text=c["text"],
            metadata=c["metadata"],
            score=0.9,
            semantic_score=0.9,
            keyword_score=0.9
        )
        for c in chunks[:12]
    ]

    focus = f" specifically focusing on {req.focus_topic}" if req.focus_topic else ""
    prompt = f"Compare and contrast the selected documents{focus}. Highlight key similarities, distinct differences, opposing perspectives, and unique contributions with clear comparative sections."
    ans = await RAGGenerator.generate_response(query=prompt, chunks=synthetic_chunks)
    return ans.to_dict()

@router.post("/generate-questions")
async def generate_questions(
    req: DocumentQuestionGenRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Generates insightful comprehension and analytical questions from documents."""
    active_ws = current_user.get("active_workspace_id")
    chunks = vector_store.get_all_chunks(workspace_id=active_ws, document_ids=req.document_ids)
    if not chunks:
        raise HTTPException(status_code=400, detail="No indexed chunks found for the selected documents")

    from app.rag.hybrid_search import HybridSearchResult
    synthetic_chunks = [
        HybridSearchResult(
            chunk_id=c["chunk_id"],
            text=c["text"],
            metadata=c["metadata"],
            score=0.9,
            semantic_score=0.9,
            keyword_score=0.9
        )
        for c in chunks[:8]
    ]

    prompt = f"Generate {req.count} insightful, thought-provoking {req.question_type} questions that test deep understanding of these documents. Include brief answer hints with source document citations."
    ans = await RAGGenerator.generate_response(query=prompt, chunks=synthetic_chunks)
    return ans.to_dict()
