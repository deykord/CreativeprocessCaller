import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { AgentStats } from '../types';
import { Phone, CheckCircle, Clock, Calendar, RefreshCw, AlertCircle, TrendingUp } from 'lucide-react';
import { backendAPI } from '../services/BackendAPI';

interface Props {
  stats: AgentStats;
}

interface DashboardData {
  callsMade: number;
  connections: number;
  appointmentsSet: number;
  talkTime: number;
  prospects: {
    total: number;
    new: number;
    contacted: number;
    qualified: number;
    lost: number;
  };
  recentCalls: Array<{
    id: string;
    prospectId: string;
    prospectName: string;
    company: string;
    outcome: string;
    duration: number;
    timestamp: string;
    notes: string;
  }>;
}

// Memoized stat card to prevent re-renders
const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string }> = React.memo(({ title, value, icon, color }) => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center space-x-4 transition hover:shadow-md">
    <div className={`p-3 rounded-full ${color} text-white`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{value}</h3>
    </div>
  </div>
));

export const DashboardStats: React.FC<Props> = React.memo(({ stats: propStats }) => {
  const [dbStats, setDbStats] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch dashboard stats from database
  const fetchStats = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const data = await backendAPI.getDashboardStats(period);
      setDbStats(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      // Fall back to prop stats if API fails
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [period]);

  // Initial fetch and auto-refresh every 30 seconds
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Use database stats if available, otherwise fall back to props
  const stats: AgentStats = dbStats ? {
    callsMade: dbStats.callsMade,
    connections: dbStats.connections,
    appointmentsSet: dbStats.appointmentsSet,
    talkTime: dbStats.talkTime
  } : propStats;

  // Pipeline insights from database
  const pipelineInsights = dbStats?.prospects || {
    total: 0,
    new: 0,
    contacted: 0,
    qualified: 0,
    lost: 0
  };

  // Calculate rates
  const connectionRate = stats.callsMade > 0 ? Math.round((stats.connections / stats.callsMade) * 100) : 0;
  const appointmentRate = stats.connections > 0 ? Math.round((stats.appointmentsSet / stats.connections) * 100) : 0;

  // Memoize stat card configurations to prevent object recreation
  const statCards = useMemo(() => [
    { title: "Calls Made", value: stats.callsMade, icon: <Phone size={20} />, color: "bg-blue-500" },
    { title: "Connections", value: stats.connections, icon: <CheckCircle size={20} />, color: "bg-green-500" },
    { title: "Appointments", value: stats.appointmentsSet, icon: <Calendar size={20} />, color: "bg-purple-500" },
    { title: "Talk Time (m)", value: stats.talkTime, icon: <Clock size={20} />, color: "bg-orange-500" }
  ], [stats.callsMade, stats.connections, stats.appointmentsSet, stats.talkTime]);

  return (
    <div className="space-y-6">
      {/* Header with period selector and refresh */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value as 'today' | 'week' | 'month' | 'all')}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchStats}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <StatCard key={idx} {...card} />
        ))}
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KPIs */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 p-6 rounded-xl border border-blue-200 dark:border-slate-600">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-600 dark:text-blue-400" />
            Key Performance Indicators
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Connection Rate</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">{connectionRate}%</p>
              <div className="w-full h-1 bg-gray-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-blue-600 dark:bg-blue-400" style={{ width: `${connectionRate}%` }}></div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Appointment Rate</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2">{appointmentRate}%</p>
              <div className="w-full h-1 bg-gray-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-purple-600 dark:bg-purple-400" style={{ width: `${appointmentRate}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Pipeline Insights */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-6 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertCircle size={20} className="text-emerald-600 dark:text-emerald-400" />
            Pipeline Overview
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">New Leads</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">{pipelineInsights.new}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Contacted</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2">{pipelineInsights.contacted}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Qualified</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">{pipelineInsights.qualified}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Total Leads</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-2">{pipelineInsights.total}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {!dbStats?.recentCalls || dbStats.recentCalls.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No recent calls for this period</p>
          ) : (
            dbStats.recentCalls.slice(0, 10).map((call, idx) => (
              <div key={call.id || idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{call.prospectName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{call.outcome || 'No outcome'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {Math.floor((call.duration || 0) / 60)}m {(call.duration || 0) % 60}s
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {call.timestamp ? new Date(call.timestamp).toLocaleTimeString() : ''}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
});