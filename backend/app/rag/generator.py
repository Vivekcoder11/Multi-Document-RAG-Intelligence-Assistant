import os
import re
import time
import json
import logging
import asyncio
import httpx
from typing import List, Dict, Any, Optional
from app.config import settings
from app.rag.hybrid_search import HybridSearchResult

logger = logging.getLogger("rag_intelligence.generator")

_GEMINI_REST_BASE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

# Fast, verified operational Gemini models (sorted by response speed)
ACTIVE_MODELS = [
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash"
]

class RAGAnswer:
    def __init__(
        self,
        answer: str,
        citations: List[Dict[str, Any]],
        latency_ms: float,
        model_used: str,
        retrieval_count: int
    ):
        self.answer = answer
        self.citations = citations
        self.latency_ms = latency_ms
        self.model_used = model_used
        self.retrieval_count = retrieval_count

    def to_dict(self) -> Dict[str, Any]:
        return {
            "answer": self.answer,
            "citations": self.citations,
            "latency_ms": self.latency_ms,
            "model_used": self.model_used,
            "retrieval_count": self.retrieval_count
        }


class RAGGenerator:
    SYSTEM_PROMPT = """You are an advanced Multi-Document RAG Intelligence Assistant.
Your mission is to provide accurate, truthful, and well-structured answers strictly grounded in the provided document context.

CRITICAL INSTRUCTIONS:
1. Strict Grounding: Answer ONLY based on the facts explicitly mentioned in the context below. Do not use outside assumptions.
2. Language Adaptability (Hinglish, Hindi, English):
   - Automatically match the user's language and tone.
   - If the user asks in Hinglish (Hindi written in Roman/Latin script, e.g. "Is document me kya hai?", "Mera experience aur projects explain karo", "Summary bataiye"), respond naturally in clean, polite conversational Hinglish.
   - If the user asks in English, respond in English.
   - If the user asks in Hindi (Devanagari), respond in Hindi.
   - Keep all technical terms, architecture names, metrics, and filenames in their original standard English format.
3. Explicit Citations: Whenever you state a fact or quote from a document, immediately follow it with an inline citation tag: `[Doc: <filename>, Page: <page_number>]`.
4. Honest Refusal: If the provided excerpts do not contain enough information to answer the question, clearly state: "Based on the provided documents, I could not find information regarding [topic]." (Or in Hinglish: "Provided documents ke hisaab se, mujhe [topic] ke baare me koi information nahi mili.")
5. Comparative Analysis: When asked to compare or find differences across documents, present comparisons with clear headings, bullet points, or tables.
6. Tone: Professional, analytical, helpful, and structured.
"""

    @classmethod
    def _build_context_prompt(
        cls,
        query: str,
        chunks: List[HybridSearchResult],
        chat_history: Optional[List[Dict[str, Any]]] = None
    ) -> str:
        context_parts = []
        for idx, chunk in enumerate(chunks, 1):
            fname = chunk.metadata.get("filename", "Unknown")
            pnum = chunk.metadata.get("page_number", 1)
            context_parts.append(
                f"--- EXCERPT [{idx}] ---\n"
                f"Document: {fname}\n"
                f"Page: {pnum}\n"
                f"Content:\n{chunk.text.strip()}\n"
            )

        context_str = "\n".join(context_parts) if context_parts else "No relevant documents found in workspace."

        history_str = ""
        if chat_history:
            recent_turns = chat_history[-4:]
            formatted_turns = []
            for turn in recent_turns:
                role = "User" if turn.get("role") == "user" else "Assistant"
                formatted_turns.append(f"{role}: {turn.get('content', '')}")
            history_str = "CONVERSATION HISTORY:\n" + "\n".join(formatted_turns) + "\n\n"

        prompt = (
            f"{cls.SYSTEM_PROMPT}\n\n"
            f"{history_str}"
            f"PROVIDED DOCUMENT CONTEXT:\n"
            f"{context_str}\n\n"
            f"USER QUESTION: {query}\n\n"
            f"ANSWER (with exact inline citations [Doc: <filename>, Page: <page>]):"
        )
        return prompt

    @classmethod
    def _build_citations(cls, chunks: List[HybridSearchResult], answer_text: str) -> List[Dict[str, Any]]:
        citations = []
        seen_keys = set()

        for chunk in chunks:
            fname = chunk.metadata.get("filename", "")
            pnum = chunk.metadata.get("page_number", 1)
            doc_id = chunk.metadata.get("document_id", "")
            cid = chunk.chunk_id

            key = f"{doc_id}_{pnum}"
            if key in seen_keys:
                continue

            cited_in_text = (fname.lower() in answer_text.lower()) or (f"page {pnum}" in answer_text.lower())
            if cited_in_text or chunk.score >= 0.40 or len(citations) < 3:
                seen_keys.add(key)
                sentences = re.split(r'(?<=[.!?])\s+', chunk.text.strip())
                excerpt = " ".join(sentences[:2])
                if len(excerpt) > 280:
                    excerpt = excerpt[:277] + "..."

                citations.append({
                    "id": f"cit_{len(citations) + 1}",
                    "document_id": doc_id,
                    "filename": fname,
                    "page_number": pnum,
                    "chunk_id": cid,
                    "excerpt": excerpt,
                    "score": round(chunk.score, 3)
                })

        return citations

    @classmethod
    def _call_gemini_rest_sync(cls, api_key: str, model: str, prompt: str) -> str:
        """
        Direct REST call to Gemini API with strict 15-second timeout.
        Fast, reliable, works with all Gemini authorization keys.
        """
        key_clean = api_key.strip()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key_clean}"
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": key_clean,
        }
        payload = {
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "topK": 40,
                "topP": 0.95,
                "maxOutputTokens": 2048,
            }
        }

        with httpx.Client(timeout=15.0) as client:
            response = client.post(url, headers=headers, json=payload)
            if response.status_code != 200:
                raise ValueError(f"HTTP {response.status_code}: {response.text[:300]}")

            data = response.json()
            candidates = data.get("candidates", [])
            if not candidates:
                feedback = data.get("promptFeedback", {})
                block_reason = feedback.get("blockReason", "")
                if block_reason:
                    raise ValueError(f"Blocked by safety filter: {block_reason}")
                raise ValueError("No candidates returned from Gemini API")

            parts = candidates[0].get("content", {}).get("parts", [])
            text = "".join(p.get("text", "") for p in parts).strip()
            if not text:
                raise ValueError("Candidate contained empty text")
            return text

    @classmethod
    def _local_synthesis(cls, query: str, chunks: List[HybridSearchResult], failure_reason: Optional[str] = None) -> str:
        """
        Deterministic, local extractive synthesis when Gemini API key is not configured or unavailable.
        """
        if not chunks:
            return (
                "Based on the provided documents, I could not find information regarding your query.\n\n"
                "> 💡 **Setup Note:** Upload relevant documents or add your `GEMINI_API_KEY` in **Settings**."
            )

        query_words = set(re.findall(r'\b[a-zA-Z0-9_\-\.]{2,}\b', query.lower()))
        stopwords = {"explain", "what", "where", "when", "which", "about", "the", "and", "for", "with", "from", "tell", "show", "give", "describe", "is", "are"}
        content_words = query_words - stopwords
        if not content_words:
            content_words = query_words

        matched_units = []
        for chunk in chunks[:5]:
            fname = chunk.metadata.get("filename", "Document")
            pnum = chunk.metadata.get("page_number", 1)
            
            raw_lines = re.split(r'[\r\n]+|[•\*\-]\s+', chunk.text)
            for line in raw_lines:
                clean_line = line.strip()
                if len(clean_line) < 15 or len(clean_line) > 350:
                    continue
                
                lower_line = clean_line.lower()
                line_words = set(re.findall(r'\b[a-zA-Z0-9_\-\.]{2,}\b', lower_line))
                
                overlap = len(content_words.intersection(line_words))
                for cw in content_words:
                    if len(cw) >= 4 and (cw in lower_line or any(lw.startswith(cw[:4]) for lw in line_words)):
                        overlap += 2
                    if cw in ("recat", "react") and ("react" in lower_line or "mern" in lower_line):
                        overlap += 3

                if overlap > 0:
                    matched_units.append((overlap, clean_line, fname, pnum))

        matched_units.sort(key=lambda x: x[0], reverse=True)

        lines = [
            f"Here are the specific details found in your document regarding **\"{query}\"**:\n"
        ]

        if matched_units:
            seen = set()
            for _, text_snippet, fname, pnum in matched_units[:6]:
                if text_snippet.lower() in seen:
                    continue
                seen.add(text_snippet.lower())
                lines.append(f"• {text_snippet} `[Doc: {fname}, Page: {pnum}]`")
        else:
            top_chunk = chunks[0]
            snippet = top_chunk.text[:280].replace('\n', ' ')
            lines.append(f"• Excerpt: \"{snippet}...\" `[Doc: {top_chunk.metadata.get('filename')}, Page: {top_chunk.metadata.get('page_number', 1)}]`")

        if failure_reason:
            lines.append(
                f"\n---\n"
                f"> ⚠️ **Generative AI Notice:** Direct Gemini synthesis could not be completed ({failure_reason}).\n"
                f"> Results above were extracted directly from your indexed documents."
            )
        else:
            lines.append(
                "\n---\n"
                "> ℹ️ **Notice:** Showing verified document excerpts. Configure your Google Gemini API Key in **Settings** for AI-generated explanatory paragraphs."
            )
        return "\n".join(lines)

    @classmethod
    async def generate_response(
        cls,
        query: str,
        chunks: List[HybridSearchResult],
        chat_history: Optional[List[Dict[str, Any]]] = None,
        model_name: Optional[str] = None
    ) -> RAGAnswer:
        start_time = time.time()
        api_key = (settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")).strip()

        # Build candidate models list: user preference first, then fast fallbacks
        requested_model = model_name or settings.GEMINI_MODEL
        candidates = []
        for m in [requested_model, *ACTIVE_MODELS]:
            if m and m not in candidates:
                candidates.append(m)

        if api_key and len(api_key) > 5:
            prompt = cls._build_context_prompt(query, chunks, chat_history)
            last_err = ""

            for cand_model in candidates:
                try:
                    logger.info(f"Attempting Gemini generation with model: {cand_model}")
                    # Run synchronous HTTP in a worker thread to keep the asyncio event loop responsive
                    answer_text = await asyncio.to_thread(
                        cls._call_gemini_rest_sync, api_key, cand_model, prompt
                    )
                    if answer_text:
                        latency = round((time.time() - start_time) * 1000, 1)
                        citations = cls._build_citations(chunks, answer_text)
                        logger.info(f"Gemini generation succeeded with {cand_model} in {latency}ms")
                        return RAGAnswer(
                            answer=answer_text,
                            citations=citations,
                            latency_ms=latency,
                            model_used=cand_model,
                            retrieval_count=len(chunks)
                        )
                except Exception as ex:
                    last_err = str(ex)
                    logger.warning(f"Model {cand_model} failed: {ex}. Trying next model...")

            # All candidate models failed
            logger.error(f"All Gemini model attempts failed. Last error: {last_err}")
            
            if any(k in last_err.lower() for k in ["api_key_invalid", "401", "403", "permission_denied"]):
                friendly_reason = "API key was not accepted by Google AI Studio. Please verify key in Settings"
            elif any(k in last_err.lower() for k in ["quota", "429"]):
                friendly_reason = "Google Gemini rate limit / quota exceeded"
            elif any(k in last_err.lower() for k in ["timeout", "timed out"]):
                friendly_reason = "Request timed out"
            else:
                friendly_reason = f"API error: {last_err[:80]}"

            latency = round((time.time() - start_time) * 1000, 1)
            fallback_answer = cls._local_synthesis(query, chunks, failure_reason=friendly_reason)
            citations = cls._build_citations(chunks, fallback_answer)
            return RAGAnswer(
                answer=fallback_answer,
                citations=citations,
                latency_ms=latency,
                model_used="extractive-fallback-with-error",
                retrieval_count=len(chunks)
            )

        # No API key configured
        latency = round((time.time() - start_time) * 1000, 1)
        answer_text = cls._local_synthesis(query, chunks)
        citations = cls._build_citations(chunks, answer_text)

        return RAGAnswer(
            answer=answer_text,
            citations=citations,
            latency_ms=latency,
            model_used="local-extractive-fallback",
            retrieval_count=len(chunks)
        )
