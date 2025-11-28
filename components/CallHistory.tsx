import React from 'react';
import { CallLog } from '../types';
import { Clock, PhoneOutgoing, PhoneMissed, CheckCircle, XCircle, Calendar } from 'lucide-react';

interface Props {
  history: CallLog[];
}

export const CallHistory: React.FC<Props> = ({ history }) => {
  if (history.length === 0) {
    return (
      <div className="p-12 text-center text-gray-400 dark:text-gray-500">
        <Clock size={48} className="mx-auto mb-4 opacity-20" />
        <p>No calls have been made yet.</p>
      </div>
    );
  }

  // Reverse to show newest first
  const sortedHistory = [...history].reverse();

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case 'Connected': return <CheckCircle size={16} className="text-green-500" />;
      case 'Meeting Set': return <Calendar size={16} className="text-purple-500" />;
      case 'Voicemail': return <PhoneOutgoing size={16} className="text-amber-500" />;
      case 'Busy': return <XCircle size={16} className="text-red-500" />;
      default: return <PhoneMissed size={16} className="text-gray-400" />;
    }
  };

  const formatDuration = (sec: number) => {
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return `${min}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Call History</h2>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden transition-colors duration-200">
        <table className="w-full text-left">
          <thead className="bg-gray-50 dark:bg-slate-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">
            <tr>
              <th className="p-4">Date & Time</th>
              <th className="p-4">Prospect</th>
              <th className="p-4">Number</th>
              <th className="p-4">Duration</th>
              <th className="p-4">Outcome</th>
              <th className="p-4">Caller ID Used</th>
              <th className="p-4 w-1/4">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {sortedHistory.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/50">
                <td className="p-4 text-sm text-gray-600 dark:text-gray-300">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="p-4 font-medium text-gray-900 dark:text-white">
                  {log.prospectName}
                </td>
                <td className="p-4 text-sm font-mono text-gray-500 dark:text-gray-400">
                  {log.phoneNumber}
                </td>
                <td className="p-4 text-sm text-gray-600 dark:text-gray-300">
                  {formatDuration(log.duration)}
                </td>
                <td className="p-4">
                  <div className="flex items-center space-x-2">
                    {getOutcomeIcon(log.outcome)}
                    <span className="text-sm text-gray-700 dark:text-gray-300">{log.outcome}</span>
                  </div>
                </td>
                <td className="p-4 text-xs text-gray-500 dark:text-gray-400">
                  {log.fromNumber}
                </td>
                <td className="p-4 text-sm text-gray-500 dark:text-gray-400 italic truncate max-w-xs">
                  {log.note || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};