import re
import json
import numpy as np
import logging
import httpx
from typing import List
from chromadb.api.types import EmbeddingFunction, Documents, Embeddings
from app.config import settings

logger = logging.getLogger("rag_intelligence.embeddings")

_BATCH_EMBED_REST_URL = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents"

class CustomRAGEmbeddingFunction(EmbeddingFunction[Documents]):
    """
    High-performance, robust embedding function compliant with ChromaDB EmbeddingFunction.
    Supports Google Gemini API embeddings (text-embedding-004) with automatic fallback
    to dense normalized semantic hashing with subword n-grams.
    """
    def __init__(self, dimension: int = 384):
        self.dimension = dimension

    def name(self) -> str:
        return "custom_rag_hybrid_embedding"

    def _embed_local_text(self, text: str) -> List[float]:
        tokens = re.findall(r'\b[a-zA-Z0-9_\-]+\b', text.lower())
        vec = np.zeros(self.dimension, dtype=np.float32)
        
        for t in tokens:
            idx = abs(hash(t)) % self.dimension
            vec[idx] += 1.0
            if len(t) >= 3:
                for i in range(len(t) - 2):
                    sub = t[i:i+3]
                    sub_idx = abs(hash(sub)) % self.dimension
                    vec[sub_idx] += 0.4
                    
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        else:
            vec[0] = 1.0
            
        return vec.tolist()

    def _embed_gemini_sdk(self, texts: List[str], api_key: str) -> List[List[float]]:
        from google import genai
        client = genai.Client(api_key=api_key.strip())
        response = client.models.embed_content(
            model="text-embedding-004",
            contents=texts
        )
        if hasattr(response, "embeddings") and response.embeddings:
            return [e.values for e in response.embeddings]
        raise ValueError("No embeddings returned from google.genai SDK")

    def _embed_gemini_rest(self, texts: List[str], api_key: str) -> List[List[float]]:
        key_stripped = api_key.strip()
        requests_list = [
            {
                "model": "models/text-embedding-004",
                "content": {"parts": [{"text": t[:8000]}]}
            }
            for t in texts
        ]
        payload = {"requests": requests_list}
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": key_stripped,
        }
        url = f"{_BATCH_EMBED_REST_URL}?key={key_stripped}"

        response = httpx.post(url, headers=headers, json=payload, timeout=30.0)
        if response.status_code != 200:
            raise ValueError(f"HTTP {response.status_code}: {response.text[:200]}")

        data = response.json()
        embeddings_data = data.get("embeddings", [])
        if not embeddings_data:
            raise ValueError("Empty embeddings in response")

        return [e.get("values", []) for e in embeddings_data]

    def _embed_gemini(self, texts: List[str]) -> List[List[float]]:
        api_key = (settings.GEMINI_API_KEY or "").strip()
        if not api_key:
            raise ValueError("No Gemini API key")

        # 1. Try SDK
        try:
            return self._embed_gemini_sdk(texts, api_key)
        except Exception as e1:
            logger.debug(f"Gemini embedding SDK attempt failed: {e1}")

        # 2. Try REST
        try:
            return self._embed_gemini_rest(texts, api_key)
        except Exception as e2:
            logger.debug(f"Gemini embedding REST attempt failed: {e2}")

        raise ValueError("All Gemini embedding strategies failed")

    def __call__(self, input: Documents) -> Embeddings:
        if isinstance(input, str):
            input = [input]
            
        if settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY.strip()) > 5:
            try:
                return self._embed_gemini(input)
            except Exception as e:
                logger.debug(f"Gemini embedding fallback to local vectorizer: {e}")
                
        return [self._embed_local_text(t) for t in input]


rag_embedding_fn = CustomRAGEmbeddingFunction()
