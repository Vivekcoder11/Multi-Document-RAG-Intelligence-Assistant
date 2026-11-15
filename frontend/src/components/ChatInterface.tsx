import React, { useState, useRef, useEffect } from 'react';
import { ChatSession, ChatMessage, DocumentItem, Citation } from '../types';
import { 
  Send, 
  Bot, 
  User as UserIcon, 
  FileText, 
  Download, 
  Copy, 
  Check, 
  Plus, 
  Trash2, 
  BookOpen, 
  ChevronRight, 
  Sparkles, 
  Zap,
  PanelRightClose,
  PanelRightOpen,
  Filter,
  AlertCircle,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Square,
  RotateCcw,
  Languages
} from 'lucide-react';
import { 
  VoiceAssistant, 
  createSpeechRecognizer, 
  isSpeechRecognitionSupported, 
  isSpeechSynthesisSupported 
} from '../utils/speech';

interface ChatInterfaceProps {
  sessions: ChatSession[];
  activeSession: ChatSession | null;
  messages: ChatMessage[];
  documents: DocumentItem[];
  onSelectSession: (session: ChatSession) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onSendMessage: (
    message: string, 
    scopedDocIds: string[], 
    hybridAlpha: number
  ) => Promise<void>;
  onExportPdf: (message: ChatMessage) => void;
  isSending: boolean;
  hasApiKey?: boolean;
  onOpenSettings?: () => void;
  onStopSending?: () => void;
  onClearChat?: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  sessions,
  activeSession,
  messages,
  documents,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onSendMessage,
  onExportPdf,
  isSending,
  hasApiKey,
  onOpenSettings,
  onStopSending,
  onClearChat,
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [searchMode, setSearchMode] = useState<'hybrid' | 'vector' | 'keyword'>('hybrid');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeCitationMsg, setActiveCitationMsg] = useState<ChatMessage | null>(null);
  const [isEvidencePanelOpen, setIsEvidencePanelOpen] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Stop any active speech on unmount
  useEffect(() => {
    return () => {
      VoiceAssistant.stop();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  const toggleListening = () => {
    if (!isSpeechRecognitionSupported()) {
      setSpeechNotice('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      setTimeout(() => setSpeechNotice(null), 4000);
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    try {
      const recognizer = createSpeechRecognizer(
        (transcript, isFinal) => {
          setInputText((prev) => {
            const trimmed = prev.trim();
            if (!trimmed) return transcript;
            if (isFinal) return `${trimmed} ${transcript}`;
            return prev;
          });
          if (isFinal) {
            setIsListening(false);
          }
        },
        (err) => {
          console.warn('Speech recognition error:', err);
          setIsListening(false);
          if (err !== 'no-speech') {
            setSpeechNotice(`Microphone notice: ${err}`);
            setTimeout(() => setSpeechNotice(null), 3500);
          }
        },
        () => {
          setIsListening(false);
        }
      );

      if (recognizer) {
        recognitionRef.current = recognizer;
        recognizer.start();
        setIsListening(true);
        setSpeechNotice(null);
      }
    } catch (e: any) {
      console.error('Failed to start speech recognition:', e);
      setIsListening(false);
    }
  };

  const toggleSpeak = (msg: ChatMessage) => {
    if (!isSpeechSynthesisSupported()) {
      setSpeechNotice('Speech synthesis is not supported in this browser.');
      setTimeout(() => setSpeechNotice(null), 3500);
      return;
    }

    if (playingMsgId === msg.id) {
      VoiceAssistant.stop();
      setPlayingMsgId(null);
      return;
    }

    VoiceAssistant.speak(msg.content, {
      onStart: () => setPlayingMsgId(msg.id),
      onEnd: () => setPlayingMsgId(null),
      onError: () => setPlayingMsgId(null),
    });
  };

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Set latest assistant message citations as active by default
  useEffect(() => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.citations && m.citations.length > 0);
    if (lastAssistant) {
      setActiveCitationMsg(lastAssistant);
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;
    const msg = inputText.trim();
    setInputText('');

    let alpha = 0.65;
    if (searchMode === 'vector') alpha = 1.0;
    if (searchMode === 'keyword') alpha = 0.0;

    await onSendMessage(msg, selectedDocs, alpha);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleDocSelection = (id: string) => {
    setSelectedDocs((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const selectAllDocs = () => {
    if (selectedDocs.length === documents.length) {
      setSelectedDocs([]);
    } else {
      setSelectedDocs(documents.map((d) => d.id));
    }
  };

  const starterQuestions = [
    "What are the core technical constraints and architectural components described?",
    "Is document ka complete summary Hinglish me samjhao",
    "Key skills, projects aur experience points bataiye (in Hinglish)",
    "Compare the different methodologies and identify potential tradeoffs."
  ];

  return (
    <div className="flex h-[calc(100vh-6.5rem)] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      {/* ----------------- COLUMN 1: LEFT PANEL (Sessions & Scope) ----------------- */}
      <div className="w-72 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col justify-between hidden md:flex">
        {/* Top: New Chat & Sessions List */}
        <div className="p-4 flex-1 overflow-hidden flex flex-col">
          <button
            onClick={onNewSession}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-500/20 transition-all mb-4"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat Session</span>
          </button>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">
              Conversations
            </p>
            {sessions.length === 0 ? (
              <p className="text-xs text-slate-400 italic px-2 py-3">No conversations yet</p>
            ) : (
              sessions.map((session) => {
                const isActive = activeSession?.id === session.id;
                return (
                  <div
                    key={session.id}
                    onClick={() => onSelectSession(session)}
                    className={`group flex items-center justify-between px-3 py-2 text-xs rounded-xl cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-medium'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <Bot className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                      <span className="truncate">{session.title || 'Untitled Session'}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this chat conversation?')) {
                          onDeleteSession(session.id);
                        }
                      }}
                      title="Delete conversation"
                      className="opacity-70 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Bottom: Engine Mode & Scope Selection */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 space-y-3">
          {/* Retrieval Engine Selector */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              <span>Retrieval Mode</span>
            </div>
            <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-[10px] font-medium text-slate-600 dark:text-slate-400">
              <button
                onClick={() => setSearchMode('hybrid')}
                className={`py-1 rounded text-center transition-all ${
                  searchMode === 'hybrid'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                    : 'hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Dense Vector + BM25 Lexical"
              >
                Hybrid
              </button>
              <button
                onClick={() => setSearchMode('vector')}
                className={`py-1 rounded text-center transition-all ${
                  searchMode === 'vector'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                    : 'hover:text-slate-900 dark:hover:text-white'
                }`}
                title="ChromaDB Dense Vectors"
              >
                Vector
              </button>
              <button
                onClick={() => setSearchMode('keyword')}
                className={`py-1 rounded text-center transition-all ${
                  searchMode === 'keyword'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                    : 'hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Rank-BM25 Lexical Search"
              >
                BM25
              </button>
            </div>
          </div>

          {/* Document Scope Filter */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              <span className="flex items-center space-x-1">
                <Filter className="w-3 h-3 text-indigo-500" />
                <span>Document Scope</span>
              </span>
              <button
                onClick={selectAllDocs}
                className="text-indigo-600 dark:text-indigo-400 lowercase hover:underline font-normal text-[10px]"
              >
                {selectedDocs.length === documents.length ? 'clear' : 'select all'}
              </button>
            </div>
            <div className="max-h-28 overflow-y-auto space-y-1">
              {documents.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">No indexed documents</p>
              ) : (
                documents.map((doc) => {
                  const isChecked = selectedDocs.includes(doc.id);
                  return (
                    <label
                      key={doc.id}
                      className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 truncate"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleDocSelection(doc.id)}
                        className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                      />
                      <span className="truncate" title={doc.filename}>
                        {doc.filename}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ----------------- COLUMN 2: CENTER PANEL (Chat Conversation) ----------------- */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 min-w-0">
        {/* Chat Header Bar */}
        <div className="h-12 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center space-x-2 truncate">
            <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
              {activeSession ? activeSession.title : 'AI Intelligence Assistant'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="hidden sm:inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80">
              <Languages className="w-3 h-3" />
              <span>Hinglish + English</span>
            </span>

            {messages.length > 0 && onClearChat && (
              <button
                onClick={() => {
                  if (confirm('Clear all messages in this conversation?')) {
                    onClearChat();
                  }
                }}
                className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center space-x-1 text-xs"
                title="Clear all messages in this conversation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">Clear Chat</span>
              </button>
            )}

            {activeSession && (
              <button
                onClick={() => {
                  if (confirm('Delete this entire chat conversation?')) {
                    onDeleteSession(activeSession.id);
                  }
                }}
                className="p-1.5 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center space-x-1 text-xs"
                title="Delete this entire session"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">Delete</span>
              </button>
            )}

            <button
              onClick={() => setIsEvidencePanelOpen(!isEvidencePanelOpen)}
              className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center space-x-1 text-xs"
              title={isEvidencePanelOpen ? 'Hide Evidence Panel' : 'Show Evidence Panel'}
            >
              {isEvidencePanelOpen ? (
                <>
                  <PanelRightClose className="w-4 h-4" />
                  <span className="hidden sm:inline text-[11px]">Hide Evidence</span>
                </>
              ) : (
                <>
                  <PanelRightOpen className="w-4 h-4" />
                  <span className="hidden sm:inline text-[11px]">Show Evidence</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Warning Banner when Gemini API Key is missing */}
        {hasApiKey === false && (
          <div className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-900/60 px-4 py-2.5 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
            <div className="flex items-center space-x-2 truncate">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span className="truncate">
                <strong>Local Extraction Mode:</strong> Gemini API Key not set. Add your API key to get full AI explanations.
              </span>
            </div>
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="ml-3 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] flex-shrink-0 transition-all shadow-xs"
              >
                Add Free API Key
              </button>
            )}
          </div>
        )}

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 shadow-sm">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Multi-Document Reasoning Assistant
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-6">
                Query across your uploaded knowledge sources. Every synthesized response is verified against document excerpts and grounded with source citations.
              </p>

              {/* Starter Questions */}
              <div className="w-full space-y-2">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-left">
                  Suggested Prompts:
                </p>
                {starterQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInputText(q)}
                    className="w-full text-left p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 text-slate-700 dark:text-slate-300 transition-all flex items-center justify-between group"
                  >
                    <span>{q}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              const isSelectedMsg = activeCitationMsg?.id === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`flex items-start space-x-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div className="max-w-[85%] sm:max-w-[80%] space-y-2">
                    <div
                      className={`p-4 rounded-2xl text-xs leading-relaxed ${
                        isUser
                          ? 'bg-indigo-600 text-white rounded-br-none shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 rounded-bl-none border border-slate-200/80 dark:border-slate-700/60'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>

                    {/* Metadata & Actions for Assistant Response */}
                    {!isUser && (
                      <div className="flex items-center space-x-3 text-[11px] text-slate-400 px-1">
                        {msg.latency_ms && (
                          <span className="flex items-center space-x-1">
                            <Zap className="w-3 h-3 text-amber-500" />
                            <span>{(msg.latency_ms / 1000).toFixed(2)}s</span>
                          </span>
                        )}

                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="hover:text-slate-600 dark:hover:text-slate-200 flex items-center space-x-1 transition-colors"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                        </button>

                        {/* AI Voice Read Aloud Button */}
                        <button
                          onClick={() => toggleSpeak(msg)}
                          className={`hover:text-slate-600 dark:hover:text-slate-200 flex items-center space-x-1 transition-colors ${
                            playingMsgId === msg.id ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : ''
                          }`}
                          title={playingMsgId === msg.id ? 'Stop Voice' : 'Read Aloud with AI Voice'}
                        >
                          {playingMsgId === msg.id ? (
                            <>
                              <VolumeX className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                              <span className="text-indigo-600 dark:text-indigo-400">Stop Voice</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>Read Aloud</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => onExportPdf(msg)}
                          className="hover:text-slate-600 dark:hover:text-slate-200 flex items-center space-x-1 transition-colors"
                          title="Export Answer Report to PDF"
                        >
                          <Download className="w-3 h-3" />
                          <span>PDF Report</span>
                        </button>

                        {msg.citations && msg.citations.length > 0 && (
                          <button
                            onClick={() => {
                              setActiveCitationMsg(msg);
                              setIsEvidencePanelOpen(true);
                            }}
                            className={`flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                              isSelectedMsg
                                ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400'
                            }`}
                          >
                            <BookOpen className="w-3 h-3" />
                            <span>{msg.citations.length} Citations</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                      <UserIcon className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })
          )}

          {isSending && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                <Bot className="w-4 h-4 animate-pulse" />
              </div>
              <div className="p-3.5 rounded-2xl rounded-bl-none bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between space-x-4 min-w-[280px]">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Generating grounded response...</span>
                </div>
                {onStopSending && (
                  <button
                    onClick={onStopSending}
                    className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-lg border border-rose-200 dark:border-rose-800/80 flex items-center space-x-1.5 transition-all shadow-xs"
                    title="Stop generation in mid-flight"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Stop</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          {/* Active Voice Listening Banner */}
          {isListening && (
            <div className="mb-2 p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300">
              <div className="flex items-center space-x-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
                <span className="font-medium text-[11px]">Listening... speak your question now</span>
              </div>
              <button
                type="button"
                onClick={toggleListening}
                className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline"
              >
                Stop
              </button>
            </div>
          )}

          {speechNotice && (
            <div className="mb-2 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 text-[11px] text-amber-800 dark:text-amber-300">
              {speechNotice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? 'Listening to your voice...' : 'Ask anything across your uploaded documents...'}
              disabled={isSending}
              className="w-full pl-4 pr-20 py-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
            />
            <div className="absolute right-2 flex items-center space-x-1">
              <button
                type="button"
                onClick={toggleListening}
                className={`p-2 rounded-lg transition-all ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30'
                    : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title={isListening ? 'Stop Listening' : 'Speak Question (Voice Input)'}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {isSending && onStopSending ? (
                <button
                  type="button"
                  onClick={onStopSending}
                  className="p-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-sm shadow-rose-500/20"
                  title="Stop Generating (Mid-flight)"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition-all shadow-sm shadow-indigo-500/20"
                  title="Send Message"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 px-1">
            <span>
              Scope:{' '}
              {selectedDocs.length === 0
                ? 'All documents'
                : `${selectedDocs.length} specific document${selectedDocs.length > 1 ? 's' : ''}`}
            </span>
            <span>
              Engine:{' '}
              {searchMode === 'hybrid'
                ? 'Hybrid (Vector + BM25)'
                : searchMode === 'vector'
                ? 'Chroma Vector'
                : 'BM25 Lexical'}
            </span>
          </div>
        </div>
      </div>

      {/* ----------------- COLUMN 3: RIGHT PANEL (Sources & Evidence Panel) ----------------- */}
      {isEvidencePanelOpen && (
        <div className="w-80 border-l border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col justify-between hidden lg:flex animate-in slide-in-from-right duration-200">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-indigo-500" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                Sources & Evidence
              </h4>
            </div>
            <button
              onClick={() => setIsEvidencePanelOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
              title="Close panel"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeCitationMsg && activeCitationMsg.citations && activeCitationMsg.citations.length > 0 ? (
              activeCitationMsg.citations.map((cite: Citation, idx: number) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center space-x-1.5 truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                      <FileText className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                      <span className="truncate" title={cite.filename}>{cite.filename}</span>
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                      {(cite.score * 100).toFixed(0)}% Match
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-400 font-medium">
                    Page {cite.page_number} • Chunk #{cite.chunk_id?.slice(-4) || idx + 1}
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/50 text-[11px] text-slate-600 dark:text-slate-300 italic leading-relaxed border border-slate-100 dark:border-slate-800/60">
                    "{cite.excerpt}"
                  </div>
                </div>
              ))
            ) : (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="text-xs font-semibold">No citations active</p>
                <p className="text-[11px] text-slate-400">
                  Ask a question to see exact document source attribution here.
                </p>
              </div>
            )}
          </div>

          {activeCitationMsg && (
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
              <button
                onClick={() => onExportPdf(activeCitationMsg)}
                className="w-full flex items-center justify-center space-x-2 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Executive PDF</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
