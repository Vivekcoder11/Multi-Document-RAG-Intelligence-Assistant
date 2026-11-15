import uuid
import re
from typing import List, Dict, Any
from app.documents.extractor import ExtractedPage

class DocumentChunk:
    def __init__(
        self,
        chunk_id: str,
        document_id: str,
        filename: str,
        workspace_id: str,
        page_number: int,
        chunk_index: int,
        text: str,
        char_count: int,
        token_count: int
    ):
        self.chunk_id = chunk_id
        self.document_id = document_id
        self.filename = filename
        self.workspace_id = workspace_id
        self.page_number = page_number
        self.chunk_index = chunk_index
        self.text = text
        self.char_count = char_count
        self.token_count = token_count

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunk_id": self.chunk_id,
            "document_id": self.document_id,
            "filename": self.filename,
            "workspace_id": self.workspace_id,
            "page_number": self.page_number,
            "chunk_index": self.chunk_index,
            "text": self.text,
            "char_count": self.char_count,
            "token_count": self.token_count
        }

class RecursiveChunker:
    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 150):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        # Hierarchical separators
        self.separators = ["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " "]

    def _split_text_recursive(self, text: str, separators: List[str]) -> List[str]:
        final_chunks = []
        if not text:
            return final_chunks
            
        if len(text) <= self.chunk_size:
            return [text.strip()] if text.strip() else []
            
        # Find the first separator present in text
        chosen_separator = ""
        for sep in separators:
            if sep in text:
                chosen_separator = sep
                break
                
        if not chosen_separator:
            # Hard character slice if no separators found
            for i in range(0, len(text), self.chunk_size - self.chunk_overlap):
                segment = text[i:i + self.chunk_size].strip()
                if segment:
                    final_chunks.append(segment)
            return final_chunks
            
        splits = text.split(chosen_separator)
        next_separators = separators[separators.index(chosen_separator) + 1:] if separators.index(chosen_separator) + 1 < len(separators) else []
        
        current_chunk = []
        current_length = 0
        
        for piece in splits:
            piece_len = len(piece) + len(chosen_separator)
            if current_length + piece_len <= self.chunk_size:
                current_chunk.append(piece)
                current_length += piece_len
            else:
                if current_chunk:
                    merged = chosen_separator.join(current_chunk).strip()
                    if merged:
                        final_chunks.append(merged)
                        
                    # Calculate overlap from the end of current_chunk
                    overlap_chunk = []
                    overlap_len = 0
                    for prev_piece in reversed(current_chunk):
                        if overlap_len + len(prev_piece) <= self.chunk_overlap:
                            overlap_chunk.insert(0, prev_piece)
                            overlap_len += len(prev_piece) + len(chosen_separator)
                        else:
                            break
                    current_chunk = overlap_chunk
                    current_length = overlap_len
                    
                if len(piece) > self.chunk_size and next_separators:
                    sub_chunks = self._split_text_recursive(piece, next_separators)
                    final_chunks.extend(sub_chunks)
                    current_chunk = []
                    current_length = 0
                else:
                    current_chunk.append(piece)
                    current_length += piece_len
                    
        if current_chunk:
            merged = chosen_separator.join(current_chunk).strip()
            if merged:
                final_chunks.append(merged)
                
        return final_chunks

    def chunk_document(
        self,
        pages: List[ExtractedPage],
        document_id: str,
        filename: str,
        workspace_id: str
    ) -> List[DocumentChunk]:
        chunks: List[DocumentChunk] = []
        global_chunk_idx = 0
        
        for page in pages:
            raw_splits = self._split_text_recursive(page.text, self.separators)
            for split_text in raw_splits:
                if len(split_text) < 15:  # skip tiny noise fragments
                    continue
                # Rough token estimate: ~4 chars per token
                approx_tokens = max(1, len(split_text) // 4)
                
                chunk_obj = DocumentChunk(
                    chunk_id=str(uuid.uuid4()),
                    document_id=document_id,
                    filename=filename,
                    workspace_id=workspace_id,
                    page_number=page.page_number,
                    chunk_index=global_chunk_idx,
                    text=split_text,
                    char_count=len(split_text),
                    token_count=approx_tokens
                )
                chunks.append(chunk_obj)
                global_chunk_idx += 1
                
        return chunks
