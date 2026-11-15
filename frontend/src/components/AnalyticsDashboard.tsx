import { AnalyticsData } from '../types';
import { 
  FileText, 
  Layers, 
  MessageSquare, 
  Clock, 
  TrendingUp
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  AreaChart, 
  Area 
} from 'recharts';

interface AnalyticsDashboardProps {
  data: AnalyticsData | null;
  isLoading: boolean;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  data,
  isLoading,
}) => {
  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center p-20 text-xs text-slate-400">
        Loading analytics metrics...
      </div>
    );
  }



  const statCards = [
    {
      label: 'Indexed Documents',
      value: data.total_documents,
      icon: FileText,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-950/50',
    },
    {
      label: 'Vector Chunks',
      value: data.total_chunks,
      icon: Layers,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-50 dark:bg-violet-950/50',
    },
    {
      label: 'Conversation Queries',
      value: data.total_chats,
      icon: MessageSquare,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/50',
    },
    {
      label: 'Average Latency',
      value: `${(data.avg_latency_ms / 1000).toFixed(2)}s`,
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {card.label}
                </span>
                <div className={`w-8 h-8 rounded-xl ${card.bg} ${card.color} flex items-center justify-center`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-3">
                {card.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chunks by Document */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Chunk Density per Document
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Total chunk slices ingested into hybrid index
              </p>
            </div>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>

          <div className="h-64 w-full">
            {data.chunks_by_doc && data.chunks_by_doc.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.chunks_by_doc} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 10, fill: '#94a3b8' }} 
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      borderColor: '#334155', 
                      borderRadius: '0.75rem',
                      color: '#fff',
                      fontSize: '12px'
                    }} 
                  />
                  <Bar dataKey="chunks" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No indexed document chunks yet
              </div>
            )}
          </div>
        </div>

        {/* Query History Activity */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                RAG Queries & Inferences
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Daily query volume and generation volume
              </p>
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>

          <div className="h-64 w-full">
            {data.query_history && data.query_history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.query_history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorQueries" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      borderColor: '#334155', 
                      borderRadius: '0.75rem',
                      color: '#fff',
                      fontSize: '12px'
                    }} 
                  />
                  <Area type="monotone" dataKey="queries" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorQueries)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No query trends recorded yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Frequently Queried Documents Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
          Most Referenced Knowledge Sources
        </h4>
        {data.frequently_queried && data.frequently_queried.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                  <th className="pb-3 font-semibold">Document</th>
                  <th className="pb-3 font-semibold">Queries Involved</th>
                  <th className="pb-3 font-semibold">Citations Extracted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.frequently_queried.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 font-medium text-slate-900 dark:text-white flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-indigo-500" />
                      <span>{item.filename}</span>
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">
                      {item.query_count}
                    </td>
                    <td className="py-3 text-indigo-600 dark:text-indigo-400 font-semibold">
                      {item.citation_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No document retrieval records yet</p>
        )}
      </div>
    </div>
  );
};
