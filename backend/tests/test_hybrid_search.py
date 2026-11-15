import pytest
from app.rag.vector_store import vector_store
from app.rag.hybrid_search import HybridSearchEngine
from app.documents.chunker import DocumentChunk

def test_hybrid_search_scoring():
    ws_id = "test_hybrid_ws"
    # Seed chunks
    c1 = DocumentChunk(
        chunk_id="chunk_alpha_1",
        document_id="doc_ai_1",
        filename="ai_overview.pdf",
        workspace_id=ws_id,
        page_number=1,
        chunk_index=0,
        text="Quantum computing uses qubits and superposition to process information at high speeds.",
        char_count=85,
        token_count=20
    )
    c2 = DocumentChunk(
        chunk_id="chunk_alpha_2",
        document_id="doc_ai_2",
        filename="biology_overview.pdf",
        workspace_id=ws_id,
        page_number=3,
        chunk_index=0,
        text="Photosynthesis is the process by which green plants synthesize nutrients from carbon dioxide and sunlight.",
        char_count=105,
        token_count=25
    )
    
    vector_store.delete_document_chunks(ws_id, "doc_ai_1")
    vector_store.delete_document_chunks(ws_id, "doc_ai_2")
    vector_store.add_chunks(ws_id, [c1, c2])
    
    # Query for quantum
    results = HybridSearchEngine.search(
        workspace_id=ws_id,
        query="superposition and qubits quantum computing",
        top_k=2,
        similarity_threshold=0.2
    )
    
    assert len(results) > 0
    assert results[0].chunk_id == "chunk_alpha_1"
    assert results[0].metadata.get("filename") == "ai_overview.pdf"
    assert results[0].score > 0.3
