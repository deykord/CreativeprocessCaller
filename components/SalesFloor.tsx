import React, { useState, useEffect } from 'react';
import { Users, Phone, TrendingUp, Clock, Activity, Award } from 'lucide-react';
import { backendAPI } from '../services/BackendAPI';

interface TeamMemberStats {
  userId: string;
  userName?: string;
  callsMade: number;
  statusChanges: number;
  lastActivity: string | null;
  dispositions: Record<string, number>;
}

interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  prospectId?: string;
  prospectName?: string;
  details: string;
  timestamp: string;
  duration?: number;
  disposition?: string;
}

interface Props {
  teamMembers?: Array<{ id: string; email: string; firstName?: string; lastName?: string }>;
}

export const SalesFloor: React.FC<Props> = ({ teamMembers = [] }) => {
  const [teamStats, setTeamStats] = useState<TeamMemberStats[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadSalesFloorData = async () => {
    try {
      const data = await backendAPI.getSalesFloorActivity();
      setTeamStats(data.teamStats || []);
      setRecentActivity(data.recentActivity || []);
    } catch (error) {
      console.error('Failed to load sales floor data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSalesFloorData();
    
    // Auto-refresh every 5 seconds for real-time updates
    const interval = autoRefresh ? setInterval(() => {
      loadSalesFloorData();
    }, 5000) : null;

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  // Enrich stats with user names
  const enrichedStats = teamStats.map(stat => {
    const user = teamMembers.find(m => m.id === stat.userId);
    return {
      ...stat,
      userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown'
    };
  });

  // Calculate team totals
  const teamTotals = enrichedStats.reduce((acc, stat) => {
    acc.calls += stat.callsMade;
    acc.statusChanges += stat.statusChanges;
    Object.entries(stat.dispositions).forEach(([key, value]) => {
      acc.dispositions[key] = (acc.dispositions[key] || 0) + value;
    });
    return acc;
  }, { calls: 0, statusChanges: 0, dispositions: {} as Record<string, number> });

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'call_made':
        return <Phone className="w-4 h-4 text-blue-500" />;
      case 'status_change':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sales Floor</h2>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (5s)
          </label>
        </div>
      </div>

      {/* Team Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <Phone className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Calls Today</p>
              <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{teamTotals.calls}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">Status Updates</p>
              <p className="text-3xl font-bold text-green-700 dark:text-green-300">{teamTotals.statusChanges}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-4 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <Award className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            <div>
              <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Active Agents</p>
              <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">{enrichedStats.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Member Stats */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Team Performance</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
            {enrichedStats.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">No activity today</p>
            ) : (
              enrichedStats.map((stat) => (
                <div
                  key={stat.userId}
                  className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <span className="text-blue-600 dark:text-blue-400 font-semibold">
                          {stat.userName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{stat.userName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(stat.lastActivity)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="bg-white dark:bg-gray-800 p-2 rounded">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Calls</p>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{stat.callsMade}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Updates</p>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">{stat.statusChanges}</p>
                    </div>
                  </div>

                  {Object.keys(stat.dispositions).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Dispositions</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(stat.dispositions).map(([key, value]) => (
                          <span
                            key={key}
                            className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-full"
                          >
                            {key}: {value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Live Activity Feed</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
            {recentActivity.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">No recent activity</p>
            ) : (
              recentActivity.map((log) => {
                const user = teamMembers.find(m => m.id === log.userId);
                const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown';
                
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="mt-1">{getActivityIcon(log.action)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white">
                        <span className="font-medium">{userName}</span> {log.details}
                      </p>
                      {log.prospectName && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Lead: {log.prospectName}
                        </p>
                      )}
                      {log.disposition && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded">
                          {log.disposition}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                      {formatTime(log.timestamp)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
