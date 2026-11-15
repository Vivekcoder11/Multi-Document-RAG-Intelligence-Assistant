import os
import fitz  # PyMuPDF
from docx import Document as DocxDocument
from typing import List, Dict, Any
from app.utils.text_cleaning import clean_text

class ExtractedPage:
    def __init__(self, page_number: int, text: str):
        self.page_number = page_number
        self.text = text

class DocumentExtractor:
    @staticmethod
    def extract_pdf(file_path: str) -> List[ExtractedPage]:
        pages = []
        doc = fitz.open(file_path)
        try:
            for page_idx in range(len(doc)):
                page = doc[page_idx]
                text = page.get_text("text")
                cleaned = clean_text(text)
                if cleaned:
                    pages.append(ExtractedPage(page_number=page_idx + 1, text=cleaned))
        finally:
            doc.close()
        return pages

    @staticmethod
    def extract_docx(file_path: str) -> List[ExtractedPage]:
        doc = DocxDocument(file_path)
        pages = []
        current_page_text = []
        current_page_num = 1
        lines_count = 0
        
        # Extract paragraphs
        for para in doc.paragraphs:
            text = para.text.strip()
            if not text:
                continue
            current_page_text.append(text)
            lines_count += len(text) // 80 + 1
            
            # Virtual page break every ~45 lines or 2500 chars for citation accuracy
            if lines_count >= 45:
                combined = clean_text("\n\n".join(current_page_text))
                if combined:
                    pages.append(ExtractedPage(page_number=current_page_num, text=combined))
                current_page_num += 1
                current_page_text = []
                lines_count = 0
                
        # Extract tables
        for table in doc.tables:
            table_rows = []
            for row in table.rows:
                row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                if row_text:
                    table_rows.append(row_text)
            if table_rows:
                current_page_text.append("[Table Content]\n" + "\n".join(table_rows))
                
        if current_page_text:
            combined = clean_text("\n\n".join(current_page_text))
            if combined:
                pages.append(ExtractedPage(page_number=current_page_num, text=combined))
                
        return pages

    @staticmethod
    def extract_text(file_path: str, is_markdown: bool = False) -> List[ExtractedPage]:
        # Try UTF-8 first, fallback to Latin-1
        content = ""
        for encoding in ["utf-8", "utf-8-sig", "latin-1", "cp1252"]:
            try:
                with open(file_path, "r", encoding=encoding) as f:
                    content = f.read()
                break
            except UnicodeDecodeError:
                continue
                
        if not content:
            return []
            
        lines = content.splitlines()
        pages = []
        page_size = 45 # ~45 lines per page for citation granularity
        
        for i in range(0, len(lines), page_size):
            chunk_lines = lines[i:i + page_size]
            page_text = clean_text("\n".join(chunk_lines))
            if page_text:
                pages.append(ExtractedPage(page_number=(i // page_size) + 1, text=page_text))
                
        return pages

    @classmethod
    def extract(cls, file_path: str, file_ext: str) -> List[ExtractedPage]:
        ext = file_ext.lower().replace(".", "")
        if ext == "pdf":
            return cls.extract_pdf(file_path)
        elif ext == "docx":
            return cls.extract_docx(file_path)
        elif ext in ["txt", "text"]:
            return cls.extract_text(file_path, is_markdown=False)
        elif ext in ["md", "markdown"]:
            return cls.extract_text(file_path, is_markdown=True)
        else:
            raise ValueError(f"Unsupported file format: {ext}")
