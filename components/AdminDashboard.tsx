import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Users, TrendingUp, Clock, Award, 
  BarChart2, Calendar, ChevronDown, RefreshCw,
  Phone, MessageSquare, Mic, Target, AlertTriangle
} from 'lucide-react';

interface TrainingCost {
  totalCostUsd: number;
  chatCost: number;
  ttsCost: number;
  totalSessions: number;
  totalMessages: number;
  totalAudioSeconds: number;
  inputTokens: number;
  outputTokens: number;
}

interface AgentStats {
  userId: string;
  userName: string;
  email: string;
  totalSessions: number;
  totalMessages: number;
  avgSessionDuration: number;
  avgScore: number;
  totalCostUsd: number;
  lastTrainingDate: string;
  scenariosCompleted: string[];
}

interface DailyUsage {
  date: string;
  sessions: number;
  messages: number;
  costUsd: number;
}

interface ScenarioStats {
  scenarioId: string;
  scenarioName: string;
  totalSessions: number;
  avgScore: number;
  avgDuration: number;
}

const AdminDashboard: React.FC = () => {
  const [costs, setCosts] = useState<TrainingCost | null>(null);
  const [agentStats, setAgentStats] = useState<AgentStats[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [scenarioStats, setScenarioStats] = useState<ScenarioStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [error, setError] = useState<string | null>(null);

  const getApiUrl = () => {
    return window.location.origin.replace(':5173', ':3001');
  };

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('authToken');
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      // Fetch all admin data in parallel
      const [costsRes, agentsRes, dailyRes, scenariosRes] = await Promise.all([
        fetch(`${getApiUrl()}/api/admin/training/costs?range=${dateRange}`, { headers }),
        fetch(`${getApiUrl()}/api/admin/training/agents?range=${dateRange}`, { headers }),
        fetch(`${getApiUrl()}/api/admin/training/daily-usage?range=${dateRange}`, { headers }),
        fetch(`${getApiUrl()}/api/admin/training/scenarios?range=${dateRange}`, { headers })
      ]);

      if (!costsRes.ok || !agentsRes.ok) {
        if (costsRes.status === 403 || agentsRes.status === 403) {
          throw new Error('Access denied. Admin privileges required.');
        }
        throw new Error('Failed to fetch admin data');
      }

      const [costsData, agentsData, dailyData, scenariosData] = await Promise.all([
        costsRes.json(),
        agentsRes.json(),
        dailyRes.json(),
        scenariosRes.json()
      ]);

      setCosts(costsData);
      setAgentStats(agentsData.agents || []);
      setDailyUsage(dailyData.usage || []);
      setScenarioStats(scenariosData.scenarios || []);
    } catch (err: any) {
      console.error('Failed to fetch admin data:', err);
      setError(err.message || 'Failed to load admin dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [dateRange]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(num));
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h3>
        <p className="text-gray-500 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h2>
          <p className="text-gray-500 dark:text-gray-400">Training costs & agent performance analytics</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date Range Selector */}
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="appearance-none bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-2 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          
          <button
            onClick={fetchAdminData}
            className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Cost Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <DollarSign className="w-8 h-8 opacity-80" />
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Total Cost</span>
          </div>
          <div className="text-3xl font-bold mb-1">{formatCurrency(costs?.totalCostUsd || 0)}</div>
          <p className="text-green-100 text-sm">OpenAI API usage</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <MessageSquare className="w-8 h-8 opacity-80" />
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Chat API</span>
          </div>
          <div className="text-3xl font-bold mb-1">{formatCurrency(costs?.chatCost || 0)}</div>
          <p className="text-blue-100 text-sm">{formatNumber(costs?.inputTokens || 0)} in / {formatNumber(costs?.outputTokens || 0)} out tokens</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <Mic className="w-8 h-8 opacity-80" />
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">TTS API</span>
          </div>
          <div className="text-3xl font-bold mb-1">{formatCurrency(costs?.ttsCost || 0)}</div>
          <p className="text-purple-100 text-sm">{formatDuration(costs?.totalAudioSeconds || 0)} of audio</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <Phone className="w-8 h-8 opacity-80" />
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Sessions</span>
          </div>
          <div className="text-3xl font-bold mb-1">{formatNumber(costs?.totalSessions || 0)}</div>
          <p className="text-orange-100 text-sm">{formatNumber(costs?.totalMessages || 0)} messages total</p>
        </div>
      </div>

      {/* Agent Comparison Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="p-5 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            Agent Performance Comparison
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-700/50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Agent</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sessions</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Messages</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Duration</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Score</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cost</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Training</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {agentStats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                    No agent training data available
                  </td>
                </tr>
              ) : (
                agentStats.map((agent, idx) => (
                  <tr key={agent.userId} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                          idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-600' : 'bg-blue-500'
                        }`}>
                          {idx < 3 ? (
                            <Award className="w-5 h-5" />
                          ) : (
                            agent.userName?.charAt(0)?.toUpperCase() || 'A'
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">{agent.userName || 'Unknown'}</div>
                          <div className="text-xs text-gray-500">{agent.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center font-medium">{agent.totalSessions}</td>
                    <td className="px-5 py-4 text-center">{agent.totalMessages}</td>
                    <td className="px-5 py-4 text-center">{formatDuration(agent.avgSessionDuration || 0)}</td>
                    <td className="px-5 py-4 text-center">
                      {agent.avgScore ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          agent.avgScore >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          agent.avgScore >= 60 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {Math.round(agent.avgScore)}%
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center font-mono text-sm">{formatCurrency(agent.totalCostUsd || 0)}</td>
                    <td className="px-5 py-4 text-center text-sm text-gray-500">
                      {agent.lastTrainingDate ? new Date(agent.lastTrainingDate).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scenario Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scenario Stats */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
          <div className="p-5 border-b border-gray-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-500" />
              Scenario Performance
            </h3>
          </div>
          <div className="p-5 space-y-4">
            {scenarioStats.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">No scenario data available</p>
            ) : (
              scenarioStats.map((scenario) => (
                <div key={scenario.scenarioId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{scenario.scenarioName}</div>
                    <div className="text-xs text-gray-500">{scenario.totalSessions} sessions • Avg {formatDuration(scenario.avgDuration)}</div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                    scenario.avgScore >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    scenario.avgScore >= 60 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    scenario.avgScore > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-gray-100 text-gray-500 dark:bg-slate-600 dark:text-gray-400'
                  }`}>
                    {scenario.avgScore > 0 ? `${Math.round(scenario.avgScore)}%` : 'N/A'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Daily Usage Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
          <div className="p-5 border-b border-gray-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-green-500" />
              Daily Usage Trend
            </h3>
          </div>
          <div className="p-5">
            {dailyUsage.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">No usage data available</p>
            ) : (
              <div className="space-y-3">
                {dailyUsage.slice(-10).map((day) => (
                  <div key={day.date} className="flex items-center gap-3">
                    <div className="w-20 text-xs text-gray-500 dark:text-gray-400">
                      {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="flex-1 h-6 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (day.sessions / Math.max(...dailyUsage.map(d => d.sessions || 1))) * 100)}%` }}
                      />
                    </div>
                    <div className="w-16 text-right text-sm font-medium">{day.sessions} sess</div>
                    <div className="w-20 text-right text-xs text-gray-500">{formatCurrency(day.costUsd)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cost Breakdown Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 OpenAI API Pricing Reference</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-800 dark:text-blue-200">
          <div>
            <strong>GPT-4o-mini:</strong>
            <ul className="list-disc list-inside mt-1 text-blue-700 dark:text-blue-300">
              <li>Input: $0.15 / 1M tokens</li>
              <li>Output: $0.60 / 1M tokens</li>
            </ul>
          </div>
          <div>
            <strong>TTS (Text-to-Speech):</strong>
            <ul className="list-disc list-inside mt-1 text-blue-700 dark:text-blue-300">
              <li>$15.00 / 1M characters</li>
              <li>~$0.015 per 1000 chars</li>
            </ul>
          </div>
          <div>
            <strong>Estimated Monthly:</strong>
            <ul className="list-disc list-inside mt-1 text-blue-700 dark:text-blue-300">
              <li>10 agents, 5 sessions/day</li>
              <li>≈ $30-50/month</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
