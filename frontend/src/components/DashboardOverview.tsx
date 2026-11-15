import React, { useRef } from 'react';
import { DocumentItem, ChatSession, AnalyticsData, Workspace } from '../types';
import { 
  Bot, 
  FileText, 
  UploadCloud, 
  Sparkles, 
  Layers, 
  MessageSquare, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  HardDrive
} from 'lucide-react';

interface DashboardOverviewProps {
  currentWorkspace: Workspace | null;
  documents: DocumentItem[];
  sessions: ChatSession[];
  analytics: AnalyticsData | null;
  onNavigateTab: (tab: 'dashboard' | 'assistant' | 'documents' | 'analytics' | 'settings') => void;
  onUpload: (files: File[]) => Promise<void>;
  onSelectSession: (session: ChatSession) => void;
  onSummarize: (doc: DocumentItem) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  currentWorkspace,
  documents,
  sessions,
  analytics,
  onNavigateTab,
  onUpload,
  onSelectSession,
  onSummarize,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(Array.from(e.target.files));
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const totalBytes = documents.reduce((acc, d) => acc + (d.file_size || 0), 0);
  const totalChunks = analytics?.total_chunks || documents.reduce((acc, d) => acc + (d.chunk_count || 0), 0);
  const avgLatency = analytics?.avg_latency_ms ? `${(analytics.avg_latency_ms / 1000).toFixed(2)}s` : '0.45s';

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-950 p-8 sm:p-10 border border-indigo-800/40 shadow-xl">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-4 border border-indigo-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Hybrid Neural RAG • Production Grade</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
            Multi-Document RAG Intelligence Platform
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm mt-2 leading-relaxed">
            Ingest PDFs, Word documents, text files, and markdown. Ask deep cross-document queries, extract comparative intelligence, and verify grounded answers with exact source citations.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigateTab('assistant')}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-500/20"
            >
              <Bot className="w-4 h-4" />
              <span>Launch AI Assistant</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/10 transition-all backdrop-blur-sm"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Quick Upload Files</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept=".pdf,.docx,.txt,.md"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Documents</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {documents.length}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">In {currentWorkspace?.name || 'Default Workspace'}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Indexed Chunks</span>
            <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {totalChunks}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">ChromaDB Vector + BM25</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Storage Usage</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {formatFileSize(totalBytes)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Uploaded source files</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Query Response</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {avgLatency}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Avg Hybrid Retrieval Latency</p>
        </div>
      </div>

      {/* Main Split: Recent Documents & Recent Conversations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Documents */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Knowledge Documents</h3>
              <p className="text-xs text-slate-400">Recently uploaded and indexed sources</p>
            </div>
            <button
              onClick={() => onNavigateTab('documents')}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center space-x-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {documents.length === 0 ? (
            <div className="py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center">
              <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">No documents uploaded yet</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg hover:bg-indigo-100"
              >
                Upload First Document
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {documents.slice(0, 5).map((doc) => (
                <div key={doc.id} className="py-3 flex items-center justify-between group">
                  <div className="flex items-center space-x-3 truncate">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {doc.filename}
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        {formatFileSize(doc.file_size)} • {doc.page_count} pages • {doc.chunk_count} chunks
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {doc.status === 'indexed' ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Ready</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                        <span>{doc.status}</span>
                      </span>
                    )}
                    <button
                      onClick={() => onSummarize(doc)}
                      className="px-2.5 py-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                    >
                      Summarize
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Recent Conversations */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Conversations</h3>
                <p className="text-xs text-slate-400">Resume your document investigations</p>
              </div>
              <MessageSquare className="w-4 h-4 text-slate-400" />
            </div>

            {sessions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs italic">
                No conversations yet
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.slice(0, 4).map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      onSelectSession(s);
                      onNavigateTab('assistant');
                    }}
                    className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:border-indigo-300 dark:hover:border-indigo-600 cursor-pointer transition-all"
                  >
                    <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {s.title}
                    </h5>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(s.updated_at || s.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
            <button
              onClick={() => onNavigateTab('assistant')}
              className="w-full py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm shadow-indigo-500/20 text-center flex items-center justify-center space-x-1.5"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Open AI Assistant</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
