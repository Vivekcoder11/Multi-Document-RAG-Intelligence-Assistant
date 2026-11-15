import { useState } from 'react';
import { X, Copy, Check, Sparkles, HelpCircle, Columns } from 'lucide-react';

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'summary' | 'questions' | 'compare';
  content: string | string[];
  isLoading: boolean;
}

export const ActionModal: React.FC<ActionModalProps> = ({
  isOpen,
  onClose,
  title,
  type,
  content,
  isLoading,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    const textToCopy = Array.isArray(content) ? content.join('\n\n') : content;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getIcon = () => {
    switch (type) {
      case 'summary':
        return <Sparkles className="w-5 h-5 text-indigo-500" />;
      case 'questions':
        return <HelpCircle className="w-5 h-5 text-emerald-500" />;
      case 'compare':
        return <Columns className="w-5 h-5 text-violet-500" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              {getIcon()}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {title}
              </h3>
              <p className="text-xs text-slate-400 capitalize">
                AI Knowledge Extraction ({type})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-5 space-y-4">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3 text-slate-400">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
              <p className="text-xs">Analyzing documents with Gemini Intelligence...</p>
            </div>
          ) : Array.isArray(content) ? (
            <div className="space-y-3">
              {content.map((q, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-xs text-slate-800 dark:text-slate-200 flex items-start space-x-3"
                >
                  <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-center flex-shrink-0 text-[10px]">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{q}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
              {content}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button
            onClick={handleCopy}
            disabled={isLoading || (!content && !Array.isArray(content))}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            <span>{copied ? 'Copied to Clipboard' : 'Copy Content'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
