import { useState, useRef } from 'react';
import { DocumentItem } from '../types';
import { 
  UploadCloud, 
  FileText, 
  Trash2, 
  RefreshCw, 
  Sparkles, 
  HelpCircle, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Columns, 
  Search 
} from 'lucide-react';

interface DocumentManagerProps {
  documents: DocumentItem[];
  workspaceId: string;
  onUpload: (files: File[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReindex: (id: string) => Promise<void>;
  onSummarize: (doc: DocumentItem) => void;
  onGenerateQuestions: (doc: DocumentItem) => void;
  onCompare: (doc1: DocumentItem, doc2: DocumentItem) => void;
  isLoading?: boolean;
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({
  documents,
  onUpload,
  onDelete,
  onReindex,
  onSummarize,
  onGenerateQuestions,
  onCompare,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredDocs = documents.filter((doc) =>
    doc.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      await onUpload(Array.from(files));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleSelectDoc = (id: string) => {
    if (selectedDocIds.includes(id)) {
      setSelectedDocIds(selectedDocIds.filter((item) => item !== id));
    } else {
      if (selectedDocIds.length >= 2) {
        setSelectedDocIds([selectedDocIds[1], id]);
      } else {
        setSelectedDocIds([...selectedDocIds, id]);
      }
    }
  };

  const handleCompareClick = () => {
    if (selectedDocIds.length === 2) {
      const doc1 = documents.find((d) => d.id === selectedDocIds[0]);
      const doc2 = documents.find((d) => d.id === selectedDocIds[1]);
      if (doc1 && doc2) {
        onCompare(doc1, doc2);
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 scale-[0.99]'
            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-indigo-400 dark:hover:border-indigo-500'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept=".pdf,.docx,.txt,.md"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            {isUploading ? (
              <RefreshCw className="w-6 h-6 animate-spin" />
            ) : (
              <UploadCloud className="w-6 h-6" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {isUploading
                ? 'Processing & Indexing Documents...'
                : 'Click or drag documents to upload'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Supports PDF, DOCX, TXT, and Markdown (up to 50MB per file)
            </p>
          </div>
        </div>
      </div>

      {/* Action Header & Compare Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          {selectedDocIds.length === 2 && (
            <button
              onClick={handleCompareClick}
              className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-all shadow-sm shadow-violet-500/20"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Compare 2 Selected</span>
            </button>
          )}

          <span className="text-xs text-slate-500 dark:text-slate-400">
            {selectedDocIds.length > 0
              ? `${selectedDocIds.length} of 2 selected for comparison`
              : `${documents.length} indexed documents`}
          </span>
        </div>
      </div>

      {/* Documents Grid / Table */}
      {filteredDocs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
          <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            No documents found
          </h4>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Upload files above to begin building your knowledge workspace.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => {
            const isSelected = selectedDocIds.includes(doc.id);
            return (
              <div
                key={doc.id}
                className={`group relative rounded-2xl p-5 border transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-md ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
                }`}
              >
                {/* Header: File info & Selection */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3 truncate">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <h4
                        className="text-xs font-semibold text-slate-900 dark:text-white truncate"
                        title={doc.filename}
                      >
                        {doc.filename}
                      </h4>
                      <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-0.5">
                        <span>{formatFileSize(doc.file_size)}</span>
                        <span>•</span>
                        <span>{doc.page_count || 1} pages</span>
                        <span>•</span>
                        <span>{doc.chunk_count || 0} chunks</span>
                      </div>
                    </div>
                  </div>

                  {/* Select for comparison checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectDoc(doc.id)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
                    title="Select to compare"
                  />
                </div>

                {/* Status Badge */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    {doc.status === 'indexed' && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Indexed</span>
                      </span>
                    )}
                    {doc.status === 'processing' && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                        <Clock className="w-3 h-3 animate-spin" />
                        <span>Processing</span>
                      </span>
                    )}
                    {doc.status === 'failed' && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
                        <AlertCircle className="w-3 h-3" />
                        <span>Failed</span>
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-400">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* AI Actions Row */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => onSummarize(doc)}
                      className="px-2 py-1 text-[11px] font-medium rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors flex items-center space-x-1"
                      title="Generate Executive Summary"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Summary</span>
                    </button>

                    <button
                      onClick={() => onGenerateQuestions(doc)}
                      className="px-2 py-1 text-[11px] font-medium rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors flex items-center space-x-1"
                      title="Generate Key Study Questions"
                    >
                      <HelpCircle className="w-3 h-3" />
                      <span>Questions</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => onReindex(doc.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Re-chunk and Re-index"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onDelete(doc.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      title="Delete document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
