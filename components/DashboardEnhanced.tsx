import React, { useMemo, useState, useEffect } from 'react';
import { AgentStats, Prospect, CallLog } from '../types';
import { Phone, CheckCircle, Clock, Calendar, TrendingUp, Target, BarChart3, Zap, Award, AlertCircle } from 'lucide-react';

interface Props {
  stats: AgentStats;
  prospects: Prospect[];
  callHistory: CallLog[];
}

// Memoized stat card to prevent re-renders
const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string; trend?: number; label?: string }> = React.memo(({ title, value, icon, color, trend, label }) => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center space-x-4 transition hover:shadow-md">
    <div className={`p-3 rounded-full ${color} text-white`}>
      {icon}
    </div>
    <div className="flex-1">
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{title}</p>
      <div className="flex items-center gap-2">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{value}</h3>
        {trend !== undefined && (
          <span className={`text-xs font-semibold ${trend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      {label && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{label}</p>}
    </div>
  </div>
));

// FEATURE 1: Performance Metrics with Trends
const PerformanceMetrics: React.FC<{ stats: AgentStats }> = React.memo(({ stats }) => {
  const metrics = useMemo(() => {
    const connectionRate = stats.callsMade > 0 ? Math.round((stats.connections / stats.callsMade) * 100) : 0;
    const appointmentRate = stats.connections > 0 ? Math.round((stats.appointmentsSet / stats.connections) * 100) : 0;
    const avgTalkTime = stats.connections > 0 ? Math.round(stats.talkTime / stats.connections) : 0;

    return { connectionRate, appointmentRate, avgTalkTime };
  }, [stats.callsMade, stats.connections, stats.appointmentsSet, stats.talkTime]);

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 p-6 rounded-xl border border-blue-200 dark:border-slate-600">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <BarChart3 size={20} className="text-blue-600 dark:text-blue-400" />
        Key Performance Indicators
      </h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Connection Rate</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">{metrics.connectionRate}%</p>
          <div className="w-full h-1 bg-gray-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-blue-600 dark:bg-blue-400" style={{ width: `${metrics.connectionRate}%` }}></div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Appointment Rate</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2">{metrics.appointmentRate}%</p>
          <div className="w-full h-1 bg-gray-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-purple-600 dark:bg-purple-400" style={{ width: `${metrics.appointmentRate}%` }}></div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Avg Talk Time</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">{metrics.avgTalkTime}m</p>
          <div className="w-full h-1 bg-gray-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-green-600 dark:bg-green-400" style={{ width: `${Math.min(metrics.avgTalkTime * 10, 100)}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  );
});

// FEATURE 2: Daily/Weekly Goals
const GoalsSection: React.FC<{ stats: AgentStats }> = React.memo(({ stats }) => {
  const dailyGoal = { calls: 50, connections: 10, appointments: 2 };
  const callProgress = Math.min((stats.callsMade / dailyGoal.calls) * 100, 100);
  const connectionProgress = Math.min((stats.connections / dailyGoal.connections) * 100, 100);
  const appointmentProgress = Math.min((stats.appointmentsSet / dailyGoal.appointments) * 100, 100);

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Target size={20} className="text-orange-600 dark:text-orange-400" />
        Today's Goals
      </h3>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Calls</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{stats.callsMade}/{dailyGoal.calls}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500" 
              style={{ width: `${callProgress}%` }}
            ></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Connections</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{stats.connections}/{dailyGoal.connections}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500" 
              style={{ width: `${connectionProgress}%` }}
            ></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Appointments</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{stats.appointmentsSet}/{dailyGoal.appointments}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-500" 
              style={{ width: `${appointmentProgress}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
});

// FEATURE 3: Leaderboard & Achievements
const AchievementsSection: React.FC<{ stats: AgentStats }> = React.memo(({ stats }) => {
  const achievements = useMemo(() => {
    const list = [];
    if (stats.callsMade >= 50) list.push({ icon: Zap, title: 'Speed Dialer', desc: '50+ calls today' });
    if (stats.connections >= 10) list.push({ icon: CheckCircle, title: 'Connector', desc: '10+ connections' });
    if (stats.appointmentsSet >= 2) list.push({ icon: Award, title: 'Closer', desc: '2+ appointments' });
    if (stats.callsMade >= 100) list.push({ icon: TrendingUp, title: 'Marathon', desc: '100+ calls' });
    if (stats.talkTime >= 120) list.push({ icon: Clock, title: 'Conversationalist', desc: '120+ min talk time' });
    return list.slice(0, 4);
  }, [stats.callsMade, stats.connections, stats.appointmentsSet, stats.talkTime]);

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Award size={20} className="text-yellow-600 dark:text-yellow-400" />
        Achievements
      </h3>
      {achievements.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Keep dialing! Unlock achievements by hitting your goals.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {achievements.map((achievement, idx) => {
            const Icon = achievement.icon;
            return (
              <div key={idx} className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-900/50">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                  <Icon size={16} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900 dark:text-white">{achievement.title}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{achievement.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

// FEATURE 4: Quick Insights
const InsightsSection: React.FC<{ prospects: Prospect[] }> = React.memo(({ prospects }) => {
  const insights = useMemo(() => {
    const newLeads = prospects.filter(p => p.status === 'New').length;
    const contactedLeads = prospects.filter(p => p.status === 'Contacted').length;
    const qualifiedLeads = prospects.filter(p => p.status === 'Qualified').length;

    return {
      newLeads,
      contactedLeads,
      qualifiedLeads,
      conversionRate: qualifiedLeads > 0 ? Math.round((qualifiedLeads / (newLeads + contactedLeads || 1)) * 100) : 0
    };
  }, [prospects]);

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-6 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <AlertCircle size={20} className="text-emerald-600 dark:text-emerald-400" />
        Pipeline Insights
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">New Leads</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">{insights.newLeads}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Contacted</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2">{insights.contactedLeads}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Qualified</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">{insights.qualifiedLeads}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Conv. Rate</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-2">{insights.conversionRate}%</p>
        </div>
      </div>
    </div>
  );
});

export const DashboardEnhanced: React.FC<Props> = React.memo(({ stats, prospects, callHistory }) => {
  const statCards = useMemo(() => [
    { title: "Calls Made", value: stats.callsMade, icon: <Phone size={20} />, color: "bg-blue-500", trend: 5, label: "vs yesterday" },
    { title: "Connections", value: stats.connections, icon: <CheckCircle size={20} />, color: "bg-green-500", trend: 8, label: "vs yesterday" },
    { title: "Appointments", value: stats.appointmentsSet, icon: <Calendar size={20} />, color: "bg-purple-500", trend: 3, label: "vs yesterday" },
    { title: "Talk Time (m)", value: stats.talkTime, icon: <Clock size={20} />, color: "bg-orange-500", trend: -2, label: "vs yesterday" }
  ], [stats.callsMade, stats.connections, stats.appointmentsSet, stats.talkTime]);

  return (
    <div className="space-y-6">
      {/* Primary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <StatCard key={idx} {...card} />
        ))}
      </div>

      {/* FEATURE 1 & 2: Performance Metrics and Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PerformanceMetrics stats={stats} />
        <GoalsSection stats={stats} />
      </div>

      {/* FEATURE 3 & 4: Achievements and Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AchievementsSection stats={stats} />
        <InsightsSection prospects={prospects} />
      </div>

      {/* FEATURE 5: Recent Activity Summary */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {callHistory.slice(0, 5).map((call, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{call.prospectName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{call.outcome}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{Math.floor(call.duration / 60)}m {call.duration % 60}s</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(call.timestamp).toLocaleTimeString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
