import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api/client';
import { 
  User, 
  Workspace, 
  DocumentItem, 
  ChatSession, 
  ChatMessage, 
  AnalyticsData, 
  RAGSettings 
} from './types';
import { Sidebar } from './components/Sidebar';
import { DashboardOverview } from './components/DashboardOverview';
import { DocumentManager } from './components/DocumentManager';
import { ChatInterface } from './components/ChatInterface';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { SettingsView } from './components/SettingsView';
import { ActionModal } from './components/ActionModal';
import { AuthModal } from './components/AuthModal';
import { AlertCircle } from 'lucide-react';

export function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('rag_dark_mode') !== 'false';
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'assistant' | 'documents' | 'analytics' | 'settings'>('dashboard');

  // Documents State
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  // Chat State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Analytics & Settings State
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [ragSettings, setRagSettings] = useState<any>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  // Modal State
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    type: 'summary' | 'questions' | 'compare';
    content: string | string[];
    isLoading: boolean;
  }>({
    isOpen: false,
    title: '',
    type: 'summary',
    content: '',
    isLoading: false,
  });

  const [globalError, setGlobalError] = useState<string | null>(null);

  // Auth Modal State
  const [authModalState, setAuthModalState] = useState<{
    isOpen: boolean;
    mode: 'login' | 'register';
  }>({
    isOpen: false,
    mode: 'login',
  });

  // Apply dark mode class to html document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('rag_dark_mode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('rag_dark_mode', 'false');
    }
  }, [darkMode]);

  // Load Data for active workspace
  const loadWorkspaceData = useCallback(async (wsId: string) => {
    try {
      setIsLoadingDocs(true);
      const docs = await api.listDocuments(wsId);
      setDocuments(docs);

      const chatSessions = await api.listSessions(wsId);
      setSessions(chatSessions);
      if (chatSessions.length > 0) {
        setActiveSession(chatSessions[0]);
        const msgs = await api.getMessages(chatSessions[0].id);
        setMessages(msgs);
      } else {
        setActiveSession(null);
        setMessages([]);
      }

      api.getAnalytics(wsId).then(setAnalyticsData).catch(console.error);
    } catch (err: any) {
      console.error('Failed to load workspace data:', err);
    } finally {
      setIsLoadingDocs(false);
    }
  }, []);

  // Initialize App & Authentication
  useEffect(() => {
    const init = async () => {
      try {
        let user: User | null = null;
        try {
          user = await api.getMe();
        } catch {
          await api.demoLogin();
          user = await api.getMe();
        }

        if (user) {
          setCurrentUser(user);
          const wsList = await api.listWorkspaces();
          setWorkspaces(wsList);

          const active = wsList.find((w) => w.id === user?.active_workspace_id) || wsList[0] || null;
          setCurrentWorkspace(active);
          if (active) {
            await loadWorkspaceData(active.id);
          }
          api.getRAGSettings().then(setRagSettings).catch(console.error);
        }
      } catch (err: any) {
        setGlobalError(err.message || 'Initialization failed');
      }
    };
    init();
  }, [loadWorkspaceData]);

  // Load Tab Specific Data
  useEffect(() => {
    if (!currentWorkspace) return;

    if (activeTab === 'analytics' || activeTab === 'dashboard') {
      setIsLoadingAnalytics(true);
      api.getAnalytics(currentWorkspace.id)
        .then(setAnalyticsData)
        .catch(console.error)
        .finally(() => setIsLoadingAnalytics(false));
    } else if (activeTab === 'settings') {
      setIsLoadingSettings(true);
      api.getRAGSettings()
        .then(setRagSettings)
        .catch(console.error)
        .finally(() => setIsLoadingSettings(false));
    } else if (activeTab === 'documents') {
      api.listDocuments(currentWorkspace.id)
        .then(setDocuments)
        .catch(console.error);
    }
  }, [activeTab, currentWorkspace]);

  // Workspace actions
  const handleSelectWorkspace = async (workspaceId: string) => {
    try {
      const updatedUser = await api.switchWorkspace(workspaceId);
      setCurrentUser(updatedUser);
      const ws = workspaces.find((w) => w.id === workspaceId) || null;
      setCurrentWorkspace(ws);
      if (ws) {
        await loadWorkspaceData(ws.id);
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to switch workspace');
    }
  };

  const handleCreateWorkspace = async (name: string) => {
    try {
      const created = await api.createWorkspace(name);
      setWorkspaces((prev) => [...prev, created]);
      await handleSelectWorkspace(created.id);
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to create workspace');
    }
  };

  // Document actions
  const handleUploadDocuments = async (files: File[]) => {
    if (!currentWorkspace) return;
    try {
      await api.uploadDocuments(currentWorkspace.id, files);
      const docs = await api.listDocuments(currentWorkspace.id);
      setDocuments(docs);
      setCurrentWorkspace((prev) => prev ? { ...prev, document_count: docs.length } : null);
      api.getAnalytics(currentWorkspace.id).then(setAnalyticsData).catch(console.error);
    } catch (err: any) {
      setGlobalError(err.message || 'Upload failed');
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!currentWorkspace) return;
    try {
      await api.deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setCurrentWorkspace((prev) => prev ? { ...prev, document_count: Math.max(0, prev.document_count - 1) } : null);
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to delete document');
    }
  };

  const handleReindexDocument = async (id: string) => {
    try {
      const updated = await api.reindexDocument(id);
      setDocuments((prev) => prev.map((d) => d.id === id ? updated : d));
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to reindex document');
    }
  };

  const handleSummarizeDocument = async (doc: DocumentItem) => {
    setModalState({
      isOpen: true,
      title: `Executive Summary: ${doc.filename}`,
      type: 'summary',
      content: '',
      isLoading: true,
    });
    try {
      const res = await api.getDocumentSummary(doc.id);
      setModalState((prev) => ({
        ...prev,
        content: res.summary,
        isLoading: false,
      }));
    } catch (err: any) {
      setModalState((prev) => ({
        ...prev,
        content: `Error: ${err.message || 'Failed to summarize'}`,
        isLoading: false,
      }));
    }
  };

  const handleGenerateQuestions = async (doc: DocumentItem) => {
    setModalState({
      isOpen: true,
      title: `Study Questions: ${doc.filename}`,
      type: 'questions',
      content: [],
      isLoading: true,
    });
    try {
      const res = await api.generateQuestions(doc.id, 5);
      setModalState((prev) => ({
        ...prev,
        content: res.questions,
        isLoading: false,
      }));
    } catch (err: any) {
      setModalState((prev) => ({
        ...prev,
        content: [`Error: ${err.message || 'Failed to generate questions'}`],
        isLoading: false,
      }));
    }
  };

  const handleCompareDocuments = async (doc1: DocumentItem, doc2: DocumentItem) => {
    setModalState({
      isOpen: true,
      title: `Comparative Intelligence Analysis`,
      type: 'compare',
      content: '',
      isLoading: true,
    });
    try {
      const res = await api.compareDocuments(doc1.id, doc2.id);
      setModalState((prev) => ({
        ...prev,
        content: res.comparison,
        isLoading: false,
      }));
    } catch (err: any) {
      setModalState((prev) => ({
        ...prev,
        content: `Error: ${err.message || 'Comparison failed'}`,
        isLoading: false,
      }));
    }
  };

  // Chat actions
  const handleSelectSession = async (session: ChatSession) => {
    setActiveSession(session);
    try {
      const msgs = await api.getMessages(session.id);
      setMessages(msgs);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleNewSession = async () => {
    if (!currentWorkspace) return;
    try {
      const newSess = await api.createSession(currentWorkspace.id, 'New Conversation');
      setSessions((prev) => [newSess, ...prev]);
      setActiveSession(newSess);
      setMessages([]);
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to create session');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await api.deleteSession(sessionId);
      const remaining = sessions.filter((s) => s.id !== sessionId);
      setSessions(remaining);
      if (activeSession?.id === sessionId) {
        if (remaining.length > 0) {
          handleSelectSession(remaining[0]);
        } else {
          setActiveSession(null);
          setMessages([]);
        }
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to delete session');
    }
  };

  const handleSendMessage = async (
    messageText: string,
    scopedDocIds: string[],
    hybridAlpha: number
  ) => {
    if (!currentWorkspace) return;
    setIsSendingMessage(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const tempUserMsg: ChatMessage = {
      id: 'temp-' + Date.now(),
      session_id: activeSession?.id || '',
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const reply = await api.sendMessage(
        {
          sessionId: activeSession?.id,
          message: messageText,
          workspaceId: currentWorkspace.id,
          documentIds: scopedDocIds.length > 0 ? scopedDocIds : undefined,
          hybridAlpha,
        },
        abortController.signal
      );

      if (!activeSession || activeSession.id !== reply.session_id) {
        const updatedSessions = await api.listSessions(currentWorkspace.id);
        setSessions(updatedSessions);
        const cur = updatedSessions.find((s) => s.id === reply.session_id) || null;
        setActiveSession(cur);
      }

      setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, reply]);
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('Failed to fetch')) {
        setMessages((prev) => [
          ...prev,
          {
            id: 'stopped-' + Date.now(),
            session_id: activeSession?.id || '',
            role: 'assistant',
            content: '⏹️ *Response generation stopped by user.*',
            timestamp: new Date().toISOString(),
          },
        ]);
      } else {
        setGlobalError(err.message || 'Message generation failed');
      }
    } finally {
      setIsSendingMessage(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopSending = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsSendingMessage(false);
    }
  };

  const handleClearChat = async () => {
    if (!activeSession) return;
    try {
      await api.clearSession(activeSession.id);
      setMessages([]);
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to clear conversation');
    }
  };

  const handleExportPdf = async (message: ChatMessage) => {
    try {
      const userMsg = [...messages].reverse().find(
        (m) => m.role === 'user' && new Date(m.timestamp) <= new Date(message.timestamp)
      );
      const query = userMsg ? userMsg.content : 'RAG Query Analysis';
      const blob = await api.exportPdf(query, message.content, message.citations || []);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rag_intelligence_report_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to export PDF report');
    }
  };

  const handleSaveSettings = async (updated: Partial<RAGSettings>) => {
    try {
      const res = await api.updateRAGSettings(updated);
      setRagSettings(res.settings);
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to update settings');
    }
  };

  const handleAuthSuccess = async (user: User) => {
    setCurrentUser(user);
    try {
      const wsList = await api.listWorkspaces();
      setWorkspaces(wsList);
      const active = wsList.find((w) => w.id === user.active_workspace_id) || wsList[0] || null;
      setCurrentWorkspace(active);
      if (active) {
        await loadWorkspaceData(active.id);
      }
      api.getRAGSettings().then(setRagSettings).catch(console.error);
    } catch (e) {
      console.error('Failed to load user workspace after auth:', e);
    }
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setCurrentWorkspace(null);
    setWorkspaces([]);
    setDocuments([]);
    setSessions([]);
    setMessages([]);
    setAnalyticsData(null);
    setAuthModalState({ isOpen: true, mode: 'login' });
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 transition-colors overflow-hidden">
      {/* SaaS Left Sidebar */}
      <Sidebar
        currentWorkspace={currentWorkspace}
        workspaces={workspaces}
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSelectWorkspace={handleSelectWorkspace}
        onCreateWorkspace={handleCreateWorkspace}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onOpenAuth={(mode) => setAuthModalState({ isOpen: true, mode })}
        onLogout={handleLogout}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto min-w-0">
        {/* Global Error Alert Banner */}
        {globalError && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{globalError}</span>
            </div>
            <button
              onClick={() => setGlobalError(null)}
              className="text-xs font-semibold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardOverview
              currentWorkspace={currentWorkspace}
              documents={documents}
              sessions={sessions}
              analytics={analyticsData}
              onNavigateTab={setActiveTab}
              onUpload={handleUploadDocuments}
              onSelectSession={handleSelectSession}
              onSummarize={handleSummarizeDocument}
            />
          )}

          {activeTab === 'assistant' && (
            <ChatInterface
              sessions={sessions}
              activeSession={activeSession}
              messages={messages}
              documents={documents}
              onSelectSession={handleSelectSession}
              onNewSession={handleNewSession}
              onDeleteSession={handleDeleteSession}
              onSendMessage={handleSendMessage}
              onExportPdf={handleExportPdf}
              isSending={isSendingMessage}
              hasApiKey={ragSettings?.has_api_key}
              onOpenSettings={() => setActiveTab('settings')}
              onStopSending={handleStopSending}
              onClearChat={handleClearChat}
            />
          )}

          {activeTab === 'documents' && (
            <DocumentManager
              documents={documents}
              workspaceId={currentWorkspace?.id || ''}
              onUpload={handleUploadDocuments}
              onDelete={handleDeleteDocument}
              onReindex={handleReindexDocument}
              onSummarize={handleSummarizeDocument}
              onGenerateQuestions={handleGenerateQuestions}
              onCompare={handleCompareDocuments}
              isLoading={isLoadingDocs}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsDashboard
              data={analyticsData}
              isLoading={isLoadingAnalytics}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={ragSettings}
              onSaveSettings={handleSaveSettings}
              isLoading={isLoadingSettings}
            />
          )}
        </main>
      </div>

      {/* Action / Inspection Modal */}
      <ActionModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        title={modalState.title}
        type={modalState.type}
        content={modalState.content}
        isLoading={modalState.isLoading}
      />

      {/* Auth Modal: Sign In & Create Account */}
      <AuthModal
        isOpen={authModalState.isOpen}
        onClose={() => setAuthModalState((prev) => ({ ...prev, isOpen: false }))}
        onSuccess={handleAuthSuccess}
        initialMode={authModalState.mode}
      />
    </div>
  );
}
