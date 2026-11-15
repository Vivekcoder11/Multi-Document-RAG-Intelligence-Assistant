import { User, Workspace, DocumentItem, ChatSession, ChatMessage, AnalyticsData, RAGSettings } from '../types';

const BASE_URL = '/api';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('rag_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('rag_token', token);
    } else {
      localStorage.removeItem('rag_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      // Auto-relogin with default demo user if token is missing/expired
      const loginSuccess = await this.demoLogin();
      if (loginSuccess) {
        headers['Authorization'] = `Bearer ${this.token}`;
        const retryRes = await fetch(`${BASE_URL}${endpoint}`, {
          ...options,
          headers,
        });
        if (!retryRes.ok) {
          const err = await retryRes.json().catch(() => ({ detail: retryRes.statusText }));
          throw new Error(err.detail || 'Request failed');
        }
        return retryRes.json();
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Request failed');
    }

    return res.json();
  }

  async demoLogin(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'demo@ragintelligence.ai',
          password: 'password123',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        this.setToken(data.access_token);
        return true;
      }
    } catch {
      // fallback
    }
    return false;
  }

  // Auth: Login, Register, Logout
  async login(email: string, password: string): Promise<{ access_token: string; user: User }> {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Login failed');
    }

    const data = await res.json();
    this.setToken(data.access_token);
    return data;
  }

  async register(email: string, password: string, fullName: string): Promise<{ access_token: string; user: User }> {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Registration failed');
    }

    const data = await res.json();
    this.setToken(data.access_token);
    return data;
  }

  logout() {
    this.setToken(null);
  }

  // Auth & Workspaces
  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async listWorkspaces(): Promise<Workspace[]> {
    return this.request<Workspace[]>('/auth/workspaces');
  }

  async createWorkspace(name: string, description: string = ''): Promise<Workspace> {
    return this.request<Workspace>('/auth/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  }

  async switchWorkspace(workspaceId: string): Promise<User> {
    return this.request<User>(`/auth/workspaces/${workspaceId}/switch`, {
      method: 'POST',
    });
  }

  // Documents
  async listDocuments(workspaceId: string): Promise<DocumentItem[]> {
    return this.request<DocumentItem[]>(`/documents?workspace_id=${workspaceId}`);
  }

  async uploadDocuments(workspaceId: string, files: File[]): Promise<any> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    return this.request<any>(`/documents/upload?workspace_id=${workspaceId}`, {
      method: 'POST',
      body: formData,
    });
  }

  async deleteDocument(documentId: string): Promise<any> {
    return this.request<any>(`/documents/${documentId}`, {
      method: 'DELETE',
    });
  }

  async reindexDocument(documentId: string): Promise<DocumentItem> {
    return this.request<DocumentItem>(`/documents/${documentId}/reindex`, {
      method: 'POST',
    });
  }

  async getDocumentSummary(documentId: string): Promise<{ summary: string }> {
    return this.request<{ summary: string }>('/documents/summary', {
      method: 'POST',
      body: JSON.stringify({ document_id: documentId }),
    });
  }

  async generateQuestions(documentId: string, count: number = 5): Promise<{ questions: string[] }> {
    return this.request<{ questions: string[] }>('/documents/generate-questions', {
      method: 'POST',
      body: JSON.stringify({ document_id: documentId, count }),
    });
  }

  async compareDocuments(docId1: string, docId2: string): Promise<{ comparison: string }> {
    return this.request<{ comparison: string }>('/documents/compare', {
      method: 'POST',
      body: JSON.stringify({ document_id_1: docId1, document_id_2: docId2 }),
    });
  }

  // Chat
  async listSessions(workspaceId: string): Promise<ChatSession[]> {
    return this.request<ChatSession[]>(`/chat/sessions?workspace_id=${workspaceId}`);
  }

  async createSession(workspaceId: string, title?: string): Promise<ChatSession> {
    return this.request<ChatSession>('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({ workspace_id: workspaceId, title }),
    });
  }

  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    return this.request<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`);
  }

  async deleteSession(sessionId: string): Promise<any> {
    return this.request<any>(`/chat/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }

  async clearSession(sessionId: string): Promise<any> {
    return this.request<any>(`/chat/sessions/${sessionId}/clear`, {
      method: 'POST',
    });
  }

  async sendMessage(
    params: {
      sessionId?: string;
      message: string;
      workspaceId: string;
      documentIds?: string[];
      topK?: number;
      similarityThreshold?: number;
      hybridAlpha?: number;
      geminiModel?: string;
    },
    signal?: AbortSignal
  ): Promise<ChatMessage> {
    return this.request<ChatMessage>('/chat', {
      method: 'POST',
      body: JSON.stringify({
        session_id: params.sessionId,
        message: params.message,
        workspace_id: params.workspaceId,
        document_ids: params.documentIds,
        top_k: params.topK,
        similarity_threshold: params.similarityThreshold,
        hybrid_alpha: params.hybridAlpha,
        gemini_model: params.geminiModel,
      }),
      signal,
    });
  }

  async exportPdf(query: string, answer: string, citations: any[] = []): Promise<Blob> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${BASE_URL}/chat/export-pdf`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'Multi-Document Intelligence Executive Report',
        query,
        answer,
        citations,
      }),
    });

    if (!res.ok) {
      throw new Error('PDF export failed');
    }
    return res.blob();
  }

  // Analytics & Settings
  async getAnalytics(workspaceId: string): Promise<AnalyticsData> {
    return this.request<AnalyticsData>(`/analytics/dashboard?workspace_id=${workspaceId}`);
  }

  async getRAGSettings(): Promise<RAGSettings & { supported_models: { id: string; name: string }[] }> {
    return this.request<any>('/search/settings');
  }

  async updateRAGSettings(settings: Partial<RAGSettings>): Promise<any> {
    return this.request<any>('/search/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  async healthCheck(): Promise<any> {
    const res = await fetch(`${BASE_URL}/health`);
    return res.json();
  }
}

export const api = new ApiClient();

