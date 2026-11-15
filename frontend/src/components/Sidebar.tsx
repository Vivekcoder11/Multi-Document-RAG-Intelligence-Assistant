import React, { useState } from 'react';
import { Workspace, User } from '../types';
import { 
  LayoutDashboard, 
  Bot, 
  FileText, 
  BarChart3, 
  Sliders, 
  Layers, 
  Plus, 
  ChevronDown, 
  Check, 
  Sun, 
  Moon,
  Sparkles,
  LogOut,
  LogIn,
  UserPlus
} from 'lucide-react';

interface SidebarProps {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  currentUser: User | null;
  activeTab: 'dashboard' | 'assistant' | 'documents' | 'analytics' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'assistant' | 'documents' | 'analytics' | 'settings') => void;
  onSelectWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: (name: string) => Promise<void>;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  onOpenAuth?: (mode: 'login' | 'register') => void;
  onLogout?: () => void;
}

interface NavItem {
  id: 'dashboard' | 'assistant' | 'documents' | 'analytics' | 'settings';
  label: string;
  icon: any;
  badge?: string;
  count?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentWorkspace,
  workspaces,
  currentUser,
  activeTab,
  setActiveTab,
  onSelectWorkspace,
  onCreateWorkspace,
  darkMode,
  setDarkMode,
  onOpenAuth,
  onLogout,
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

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'assistant', label: 'AI Assistant', icon: Bot, badge: 'RAG' },
    { id: 'documents', label: 'My Documents', icon: FileText, count: currentWorkspace?.document_count },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Sliders },
  ];

  return (
    <>
      <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between h-screen sticky top-0 transition-colors z-30 select-none">
        {/* Top: Brand Header */}
        <div className="p-4 space-y-4">
          <div className="flex items-center space-x-3 px-2 py-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">
                  RAG Intelligence
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Enterprise Multi-Doc</p>
            </div>
          </div>

          {/* Workspace / Collection Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowWsMenu(!showWsMenu)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all"
            >
              <div className="flex items-center space-x-2 truncate">
                <Layers className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <span className="truncate">{currentWorkspace ? currentWorkspace.name : 'Select Workspace'}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 opacity-60 flex-shrink-0 ml-1" />
            </button>

            {showWsMenu && (
              <div className="absolute left-0 mt-1 w-full bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Workspaces / Collections
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => {
                        onSelectWorkspace(ws.id);
                        setShowWsMenu(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <span className="truncate">{ws.name}</span>
                      {currentWorkspace?.id === ws.id && (
                        <Check className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 ml-2" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
                  <button
                    onClick={() => {
                      setShowWsMenu(false);
                      setShowNewWsModal(true);
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Workspace</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 pt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                      {item.badge}
                    </span>
                  )}
                  {item.count !== undefined && item.count > 0 && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom: User Profile & Dark/Light Toggle */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Theme</span>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
            {currentUser ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5 truncate mr-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {currentUser.full_name ? currentUser.full_name[0].toUpperCase() : 'U'}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {currentUser.full_name || 'Architect'}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {currentUser.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1 flex-shrink-0">
                  {onOpenAuth && (
                    <button
                      onClick={() => onOpenAuth('login')}
                      title="Switch Account"
                      className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onLogout && (
                    <button
                      onClick={onLogout}
                      title="Sign Out"
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onOpenAuth && onOpenAuth('login')}
                  className="flex-1 py-1.5 px-3 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center justify-center space-x-1.5 shadow-sm"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
                <button
                  onClick={() => onOpenAuth && onOpenAuth('register')}
                  className="py-1.5 px-2.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition-all"
                  title="Create Account"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Modal: Create Workspace */}
      {showNewWsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              Create Knowledge Workspace
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
                  placeholder="e.g. Legal Documents, Research Papers..."
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
    </>
  );
};
