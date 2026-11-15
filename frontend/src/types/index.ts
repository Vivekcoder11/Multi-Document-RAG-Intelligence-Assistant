export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  active_workspace_id: string;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  document_count: number;
  created_at: string;
}

export type DocumentStatus = 'uploading' | 'processing' | 'indexed' | 'failed';

export interface DocumentItem {
  id: string;
  filename: string;
  file_type: 'pdf' | 'docx' | 'txt' | 'md' | string;
  file_size: number;
  page_count: number;
  chunk_count: number;
  status: DocumentStatus;
  error_message?: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
  summary?: string;
  extracted_preview?: string;
}

export interface Citation {
  id?: string;
  document_id: string;
  filename: string;
  page_number: number;
  chunk_id: string;
  excerpt: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  citations?: Citation[];
  latency_ms?: number;
  model_used?: string;
  retrieval_count?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  preview?: string;
}

export interface AnalyticsData {
  total_documents: number;
  total_chunks: number;
  total_chats: number;
  storage_bytes: number;
  status_breakdown: {
    indexed: number;
    processing: number;
    failed: number;
  };
  chunks_by_doc: { name: string; chunks: number; pages: number }[];
  query_history: { date: string; queries: number }[];
  frequently_queried: { filename: string; query_count: number; citation_count: number }[];
  avg_latency_ms: number;
}

export interface RAGSettings {
  chunk_size: number;
  chunk_overlap: number;
  top_k: number;
  similarity_threshold: number;
  hybrid_alpha: number; // 0 = Pure BM25, 1 = Pure Vector, 0.5 = Balanced Hybrid
  gemini_model: string;
  temperature: number;
  has_api_key: boolean;
}
