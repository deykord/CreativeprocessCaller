import React, { useState, useEffect } from 'react';
import { ProspectCallLog } from '../types';
import { backendAPI } from '../services/BackendAPI';
import { 
  Phone, X, Clock, CheckCircle, PhoneMissed, PhoneOutgoing, 
  Calendar, XCircle, User, RefreshCw, ExternalLink, History, ArrowRight
} from 'lucide-react';

interface PhoneHistoryItem {
  id: string;
  phoneNumber: string;
  isCurrent: boolean;
  changedAt: string;
  changedTo?: string;
  changedBy?: string;
  changedByName?: string;
}

interface PhoneCallHistoryProps {
  prospectId: string;
  prospectName: string;
  phoneNumber: string;
  isOpen: boolean;
  onClose: () => void;
}

const PhoneCallHistory: React.FC<PhoneCallHistoryProps> = ({
  prospectId,
  prospectName,
  phoneNumber,
  isOpen,
  onClose
}) => {
  const [callHistory, setCallHistory] = useState<ProspectCallLog[]>([]);
  const [phoneHistory, setPhoneHistory] = useState<PhoneHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'calls' | 'numbers'>('calls');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [callData, phoneData] = await Promise.all([
        backendAPI.getProspectCallHistory(prospectId),
        backendAPI.getProspectPhoneHistory(prospectId)
      ]);
      setCallHistory(callData);
      setPhoneHistory(phoneData);
    } catch (err) {
      console.error('Failed to load history:', err);
      setError('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && prospectId) {
      loadData();
    }
  }, [isOpen, prospectId]);

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case 'Connected':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'Meeting Set':
        return <Calendar className="w-4 h-4 text-purple-500" />;
      case 'Voicemail':
        return <PhoneOutgoing className="w-4 h-4 text-amber-500" />;
      case 'Busy':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'No Answer':
        return <PhoneMissed className="w-4 h-4 text-gray-400" />;
      default:
        return <Phone className="w-4 h-4 text-gray-400" />;
    }
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'Connected':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'Meeting Set':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'Voicemail':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'Busy':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds === 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Phone History
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {prospectName} • {phoneNumber}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={() => setActiveTab('calls')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'calls'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-800'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Phone className="w-4 h-4" />
            Call History
            {callHistory.length > 0 && (
              <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-full text-xs">
                {callHistory.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('numbers')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'numbers'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-800'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <History className="w-4 h-4" />
            Number Changes
            {phoneHistory.length > 1 && (
              <span className="bg-amber-200 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full text-xs">
                {phoneHistory.length - 1}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(80vh-160px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading history...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <XCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
              <p className="text-red-500">{error}</p>
              <button
                onClick={loadData}
                className="mt-2 text-sm text-blue-600 hover:underline"
              >
                Try again
              </button>
            </div>
          ) : activeTab === 'calls' ? (
            // Call History Tab
            callHistory.length === 0 ? (
              <div className="text-center py-12">
                <Phone className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400">No calls recorded yet</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Call history will appear here after making calls
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {callHistory.map((call) => (
                  <div key={call.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 p-2 rounded-full ${getOutcomeColor(call.outcome)}`}>
                          {getOutcomeIcon(call.outcome)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getOutcomeColor(call.outcome)}`}>
                              {call.outcome}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDuration(call.duration)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                            {formatDate(call.startedAt)}
                          </p>
                          {call.notes && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 italic">
                              "{call.notes}"
                            </p>
                          )}
                          {call.fromNumber && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              Called from: {call.fromNumber}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {call.callerName && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <User className="w-3 h-3" />
                            {call.callerName}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            // Phone Number History Tab
            phoneHistory.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400">No phone number changes</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Number change history will appear here when updated
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {phoneHistory.map((item, index) => (
                  <div key={item.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 p-2 rounded-full ${
                        item.isCurrent 
                          ? 'bg-green-100 dark:bg-green-900/30' 
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        <Phone className={`w-4 h-4 ${
                          item.isCurrent 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-gray-500 dark:text-gray-400'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-mono text-sm font-medium ${
                            item.isCurrent 
                              ? 'text-green-700 dark:text-green-400' 
                              : 'text-gray-600 dark:text-gray-300'
                          }`}>
                            {item.phoneNumber}
                          </span>
                          {item.isCurrent ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              Current
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                              Previous
                            </span>
                          )}
                        </div>
                        
                        {!item.isCurrent && item.changedTo && (
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>Changed to:</span>
                            <ArrowRight className="w-3 h-3" />
                            <span className="font-mono">{item.changedTo}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(item.changedAt)}
                          </span>
                          {item.changedByName && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {item.changedByName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        {activeTab === 'calls' && callHistory.length > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Total calls: {callHistory.length}</span>
              <span>
                Connected: {callHistory.filter(c => c.outcome === 'Connected' || c.outcome === 'Meeting Set').length}
              </span>
            </div>
          </div>
        )}
        {activeTab === 'numbers' && phoneHistory.length > 1 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Total number changes: {phoneHistory.length - 1}</span>
              <span className="text-xs text-gray-400">
                Previous numbers are saved automatically
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhoneCallHistory;
