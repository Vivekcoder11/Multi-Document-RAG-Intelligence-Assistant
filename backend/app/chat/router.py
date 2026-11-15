import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from app.config import settings
from app.auth.security import get_current_user
from app.database import db_manager
from app.chat.models import (
    ChatMessageRequest, ChatMessageResponse, ChatSessionCreate,
    ChatSessionResponse, PDFExportRequest
)
from app.rag.hybrid_search import HybridSearchEngine
from app.rag.generator import RAGGenerator
from app.utils.export_pdf import generate_pdf_report

router = APIRouter(prefix="/chat", tags=["Chat & Conversational Intelligence"])

@router.post("", response_model=ChatMessageResponse)
async def send_chat_message(
    req: ChatMessageRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    active_ws = req.workspace_id or current_user.get("active_workspace_id")
    if not active_ws:
        raise HTTPException(status_code=400, detail="No active workspace found")

    # 1. Ensure or create Session
    session_id = req.session_id
    if not session_id:
        session_id = str(uuid.uuid4())
        # Use first 40 chars of message as initial title
        session_title = req.message[:38] + "..." if len(req.message) > 38 else req.message
        session_data = {
            "id": session_id,
            "title": session_title,
            "workspace_id": active_ws,
            "user_id": current_user["id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "message_count": 0,
            "preview": req.message[:60]
        }
        await db_manager.create_chat_session(session_data)
    else:
        session = await db_manager.get_chat_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")

    # 2. Save User Message
    user_msg_id = str(uuid.uuid4())
    user_msg_data = {
        "id": user_msg_id,
        "session_id": session_id,
        "role": "user",
        "content": req.message,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db_manager.create_chat_message(user_msg_data)

    # 3. Retrieve prior chat history for conversational context
    history_messages = await db_manager.get_chat_messages(session_id)
    
    # 4. Hybrid Retrieval (Semantic Vector + BM25 Keyword Search + Reranking)
    top_k = req.top_k or settings.DEFAULT_TOP_K
    similarity_thresh = req.similarity_threshold or settings.DEFAULT_SIMILARITY_THRESHOLD
    hybrid_alpha = req.hybrid_alpha if req.hybrid_alpha is not None else settings.DEFAULT_HYBRID_ALPHA

    retrieved_chunks = HybridSearchEngine.search(
        workspace_id=active_ws,
        query=req.message,
        top_k=top_k,
        similarity_threshold=similarity_thresh,
        hybrid_alpha=hybrid_alpha,
        document_ids=req.document_ids
    )

    # 5. Generate Grounded AI Response
    rag_result = await RAGGenerator.generate_response(
        query=req.message,
        chunks=retrieved_chunks,
        chat_history=history_messages,
        model_name=req.gemini_model or settings.GEMINI_MODEL
    )

    # 6. Save Assistant Message with Citations
    assistant_msg_id = str(uuid.uuid4())
    assistant_msg_data = {
        "id": assistant_msg_id,
        "session_id": session_id,
        "role": "assistant",
        "content": rag_result.answer,
        "citations": rag_result.citations,
        "latency_ms": rag_result.latency_ms,
        "model_used": rag_result.model_used,
        "retrieval_count": rag_result.retrieval_count,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db_manager.create_chat_message(assistant_msg_data)

    # 7. Record Analytics Event
    cited_docs = list(set([c.get("filename") for c in rag_result.citations if c.get("filename")]))
    retrieved_docs = list(set([c.metadata.get("filename") for c in retrieved_chunks if c.metadata.get("filename")]))
    await db_manager.log_analytics_event({
        "type": "rag_query",
        "workspace_id": active_ws,
        "user_id": current_user["id"],
        "session_id": session_id,
        "query": req.message,
        "retrieval_count": len(retrieved_chunks),
        "citation_count": len(rag_result.citations),
        "cited_documents": cited_docs,
        "retrieved_documents": retrieved_docs,
        "latency_ms": rag_result.latency_ms,
        "model_used": rag_result.model_used
    })

    return ChatMessageResponse(**assistant_msg_data)

@router.get("/sessions", response_model=List[ChatSessionResponse])
async def list_chat_sessions(
    workspace_id: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    active_ws = workspace_id or current_user.get("active_workspace_id")
    sessions = await db_manager.get_chat_sessions(active_ws)
    return [ChatSessionResponse(**s) for s in sessions]

@router.post("/sessions", response_model=ChatSessionResponse)
async def create_new_session(
    body: ChatSessionCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    active_ws = body.workspace_id or current_user.get("active_workspace_id")
    now = datetime.now(timezone.utc).isoformat()
    sess_id = str(uuid.uuid4())
    data = {
        "id": sess_id,
        "title": body.title or "New Conversation",
        "workspace_id": active_ws,
        "user_id": current_user["id"],
        "created_at": now,
        "updated_at": now,
        "message_count": 0,
        "preview": ""
    }
    created = await db_manager.create_chat_session(data)
    return ChatSessionResponse(**created)

@router.get("/sessions/{session_id}/messages", response_model=List[ChatMessageResponse])
async def get_session_messages(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    session = await db_manager.get_chat_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = await db_manager.get_chat_messages(session_id)
    return [ChatMessageResponse(**m) for m in messages]

@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    session = await db_manager.get_chat_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db_manager.delete_chat_session(session_id)
    return {"status": "success", "message": "Session deleted"}

@router.post("/sessions/{session_id}/clear")
async def clear_session(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    session = await db_manager.get_chat_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db_manager.clear_chat_messages(session_id)
    return {"status": "success", "message": "Session messages cleared"}

@router.post("/export-pdf")
async def export_chat_pdf(
    body: PDFExportRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Generates a downloadable PDF report for a chat answer and its citations."""
    pdf_buffer = generate_pdf_report(
        title=body.title or "RAG Document Intelligence Report",
        query=body.query,
        answer=body.answer,
        citations=body.citations or []
    )
    safe_filename = "rag_intelligence_report.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={safe_filename}"}
    )
