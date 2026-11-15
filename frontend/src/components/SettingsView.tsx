import { useState, useEffect } from 'react';
import { RAGSettings } from '../types';
import { 
  Sliders, 
  Key, 
  Cpu, 
  Check, 
  RefreshCw, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface SettingsViewProps {
  settings: (RAGSettings & { supported_models?: { id: string; name: string }[] }) | null;
  onSaveSettings: (updated: Partial<RAGSettings>) => Promise<void>;
  isLoading?: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-3.1-flash-lite');
  const [chunkSize, setChunkSize] = useState(800);
  const [chunkOverlap, setChunkOverlap] = useState(150);
  const [topK, setTopK] = useState(5);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.35);
  const [hybridAlpha, setHybridAlpha] = useState(0.65);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (settings) {
      setGeminiModel(settings.gemini_model || 'gemini-1.5-flash');
      setChunkSize(settings.chunk_size || 800);
      setChunkOverlap(settings.chunk_overlap || 150);
      setTopK(settings.top_k || 5);
      setSimilarityThreshold(settings.similarity_threshold || 0.35);
      setHybridAlpha(settings.hybrid_alpha !== undefined ? settings.hybrid_alpha : 0.65);
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const payload: any = {
        gemini_model: geminiModel,
        chunk_size: Number(chunkSize),
        chunk_overlap: Number(chunkOverlap),
        top_k: Number(topK),
        similarity_threshold: Number(similarityThreshold),
        hybrid_alpha: Number(hybridAlpha),
      };
      if (apiKey.trim()) {
        payload.gemini_api_key = apiKey.trim();
      }
      await onSaveSettings(payload);
      setSaveSuccess(true);
      setApiKey('');
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              RAG Pipeline & Model Configuration
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tune chunking parameters, hybrid alpha balance, and Gemini model settings.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Gemini API Key */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <Key className="w-4 h-4 text-indigo-500" />
                <span>Google Gemini API Key</span>
              </label>
              {settings?.has_api_key ? (
                <span className="flex items-center space-x-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>API Key Configured</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1 text-[11px] font-medium text-amber-500">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Key Not Set (using mock/local embeddings)</span>
                </span>
              )}
            </div>
            <input
              type="password"
              placeholder={settings?.has_api_key ? '•••••••••••••••••••••••••••• (Key Configured - leave blank to keep)' : 'Enter your Gemini API key'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[10px] text-slate-400">
              Supports both Google AI Studio Auth Keys (<span className="font-mono text-indigo-400">AQ...</span>) and standard API keys (<span className="font-mono text-indigo-400">AIzaSy...</span>).
            </p>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <Cpu className="w-4 h-4 text-indigo-500" />
              <span>Generation & Synthesis Model</span>
            </label>
            <select
              value={geminiModel}
              onChange={(e) => setGeminiModel(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Ultra-Fast 1.0s - Recommended)</option>
              <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite (Fast & Efficient)</option>
              <option value="gemini-3.5-flash">Gemini 3.5 Flash (Balanced Reasoning)</option>
            </select>
          </div>

          {/* Sliders: Hybrid Alpha */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
              <span>Hybrid Search Alpha Weight</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400">
                {hybridAlpha.toFixed(2)} ({(1 - hybridAlpha).toFixed(2)} BM25 / {hybridAlpha.toFixed(2)} Vector)
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={hybridAlpha}
              onChange={(e) => setHybridAlpha(parseFloat(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>0.0 (Pure Lexical BM25)</span>
              <span>0.5 (Balanced Hybrid)</span>
              <span>1.0 (Pure Dense Vector)</span>
            </div>
          </div>

          {/* Chunk Size & Overlap */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                Chunk Size (Tokens)
              </label>
              <input
                type="number"
                min="100"
                max="2500"
                step="50"
                value={chunkSize}
                onChange={(e) => setChunkSize(parseInt(e.target.value) || 800)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[10px] text-slate-400">Recommended: 600 - 1000 tokens</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                Chunk Overlap (Tokens)
              </label>
              <input
                type="number"
                min="0"
                max="400"
                step="25"
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(parseInt(e.target.value) || 150)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[10px] text-slate-400">Recommended: 100 - 200 tokens</p>
            </div>
          </div>

          {/* Top-K & Threshold */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                Top-K Retrieved Chunks
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value) || 5)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[10px] text-slate-400">Context pieces injected into synthesis</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                Similarity Cutoff Threshold
              </label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={similarityThreshold}
                onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value) || 0.35)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[10px] text-slate-400">Filter chunks with score below cutoff</p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            {saveSuccess ? (
              <span className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <Check className="w-4 h-4" />
                <span>Settings saved successfully!</span>
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">
                Changes apply immediately to subsequent queries.
              </span>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-all shadow-sm shadow-indigo-500/20 flex items-center space-x-1.5"
            >
              {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSaving ? 'Saving Changes...' : 'Save Configuration'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
