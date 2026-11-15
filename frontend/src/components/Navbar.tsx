import { useState } from 'react';
import { Workspace, User } from '../types';
import { 
  Bot, 
  Layers, 
  FileText, 
  BarChart3, 
  Sliders, 
  Plus, 
  Sun, 
  Moon, 
  Check, 
  ChevronDown,
  Sparkles
} from 'lucide-react';

interface NavbarProps {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  currentUser: User | null;
  activeTab: 'chat' | 'documents' | 'analytics' | 'settings';
  setActiveTab: (tab: 'chat' | 'documents' | 'analytics' | 'settings') => void;
  onSelectWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: (name: string) => Promise<void>;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentWorkspace,
  workspaces,
  currentUser,
  activeTab,
  setActiveTab,
  onSelectWorkspace,
  onCreateWorkspace,
  darkMode,
  setDarkMode,
}) => {
  const [showWsMenu, setShowWsMenu] = useState(false);
  const [showNewWsModal, setShowNewWsModal] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [isCreatingWs, setIsCreatingWs] = useState(false);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    setIsCreatingWs(true);
    try {
      await onCreateWorkspace(newWsName.trim());
      setNewWsName('');
      setShowNewWsModal(false);
      setShowWsMenu(false);
    } finally {
      setIsCreatingWs(false);
    }
  };

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-40 transition-colors shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand & Workspace */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('chat')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
                  RAG Intelligence
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded uppercase tracking-wider">
                  Pro
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Multi-Document Hybrid Reasoning
              </p>
            </div>
          </div>

          {/* Workspace Selector */}
          <div className="relative">
            <button
              onClick={() => setShowWsMenu(!showWsMenu)}
              className="flex items-center space-x-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span className="max-w-[140px] truncate">
                {currentWorkspace ? currentWorkspace.name : 'Select Workspace'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </button>

            {showWsMenu && (
              <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Your Workspaces
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => {
                        onSelectWorkspace(ws.id);
                        setShowWsMenu(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <Layers className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{ws.name}</span>
                      </div>
                      {currentWorkspace?.id === ws.id && (
                        <Check className="w-4 h-4 text-indigo-500 flex-shrink-0 ml-2" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-100 dark:border-slate-700/60 mt-1 pt-1">
                  <button
                    onClick={() => {
                      setShowWsMenu(false);
                      setShowNewWsModal(true);
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create New Workspace</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Navigation Tabs */}
        <nav className="hidden md:flex items-center space-x-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === 'chat'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Chat & Q&A</span>
          </button>

          <button
            onClick={() => setActiveTab('documents')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === 'documents'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Documents ({currentWorkspace?.document_count || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === 'analytics'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === 'settings'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>RAG Engine</span>
          </button>
        </nav>

        {/* Right: User / Theme Toggle */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          <div className="flex items-center space-x-2 pl-2 border-l border-slate-200 dark:border-slate-800">
            <div className="w-7 h-7 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center font-bold text-xs">
              {currentUser?.full_name ? currentUser.full_name[0].toUpperCase() : 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-none">
                {currentUser?.full_name || 'Demo Architect'}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                {currentUser?.email || 'demo@ragintelligence.ai'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Create Workspace */}
      {showNewWsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              Create New Knowledge Workspace
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Workspaces isolate documents, vector embeddings, and conversation histories.
            </p>
            <form onSubmit={handleCreateWorkspace}>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Workspace Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Financial Reports 2026, Legal Briefs..."
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowNewWsModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingWs || !newWsName.trim()}
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-all"
                >
                  {isCreatingWs ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
