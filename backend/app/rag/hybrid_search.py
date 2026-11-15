import re
import math
from typing import List, Dict, Any, Optional
from rank_bm25 import BM25Okapi
from app.rag.vector_store import vector_store

class HybridSearchResult:
    def __init__(
        self,
        chunk_id: str,
        text: str,
        metadata: Dict[str, Any],
        score: float,
        semantic_score: float,
        keyword_score: float
    ):
        self.chunk_id = chunk_id
        self.text = text
        self.metadata = metadata
        self.score = score
        self.semantic_score = semantic_score
        self.keyword_score = keyword_score

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunk_id": self.chunk_id,
            "text": self.text,
            "metadata": self.metadata,
            "score": round(self.score, 4),
            "semantic_score": round(self.semantic_score, 4),
            "keyword_score": round(self.keyword_score, 4),
            "document_id": self.metadata.get("document_id"),
            "filename": self.metadata.get("filename"),
            "page_number": self.metadata.get("page_number", 1)
        }

class HybridSearchEngine:
    @staticmethod
    def _tokenize(text: str) -> List[str]:
        return re.findall(r'\b\w+\b', text.lower())

    @classmethod
    def search(
        cls,
        workspace_id: str,
        query: str,
        top_k: int = 5,
        similarity_threshold: float = 0.3,
        hybrid_alpha: float = 0.65,
        document_ids: Optional[List[str]] = None,
        max_context_chars: int = 14000
    ) -> List[HybridSearchResult]:
        """
        Executes hybrid search combining Vector Semantic Search and BM25 Keyword Search,
        followed by Reciprocal Rank Fusion (RRF) and context deduplication.
        """
        if not query.strip():
            return []

        # 1. Semantic Search
        semantic_candidates = vector_store.query_semantic(
            workspace_id=workspace_id,
            query=query,
            top_k=top_k * 3,
            document_ids=document_ids
        )
        semantic_map: Dict[str, Dict[str, Any]] = {
            item["chunk_id"]: item for item in semantic_candidates
        }

        # 2. BM25 Keyword Search
        all_chunks = vector_store.get_all_chunks(workspace_id=workspace_id, document_ids=document_ids)
        keyword_scores_map: Dict[str, float] = {}

        if all_chunks:
            tokenized_corpus = [cls._tokenize(chunk["text"]) for chunk in all_chunks]
            query_tokens = cls._tokenize(query)
            
            if any(query_tokens):
                bm25 = BM25Okapi(tokenized_corpus)
                raw_bm25_scores = bm25.get_scores(query_tokens)
                
                max_bm25 = max(raw_bm25_scores) if len(raw_bm25_scores) > 0 and max(raw_bm25_scores) > 0 else 1.0
                for idx, chunk in enumerate(all_chunks):
                    normalized_bm25 = max(0.0, float(raw_bm25_scores[idx]) / max_bm25)
                    if normalized_bm25 > 0.05:
                        keyword_scores_map[chunk["chunk_id"]] = normalized_bm25

        # 3. Candidate Fusion (Reciprocal Rank Fusion + Weighted Hybrid Scoring)
        all_candidate_ids = set(semantic_map.keys()).union(set(keyword_scores_map.keys()))
        if not all_candidate_ids:
            return []

        chunk_lookup = {c["chunk_id"]: c for c in all_chunks}
        # Sorted ranks for RRF
        sorted_semantic_ids = [c["chunk_id"] for c in sorted(semantic_candidates, key=lambda x: x["score"], reverse=True)]
        sorted_keyword_ids = [cid for cid, s in sorted(keyword_scores_map.items(), key=lambda x: x[1], reverse=True)]

        fused_results: List[HybridSearchResult] = []
        k_rrf = 60.0

        query_lower = query.lower()
        exact_phrases = re.findall(r'"([^"]*)"', query_lower)

        for cid in all_candidate_ids:
            # Semantic score & rank
            s_score = semantic_map[cid]["score"] if cid in semantic_map else 0.0
            s_rank = sorted_semantic_ids.index(cid) if cid in sorted_semantic_ids else 999
            
            # Keyword score & rank
            k_score = keyword_scores_map.get(cid, 0.0)
            k_rank = sorted_keyword_ids.index(cid) if cid in sorted_keyword_ids else 999

            # Base weighted score
            weighted_score = (hybrid_alpha * s_score) + ((1.0 - hybrid_alpha) * k_score)
            
            # RRF Rank bonus
            rrf_score = (1.0 / (k_rrf + s_rank)) + (1.0 / (k_rrf + k_rank))
            normalized_rrf = min(1.0, rrf_score * 30.0)

            # Combined score
            final_score = (0.75 * weighted_score) + (0.25 * normalized_rrf)

            # Chunk metadata & text
            chunk_data = chunk_lookup.get(cid) or semantic_map.get(cid)
            if not chunk_data:
                continue

            text = chunk_data.get("text", "")
            meta = chunk_data.get("metadata", {})

            # Exact phrase match booster
            if exact_phrases:
                for phrase in exact_phrases:
                    if phrase and phrase in text.lower():
                        final_score += 0.15

            if final_score >= similarity_threshold:
                fused_results.append(
                    HybridSearchResult(
                        chunk_id=cid,
                        text=text,
                        metadata=meta,
                        score=final_score,
                        semantic_score=s_score,
                        keyword_score=k_score
                    )
                )

        # 4. Sort by final score descending
        fused_results.sort(key=lambda x: x.score, reverse=True)

        # 5. Context window management & deduplication
        chosen_results = []
        accumulated_chars = 0
        seen_texts = set()

        for item in fused_results:
            # Deduplicate nearly identical texts
            short_sig = item.text[:120].strip()
            if short_sig in seen_texts:
                continue

            if accumulated_chars + len(item.text) > max_context_chars:
                if len(chosen_results) >= 2:
                    break  # Stop when context limit reached
                    
            seen_texts.add(short_sig)
            chosen_results.append(item)
            accumulated_chars += len(item.text)

            if len(chosen_results) >= top_k:
                break

        return chosen_results
