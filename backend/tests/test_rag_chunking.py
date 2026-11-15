import os
import pytest
from app.documents.extractor import DocumentExtractor, ExtractedPage
from app.documents.chunker import RecursiveChunker

def test_recursive_chunking_with_metadata():
    text = (
        "Retrieval-Augmented Generation (RAG) is an architecture that optimizes the output of a "
        "Large Language Model by referencing an authoritative knowledge base. "
        "The model uses retrieved document context to synthesize accurate answers. "
        "Vector databases store dense embeddings for semantic search. "
        "Hybrid retrieval merges BM25 keyword matching with dense vectors. "
        "This prevents hallucinations and provides verifiable citations."
    )
    pages = [ExtractedPage(page_number=1, text=text)]
    chunker = RecursiveChunker(chunk_size=120, chunk_overlap=30)
    
    chunks = chunker.chunk_document(
        pages=pages,
        document_id="doc-test-123",
        filename="rag_spec.md",
        workspace_id="ws-test-456"
    )
    
    assert len(chunks) >= 2
    for c in chunks:
        assert c.document_id == "doc-test-123"
        assert c.filename == "rag_spec.md"
        assert c.workspace_id == "ws-test-456"
        assert c.page_number == 1
        assert len(c.text) > 0
        assert c.char_count == len(c.text)
        assert c.token_count > 0

def test_text_extractor():
    sample_path = "backend/data/sample_test.txt"
    os.makedirs(os.path.dirname(sample_path), exist_ok=True)
    with open(sample_path, "w", encoding="utf-8") as f:
        f.write("Line 1 of sample document.\nLine 2 with details.\nLine 3 conclusion.")
        
    pages = DocumentExtractor.extract(sample_path, "txt")
    assert len(pages) == 1
    assert "Line 1 of sample document" in pages[0].text
    assert pages[0].page_number == 1
    
    if os.path.exists(sample_path):
        os.remove(sample_path)
