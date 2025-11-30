import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { backendAPI } from '../services/BackendAPI';
import { CallLog } from '../types';
import { Clock, PhoneOutgoing, PhoneMissed, CheckCircle, XCircle, Calendar } from 'lucide-react';

interface Props {
  history: CallLog[];
}

// Memoized row component
const CallHistoryRow = React.memo(({ log, formatDuration, getOutcomeIcon }: { 
  log: CallLog; 
  formatDuration: (sec: number) => string;
  getOutcomeIcon: (outcome: string) => React.ReactNode;
}) => (
  <tr className="hover:bg-gray-50/50 dark:hover:bg-slate-700/50">
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
));

export const CallHistory: React.FC<Props> = React.memo(({ history }) => {
  // Memoized sorting
  const sortedHistory = useMemo(() => [...history].reverse(), [history]);
  const [recordings, setRecordings] = React.useState<{ [callId: string]: string }>({});
  const [allRecordings, setAllRecordings] = useState<any[]>([]);
  const [selectedCallLogs, setSelectedCallLogs] = useState<Set<string>>(new Set());
  const [selectedRecordings, setSelectedRecordings] = useState<Set<string>>(new Set());
  const user = React.useMemo(() => {
    try {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u) : null;
    } catch { return null; }
  }, []);

  // Fetch recordings for each call
  useEffect(() => {
    // Fetch recordings for each call log via matching by prospectId or call timestamp is non-trivial; keep audio attachments mapped by log id where possible
    sortedHistory.forEach(async (log) => {
      if (!recordings[log.id]) {
        try {
          const res = await fetch(`/api/calls/recordings/${log.id}`);
          if (res.ok) {
            const data = await res.json();
            // controller returns recordings array
            if (Array.isArray(data) && data.length > 0) {
              // map first recording URL to this log
              setRecordings(r => ({ ...r, [log.id]: data[0].recordingUrl || '' }));
            }
          }
        } catch (e) { /* ignore */ }
      }
    });
    // also load the full list of recordings for management
    (async () => {
      try {
        const all = await backendAPI.getRecordings();
        setAllRecordings(all || []);
      } catch (e) {
        console.warn('Failed to fetch all recordings', e);
      }
    })();
    // eslint-disable-next-line
  }, [sortedHistory]);

  // Memoized utility functions
  const getOutcomeIcon = useCallback((outcome: string) => {
    switch (outcome) {
      case 'Connected': return <CheckCircle size={16} className="text-green-500" />;
      case 'Meeting Set': return <Calendar size={16} className="text-purple-500" />;
      case 'Voicemail': return <PhoneOutgoing size={16} className="text-amber-500" />;
      case 'Busy': return <XCircle size={16} className="text-red-500" />;
      default: return <PhoneMissed size={16} className="text-gray-400" />;
    }
  }, []);

  const formatDuration = useCallback((sec: number) => {
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return `${min}:${s < 10 ? '0' : ''}${s}`;
  }, []);

  // Memoize rendered rows
  const rows = useMemo(() => {
    const r: React.ReactNode[] = [];
    for (const log of sortedHistory) {
      const canPlay = user?.role === 'admin' || user?.email === log.fromNumber;
      const isSelected = selectedCallLogs.has(log.id);
      r.push(
        <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/50">
          <td className="p-4 w-8">
            <input
              type="checkbox"
              aria-label={`Select call ${log.id}`}
              checked={isSelected}
              onChange={(e) => {
                setSelectedCallLogs(prev => {
                  const s = new Set(prev);
                  if (e.target.checked) s.add(log.id); else s.delete(log.id);
                  return s;
                });
              }}
            />
          </td>
          <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{new Date(log.timestamp).toLocaleString()}</td>
          <td className="p-4 font-medium text-gray-900 dark:text-white">{log.prospectName}</td>
          <td className="p-4 text-sm font-mono text-gray-500 dark:text-gray-400">{log.phoneNumber}</td>
          <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{formatDuration(log.duration)}</td>
          <td className="p-4">
            <div className="flex items-center space-x-2">
              {getOutcomeIcon(log.outcome)}
              <span className="text-sm text-gray-700 dark:text-gray-300">{log.outcome}</span>
            </div>
          </td>
          <td className="p-4 text-xs text-gray-500 dark:text-gray-400">{log.fromNumber}</td>
          <td className="p-4 text-sm text-gray-500 dark:text-gray-400 italic truncate max-w-xs">
            {log.note || '-'}
            {recordings[log.id] && canPlay && (
              <audio controls src={recordings[log.id]} className="mt-2 w-full" />
            )}
          </td>
        </tr>
      );
    }
    return r;
  }, [sortedHistory, formatDuration, getOutcomeIcon, recordings, user, selectedCallLogs]);

  if (history.length === 0) {
    return (
      <div className="p-12 text-center text-gray-400 dark:text-gray-500">
        <Clock size={48} className="mx-auto mb-4 opacity-20" />
        <p>No calls have been made yet.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Call History</h2>
      {/* Recordings management panel */}
      <div className="mb-6 bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700 shadow-sm">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Recordings</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage and download call recordings</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                try {
                  const all = await backendAPI.getRecordings();
                  setAllRecordings(all || []);
                } catch (e) { console.warn(e); }
              }}
              className="px-3 py-1 bg-gray-200 dark:bg-slate-700 rounded text-sm"
            >Refresh</button>

            <button
              onClick={async () => {
                if (selectedRecordings.size === 0) return alert('Select recordings to download');
                const ids = Array.from(selectedRecordings);
                for (const id of ids) {
                  try {
                    const url = await backendAPI.getRecordingDownloadUrl(id);
                    window.open(url, '_blank');
                  } catch (e) {
                    console.warn('Failed to get recording url for', id, e);
                  }
                }
              }}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
            >Download Selected</button>

            <button
              onClick={async () => {
                if (!confirm('Delete selected recordings?')) return;
                const ids = Array.from(selectedRecordings);
                try {
                  await backendAPI.deleteRecordings(ids);
                  setAllRecordings(prev => prev.filter(r => !ids.includes(r.id)));
                  setSelectedRecordings(new Set());
                } catch (e) { alert('Failed to delete recordings'); }
              }}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm"
            >Delete Selected</button>

            <button
              onClick={async () => {
                if (!confirm('Delete ALL recordings? This cannot be undone.')) return;
                try {
                  await backendAPI.deleteAllRecordings();
                  setAllRecordings([]);
                  setSelectedRecordings(new Set());
                } catch (e) { alert('Failed to delete all recordings'); }
              }}
              className="px-3 py-1 bg-red-700 text-white rounded text-sm hover:bg-red-800"
            >Delete All</button>
          </div>
        </div>

        {allRecordings.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">No recordings available</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">
                <tr>
                  <th className="p-2 w-8"><input type="checkbox" onChange={(e) => {
                      if (e.target.checked) setSelectedRecordings(new Set(allRecordings.map(r => r.id)));
                      else setSelectedRecordings(new Set());
                    }} checked={selectedRecordings.size === allRecordings.length} /></th>
                  <th className="p-2">Date</th>
                  <th className="p-2">CallSid</th>
                  <th className="p-2">Recording SID</th>
                  <th className="p-2">Duration</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {allRecordings.map(rec => (
                  <tr key={rec.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/50">
                    <td className="p-2"><input type="checkbox" checked={selectedRecordings.has(rec.id)} onChange={(e) => {
                      setSelectedRecordings(prev => {
                        const s = new Set(prev);
                        if (e.target.checked) s.add(rec.id); else s.delete(rec.id);
                        return s;
                      });
                    }} /></td>
                    <td className="p-2 text-gray-600 dark:text-gray-300">{new Date(rec.timestamp).toLocaleString()}</td>
                    <td className="p-2 text-sm font-mono text-gray-500 dark:text-gray-400">{rec.callSid}</td>
                    <td className="p-2 text-sm font-mono text-gray-500 dark:text-gray-400">{rec.recordingSid}</td>
                    <td className="p-2 text-gray-600 dark:text-gray-300">{formatDuration(rec.duration || 0)}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        {rec.recordingUrl && (
                          <audio controls src={rec.recordingUrl} className="h-8" />
                        )}
                        <button className="px-2 py-1 text-sm bg-blue-600 text-white rounded" onClick={() => window.open(backendAPI.getRecordingDownloadUrl(rec.id))}>Download</button>
                        <button className="px-2 py-1 text-sm bg-red-600 text-white rounded" onClick={async () => {
                          if (!confirm('Delete this recording?')) return;
                          try {
                            await backendAPI.deleteRecording(rec.id);
                            setAllRecordings(prev => prev.filter(r => r.id !== rec.id));
                            setSelectedRecordings(prev => { const s = new Set(prev); s.delete(rec.id); return s; });
                          } catch (e) { alert('Failed to delete recording'); }
                        }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden transition-colors duration-200">
        {/* Call Logs Management Toolbar */}
        {user?.role === 'admin' && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-600 flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {selectedCallLogs.size > 0 ? `${selectedCallLogs.size} call log(s) selected` : 'Select call logs to delete'}
            </span>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (selectedCallLogs.size === 0) return alert('Select call logs to delete');
                  if (!confirm(`Delete ${selectedCallLogs.size} selected call log(s)?`)) return;
                  try {
                    await backendAPI.deleteCallLogs(Array.from(selectedCallLogs));
                    setSelectedCallLogs(new Set());
                    // Trigger a refresh - parent should re-fetch
                    window.location.reload();
                  } catch (e) {
                    console.error('Failed to delete call logs:', e);
                    alert('Failed to delete call logs');
                  }
                }}
                disabled={selectedCallLogs.size === 0}
                className="px-3 py-1.5 bg-red-600 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700"
              >
                Delete Selected
              </button>
              <button
                onClick={async () => {
                  if (!confirm('Delete ALL call history? This cannot be undone.')) return;
                  try {
                    await backendAPI.deleteAllCallLogs();
                    setSelectedCallLogs(new Set());
                    window.location.reload();
                  } catch (e) {
                    console.error('Failed to delete all call logs:', e);
                    alert('Failed to delete all call logs');
                  }
                }}
                className="px-3 py-1.5 bg-red-800 text-white rounded text-sm hover:bg-red-900"
              >
                Delete All History
              </button>
            </div>
          </div>
        )}
        <table className="w-full text-left">
          <thead className="bg-gray-50 dark:bg-slate-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">
            <tr>
              <th className="p-4 w-8">
                <input
                  type="checkbox"
                  aria-label="Select all call rows"
                  onChange={(e) => {
                    if (e.target.checked) setSelectedCallLogs(new Set(sortedHistory.map(s => s.id)));
                    else setSelectedCallLogs(new Set());
                  }}
                  checked={selectedCallLogs.size > 0 && selectedCallLogs.size === sortedHistory.length}
                />
              </th>
              <th className="p-4">Date & Time</th>
              <th className="p-4">Prospect</th>
              <th className="p-4">Number</th>
              <th className="p-4">Duration</th>
              <th className="p-4">Outcome</th>
              <th className="p-4">Caller ID Used</th>
              <th className="p-4 w-1/4">Notes / Recording</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {rows}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default CallHistory;
