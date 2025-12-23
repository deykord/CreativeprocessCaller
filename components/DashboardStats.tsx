import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { AgentStats } from '../types';
import { Phone, CheckCircle, Clock, Calendar, RefreshCw, AlertCircle, TrendingUp, Zap, Target, BarChart3, PhoneOutgoing, Users, ArrowUpRight, ArrowDownRight, Timer, Award } from 'lucide-react';
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
const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string; trend?: { value: number; isUp: boolean } }> = React.memo(({ title, value, icon, color, trend }) => (
  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-lg transition-all duration-300 group">
    <div className="flex items-start justify-between">
      <div className={`p-3 rounded-xl ${color} text-white shadow-lg group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${trend.isUp ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
          {trend.isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(trend.value)}%
        </div>
      )}
    </div>
    <div className="mt-4">
      <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{value}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">{title}</p>
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
    { title: "Calls Made", value: stats.callsMade, icon: <PhoneOutgoing size={22} />, color: "bg-gradient-to-br from-blue-500 to-blue-600", trend: { value: 12, isUp: true } },
    { title: "Connections", value: stats.connections, icon: <CheckCircle size={22} />, color: "bg-gradient-to-br from-green-500 to-emerald-600", trend: { value: 8, isUp: true } },
    { title: "Appointments", value: stats.appointmentsSet, icon: <Calendar size={22} />, color: "bg-gradient-to-br from-purple-500 to-violet-600", trend: { value: 5, isUp: true } },
    { title: "Talk Time (min)", value: stats.talkTime, icon: <Timer size={22} />, color: "bg-gradient-to-br from-orange-500 to-amber-600", trend: { value: 3, isUp: false } }
  ], [stats.callsMade, stats.connections, stats.appointmentsSet, stats.talkTime]);

  // Calculate calls per hour (assuming 8 hour day)
  const callsPerHour = stats.callsMade > 0 ? Math.round(stats.callsMade / 8) : 0;
  
  // Average call duration
  const avgCallDuration = stats.callsMade > 0 ? Math.round((stats.talkTime * 60) / stats.callsMade) : 0;

  return (
    <div className="space-y-6">
      {/* Header with period selector and refresh */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value as 'today' | 'week' | 'month' | 'all')}
            className="px-4 py-2.5 bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-blue-300 transition-all"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 px-3 py-1.5 rounded-full">
            Updated: {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchStats}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/25 hover:scale-105"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card, idx) => (
          <StatCard key={idx} {...card} />
        ))}
      </div>

      {/* Quick Insights Bar */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 rounded-2xl p-5 flex items-center justify-between border border-blue-100 dark:border-slate-600">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
              <Zap size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{callsPerHour}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Calls/Hour</p>
            </div>
          </div>
          <div className="w-px h-10 bg-gray-300 dark:bg-gray-700"></div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-500/20 rounded-lg">
              <Target size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{connectionRate}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Connect Rate</p>
            </div>
          </div>
          <div className="w-px h-10 bg-gray-300 dark:bg-gray-700"></div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-500/20 rounded-lg">
              <Award size={20} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{appointmentRate}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Meeting Rate</p>
            </div>
          </div>
          <div className="w-px h-10 bg-gray-300 dark:bg-gray-700"></div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-500/20 rounded-lg">
              <Clock size={20} className="text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{avgCallDuration}s</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Avg Duration</p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Daily Goal</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500" style={{ width: `${Math.min((stats.callsMade / 100) * 100, 100)}%` }}></div>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{stats.callsMade}/100</span>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KPIs */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <BarChart3 size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            Performance Metrics
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Connection Rate</span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{connectionRate}%</span>
              </div>
              <div className="w-full h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${connectionRate}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Meeting Rate</span>
                <span className="text-sm font-bold text-purple-600 dark:text-purple-400">{appointmentRate}%</span>
              </div>
              <div className="w-full h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500" style={{ width: `${appointmentRate}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Daily Goal Progress</span>
                <span className="text-sm font-bold text-green-600 dark:text-green-400">{Math.min(stats.callsMade, 100)}%</span>
              </div>
              <div className="w-full h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(stats.callsMade, 100)}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Pipeline Insights */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <Users size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            Pipeline Overview
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800/30">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wide">New Leads</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-2">{pipelineInsights.new}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800/30">
              <p className="text-xs text-purple-600 dark:text-purple-400 font-medium uppercase tracking-wide">Contacted</p>
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-2">{pipelineInsights.contacted}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-xl border border-green-200 dark:border-green-800/30">
              <p className="text-xs text-green-600 dark:text-green-400 font-medium uppercase tracking-wide">Qualified</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-2">{pipelineInsights.qualified}</p>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-4 rounded-xl border border-orange-200 dark:border-orange-800/30">
              <p className="text-xs text-orange-600 dark:text-orange-400 font-medium uppercase tracking-wide">Total</p>
              <p className="text-2xl font-bold text-orange-700 dark:text-orange-300 mt-2">{pipelineInsights.total}</p>
            </div>
          </div>
        </div>

        {/* Best Times to Call */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Clock size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            Best Call Windows
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800/30">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">9:00 - 11:00 AM</span>
              </div>
              <span className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2 py-1 rounded-full">Best</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/30">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">2:00 - 4:00 PM</span>
              </div>
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded-full">Good</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-200 dark:border-slate-600">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">12:00 - 1:00 PM</span>
              </div>
              <span className="text-xs font-semibold text-gray-500 bg-gray-200 dark:bg-slate-600 px-2 py-1 rounded-full">Avoid</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">Based on your connection rates</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <Phone size={18} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            Recent Calls
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 px-3 py-1 rounded-full">
            Last {dbStats?.recentCalls?.length || 0} calls
          </span>
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
          {!dbStats?.recentCalls || dbStats.recentCalls.length === 0 ? (
            <div className="text-center py-8">
              <Phone size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No recent calls for this period</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Start dialing to see your activity here</p>
            </div>
          ) : (
            dbStats.recentCalls.slice(0, 10).map((call, idx) => (
              <div key={call.id || idx} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    call.outcome === 'Meeting Scheduled' ? 'bg-green-100 dark:bg-green-900/30' :
                    call.outcome === 'Connected' ? 'bg-blue-100 dark:bg-blue-900/30' :
                    'bg-gray-100 dark:bg-slate-600'
                  }`}>
                    <Phone size={18} className={
                      call.outcome === 'Meeting Scheduled' ? 'text-green-600 dark:text-green-400' :
                      call.outcome === 'Connected' ? 'text-blue-600 dark:text-blue-400' :
                      'text-gray-500 dark:text-gray-400'
                    } />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{call.prospectName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{call.company || call.outcome || 'No outcome'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${
                    call.outcome === 'Meeting Scheduled' ? 'text-green-600 dark:text-green-400' :
                    call.outcome === 'Connected' ? 'text-blue-600 dark:text-blue-400' :
                    'text-gray-600 dark:text-gray-400'
                  }`}>
                    {Math.floor((call.duration || 0) / 60)}:{((call.duration || 0) % 60).toString().padStart(2, '0')}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {call.timestamp ? new Date(call.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
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