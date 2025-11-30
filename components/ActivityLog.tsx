import React, { useState, useEffect } from 'react';
import { LeadActivityLog } from '../types';
import { backendAPI } from '../services/BackendAPI';
import { 
  Phone, FileText, Edit, UserPlus, List, Clock, 
  CheckCircle, XCircle, AlertCircle, User, RefreshCw
} from 'lucide-react';

interface ActivityLogProps {
  prospectId: string;
  compact?: boolean;
}

const ActivityLog: React.FC<ActivityLogProps> = ({ prospectId, compact = false }) => {
  const [activities, setActivities] = useState<LeadActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await backendAPI.getProspectActivityLog(prospectId);
      setActivities(data);
    } catch (err) {
      console.error('Failed to load activity log:', err);
      setError('Failed to load activity log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (prospectId) {
      loadActivities();
    }
  }, [prospectId]);

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'call':
        return <Phone className="w-4 h-4 text-green-500" />;
      case 'status_change':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'note_added':
      case 'note_edited':
        return <FileText className="w-4 h-4 text-yellow-500" />;
      case 'field_updated':
        return <Edit className="w-4 h-4 text-purple-500" />;
      case 'created':
        return <UserPlus className="w-4 h-4 text-green-600" />;
      case 'assigned':
        return <User className="w-4 h-4 text-blue-600" />;
      case 'list_added':
      case 'list_removed':
        return <List className="w-4 h-4 text-orange-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'call':
        return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800';
      case 'status_change':
        return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
      case 'note_added':
      case 'note_edited':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
      case 'field_updated':
        return 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800';
      case 'created':
        return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800';
      default:
        return 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const renderActivityDetails = (activity: LeadActivityLog) => {
    if (activity.actionType === 'call' && activity.metadata) {
      const meta = activity.metadata;
      return (
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
          {meta.outcome && (
            <span className={`px-2 py-0.5 rounded-full ${
              meta.outcome === 'Connected' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
              meta.outcome === 'Voicemail' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
              meta.outcome === 'No Answer' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' :
              'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
            }`}>
              {meta.outcome}
            </span>
          )}
          {meta.duration !== undefined && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(meta.duration)}
            </span>
          )}
          {meta.phoneNumber && (
            <span>📞 {meta.phoneNumber}</span>
          )}
        </div>
      );
    }

    if (activity.actionType === 'status_change') {
      return (
        <div className="flex items-center gap-2 text-xs mt-1">
          <span className="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
            {activity.oldValue || 'None'}
          </span>
          <span className="text-gray-400">→</span>
          <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
            {activity.newValue}
          </span>
        </div>
      );
    }

    if (activity.actionType === 'field_updated' && activity.fieldName) {
      return (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          <span className="font-medium">{activity.fieldName}:</span>{' '}
          <span className="line-through text-gray-400">{activity.oldValue || 'empty'}</span>
          {' → '}
          <span className="text-gray-700 dark:text-gray-300">{activity.newValue}</span>
        </div>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading activity...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-red-500">{error}</p>
        <button 
          onClick={loadActivities}
          className="mt-2 text-sm text-blue-600 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">No activity recorded yet</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Activity will appear here after calls, status changes, or edits
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${compact ? 'max-h-64 overflow-y-auto' : ''}`}>
      {/* Header with refresh */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Activity Log ({activities.length})
        </h4>
        <button 
          onClick={loadActivities}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Activity Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700"></div>
        
        {activities.map((activity, index) => (
          <div key={activity.id} className="relative pl-10 pb-4">
            {/* Timeline dot */}
            <div className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center ${getActionColor(activity.actionType)} border`}>
              {getActionIcon(activity.actionType)}
            </div>
            
            {/* Activity content */}
            <div className={`p-3 rounded-lg border ${getActionColor(activity.actionType)}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    {activity.description}
                  </p>
                  {renderActivityDetails(activity)}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                  {formatTime(activity.createdAt)}
                </div>
              </div>
              
              {/* User who performed action */}
              <div className="flex items-center gap-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
                <User className="w-3 h-3" />
                <span>{activity.userName}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityLog;
