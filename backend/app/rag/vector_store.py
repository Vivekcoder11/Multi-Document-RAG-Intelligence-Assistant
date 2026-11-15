import os
import logging
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.config import settings
from app.rag.embeddings import rag_embedding_fn
from app.documents.chunker import DocumentChunk

logger = logging.getLogger("rag_intelligence.vector_store")

class VectorStoreManager:
    def __init__(self):
        self._client = None
        self._collections: Dict[str, Any] = {}

    def _get_client(self):
        if self._client is None:
            os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
            self._client = chromadb.PersistentClient(
                path=settings.CHROMA_PERSIST_DIR,
                settings=ChromaSettings(anonymized_telemetry=False)
            )
        return self._client

    def _get_collection_name(self, workspace_id: str) -> str:
        safe_id = workspace_id.replace("-", "_").lower()
        return f"ws_{safe_id}"

    def get_collection(self, workspace_id: str):
        col_name = self._get_collection_name(workspace_id)
        if col_name not in self._collections:
            client = self._get_client()
            col = client.get_or_create_collection(
                name=col_name,
                embedding_function=rag_embedding_fn,
                metadata={"hnsw:space": "cosine"}
            )
            self._collections[col_name] = col
        return self._collections[col_name]

    def add_chunks(self, workspace_id: str, chunks: List[DocumentChunk]):
        if not chunks:
            return
        col = self.get_collection(workspace_id)
        
        batch_size = 200
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            ids = [c.chunk_id for c in batch]
            documents = [c.text for c in batch]
            metadatas = [
                {
                    "document_id": c.document_id,
                    "filename": c.filename,
                    "workspace_id": c.workspace_id,
                    "page_number": c.page_number,
                    "chunk_index": c.chunk_index,
                    "char_count": c.char_count,
                    "token_count": c.token_count
                }
                for c in batch
            ]
            col.add(ids=ids, documents=documents, metadatas=metadatas)

    def delete_document_chunks(self, workspace_id: str, document_id: str):
        try:
            col = self.get_collection(workspace_id)
            col.delete(where={"document_id": document_id})
        except Exception as e:
            logger.warning(f"Error deleting chunks for doc {document_id}: {e}")

    def query_semantic(
        self,
        workspace_id: str,
        query: str,
        top_k: int = 5,
        document_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        col = self.get_collection(workspace_id)
        if col.count() == 0:
            return []
            
        where_filter = None
        if document_ids:
            if len(document_ids) == 1:
                where_filter = {"document_id": document_ids[0]}
            elif len(document_ids) > 1:
                where_filter = {"document_id": {"$in": document_ids}}
                
        n_results = min(top_k * 2, col.count())
        try:
            results = col.query(
                query_texts=[query],
                n_results=n_results,
                where=where_filter,
                include=["documents", "metadatas", "distances"]
            )
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return []
            
        items = []
        if results and results.get("ids") and results["ids"][0]:
            ids = results["ids"][0]
            docs = results["documents"][0]
            metas = results["metadatas"][0]
            distances = results.get("distances", [[]])[0]
            
            for idx in range(len(ids)):
                dist = distances[idx] if idx < len(distances) else 0.5
                # Cosine distance to similarity: similarity = 1 - distance / 2
                sim_score = max(0.0, min(1.0, 1.0 - (dist / 2.0)))
                items.append({
                    "chunk_id": ids[idx],
                    "text": docs[idx],
                    "metadata": metas[idx],
                    "score": sim_score
                })
                
        return items

    def get_all_chunks(
        self,
        workspace_id: str,
        document_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        col = self.get_collection(workspace_id)
        if col.count() == 0:
            return []
            
        where_filter = None
        if document_ids:
            if len(document_ids) == 1:
                where_filter = {"document_id": document_ids[0]}
            elif len(document_ids) > 1:
                where_filter = {"document_id": {"$in": document_ids}}
                
        try:
            results = col.get(
                where=where_filter,
                include=["documents", "metadatas"]
            )
        except Exception as e:
            logger.error(f"Error fetching chunks from collection: {e}")
            return []
            
        items = []
        if results and results.get("ids"):
            ids = results["ids"]
            docs = results["documents"]
            metas = results["metadatas"]
            for i in range(len(ids)):
                items.append({
                    "chunk_id": ids[i],
                    "text": docs[i],
                    "metadata": metas[i]
                })
        return items

    def count(self, workspace_id: str) -> int:
        try:
            col = self.get_collection(workspace_id)
            return col.count()
        except Exception:
            return 0

vector_store = VectorStoreManager()
