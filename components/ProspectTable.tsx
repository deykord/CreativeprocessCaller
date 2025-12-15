import React, { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { Prospect } from '../types';
import { 
  Phone, MoreHorizontal, MapPin, Upload, CheckCircle, XCircle, 
  Trash2, Edit2, Eye, X, Save, Calendar, Clock, User, Building,
  Hash, FileText, Timer, Voicemail, PhoneMissed, RefreshCw, AlertTriangle
} from 'lucide-react';
import { backendAPI } from '../services/BackendAPI';

interface Props {
  prospects: Prospect[];
  onCall: (prospect: Prospect) => void;
  onUpload: (file: File) => void;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Prospect>) => void;
}

interface CallLog {
  id: string;
  prospectId?: string;
  prospectName?: string;
  phoneNumber: string;
  fromNumber?: string;
  outcome: string;
  duration: number;
  notes?: string;
  startedAt: string;
  endedAt?: string;
  callerName?: string;
  callerId?: string;
  company?: string;
  callSid?: string;
  endReason?: string;
  answeredBy?: string;
  recordingUrl?: string;
}

// Call history modal for selected prospect
const CallHistoryModal: React.FC<{ prospectId: string; prospectName: string; onClose: () => void }> = ({ prospectId, prospectName, onClose }) => {
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCallIds, setSelectedCallIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadCalls = async () => {
      try {
        const calls = await backendAPI.getProspectCallHistory(prospectId);
        setCallLogs(calls as any);
      } catch (err) {
        console.error('Failed to load calls:', err);
      } finally {
        setLoading(false);
      }
    };
    loadCalls();
  }, [prospectId]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    }
    const years = Math.floor(diffDays / 365);
    return `${years} ${years === 1 ? 'year' : 'years'} ago`;
  };

  const getOutcomeBadge = (outcome: string) => {
    const styles: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      'Connected': { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', icon: <CheckCircle size={14} /> },
      'Meeting Set': { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', icon: <Calendar size={14} /> },
      'Voicemail': { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', icon: <Voicemail size={14} /> },
      'Busy': { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: <XCircle size={14} /> },
      'No Answer': { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-400', icon: <PhoneMissed size={14} /> },
      'Not Interested': { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: <XCircle size={14} /> },
      'Callback': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: <Phone size={14} /> },
      'Wrong Number': { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', icon: <XCircle size={14} /> },
    };
    return styles[outcome] || { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-400', icon: <Phone size={14} /> };
  };

  const handleDeleteSelected = async () => {
    if (selectedCallIds.size === 0) return;
    if (!confirm(`Delete ${selectedCallIds.size} call(s)?`)) return;
    
    try {
      await backendAPI.deleteCallLogs(Array.from(selectedCallIds));
      setCallLogs(prev => prev.filter(log => !selectedCallIds.has(log.id)));
      setSelectedCallIds(new Set());
    } catch (err) {
      alert('Failed to delete calls');
    }
  };

  const toggleCallSelection = (callId: string) => {
    const newSet = new Set(selectedCallIds);
    if (newSet.has(callId)) {
      newSet.delete(callId);
    } else {
      newSet.add(callId);
    }
    setSelectedCallIds(newSet);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Call History - {prospectName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={24} />
          </button>
        </div>

        {selectedCallIds.size > 0 && (
          <div className="px-6 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex justify-between items-center">
            <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {selectedCallIds.size} call(s) selected
            </span>
            <button
              onClick={handleDeleteSelected}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition"
            >
              Delete Selected
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="animate-spin text-gray-400" />
            </div>
          ) : callLogs.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              No calls found
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-slate-700">
              {callLogs.map(call => {
                const badge = getOutcomeBadge(call.outcome);
                return (
                  <div key={call.id} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedCallIds.has(call.id)}
                      onChange={() => toggleCallSelection(call.id)}
                      className="w-4 h-4 rounded mt-1 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {call.startedAt ? formatRelativeTime(call.startedAt) : 'Unknown date'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {call.startedAt ? new Date(call.startedAt).toLocaleString() : ''}
                            </div>
                          </div>
                          <span className={`px-2 py-1 text-xs font-medium rounded flex items-center gap-1 ${badge.bg} ${badge.text}`}>
                            {badge.icon}
                            {call.outcome}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                          <Timer size={14} />
                          {formatDuration(call.duration)}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <div><span className="font-medium">Phone:</span> {call.phoneNumber}</div>
                        <div><span className="font-medium">Caller:</span> {call.callerName || call.fromNumber || 'Unknown'}</div>
                        {call.notes && <div className="col-span-2"><span className="font-medium">Notes:</span> {call.notes}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Row with 3-dots menu and call count
const ProspectRowWithMenu = React.memo(({ prospect, onCall, onDelete, onUpdate, isSelected, onToggleSelect, callCount, onShowCallHistory }: { prospect: Prospect; onCall: (p: Prospect) => void; onDelete?: (id: string) => void; onUpdate?: (id: string, updates: Partial<Prospect>) => void; isSelected: boolean; onToggleSelect: (id: string) => void; callCount: number; onShowCallHistory: (id: string, name: string) => void }) => {
  const [showMenu, setShowMenu] = React.useState(false);
  const [showModal, setShowModal] = React.useState(false);
  const [editMode, setEditMode] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [editProspect, setEditProspect] = React.useState<Prospect | null>(null);
  const user = React.useMemo(() => {
    try {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u) : null;
    } catch { return null; }
  }, []);
  
  const canDelete = user?.role === 'admin' || user?.permissions?.canDeleteLeads;
  const canEdit = user?.role === 'admin' || user?.permissions?.canEditLeads;
  return (
    <>
      <tr className={`transition duration-150 group ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-blue-50/50 dark:hover:bg-blue-900/10'}`}>
        <td className="p-4">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(prospect.id)}
            className="w-4 h-4 rounded cursor-pointer"
          />
        </td>
        <td className="p-4">
          <button
            onClick={() => onShowCallHistory(prospect.id, `${prospect.firstName} ${prospect.lastName}`)}
            className="font-semibold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition cursor-pointer text-left"
          >
            {prospect.firstName} {prospect.lastName}
          </button>
        </td>
        <td className="p-4">
          <button
            onClick={() => onShowCallHistory(prospect.id, `${prospect.firstName} ${prospect.lastName}`)}
            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 underline transition"
          >
            {prospect.phone}
          </button>
        </td>
        <td className="p-4">
          <div className="text-sm text-gray-900 dark:text-gray-200">{prospect.title}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{prospect.company}</div>
        </td>
        <td className="p-4">
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
            <MapPin size={14} className="mr-1" />
            {prospect.timezone}
          </div>
        </td>
        <td className="p-4">
          <span className={`px-3 py-1 text-xs font-medium rounded-full cursor-pointer hover:underline transition ${
            prospect.status === 'New' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' :
            prospect.status === 'Callback' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' :
            prospect.status === 'Follow Up Required' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' :
            prospect.status === 'Busy Later' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' :
            prospect.status === 'Qualified' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
            prospect.status === 'Lost' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' :
            prospect.status === 'Do Not Call' ? 'bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-300' :
            'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
          }`} onClick={() => onShowCallHistory(prospect.id, `${prospect.firstName} ${prospect.lastName}`)}>
            {prospect.status}
          </span>
        </td>
        <td className="p-4">
          <button
            onClick={() => onShowCallHistory(prospect.id, `${prospect.firstName} ${prospect.lastName}`)}
            className="px-2 py-1 text-xs font-medium rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition cursor-pointer"
          >
            📞 {callCount} call(s)
          </button>
        </td>
        <td className="p-4 text-right relative">
          <button
            onClick={() => onCall(prospect)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600 hover:bg-green-600 hover:text-white dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-600 dark:hover:text-white transition shadow-sm mr-2"
            title="Call Now"
          >
            <Phone size={14} />
          </button>
          <button className="inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition" onClick={() => setShowMenu(!showMenu)}>
            <MoreHorizontal size={16} />
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-10">
              <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700" onClick={() => { setShowModal(true); setShowMenu(false); }}>View Info</button>
              <button className="block w-full text-left px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-gray-50 dark:hover:bg-slate-700" onClick={() => { onShowCallHistory(prospect.id, `${prospect.firstName} ${prospect.lastName}`); setShowMenu(false); }}>View Calls</button>
              {canEdit && <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700" onClick={() => { setEditMode(true); setEditProspect(prospect); setShowModal(true); setShowMenu(false); }}>Edit</button>}
              {canDelete && <button className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => { setShowDeleteConfirm(true); setShowMenu(false); }}>Delete</button>}
            </div>
          )}
        </td>
      </tr>
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 w-full max-w-md relative">
            <button className="absolute top-3 right-3 text-gray-500 dark:text-gray-300" onClick={() => { setShowModal(false); setEditMode(false); }}>
              ×
            </button>
            {!editMode ? (
              <>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Lead Info</h3>
                <div className="space-y-2 mb-4">
                  <p><span className="font-semibold">Name:</span> {prospect.firstName} {prospect.lastName}</p>
                  <p><span className="font-semibold">Title:</span> {prospect.title}</p>
                  <p><span className="font-semibold">Company:</span> {prospect.company}</p>
                  <p><span className="font-semibold">Phone:</span> {prospect.phone}</p>
                  <p><span className="font-semibold">Email:</span> {prospect.email}</p>
                  <p><span className="font-semibold">Status:</span> {prospect.status}</p>
                  <p><span className="font-semibold">Timezone:</span> {prospect.timezone}</p>
                  {prospect.notes && <p><span className="font-semibold">Notes:</span> {prospect.notes}</p>}
                  <button className="text-indigo-600 dark:text-indigo-400 text-sm hover:underline" onClick={() => { setShowModal(false); onShowCallHistory(prospect.id, `${prospect.firstName} ${prospect.lastName}`); }}>View Call History →</button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Edit Lead</h3>
                <form className="space-y-2" onSubmit={e => { 
                  e.preventDefault(); 
                  if (onUpdate && editProspect) {
                    const { id, ...updates } = editProspect;
                    onUpdate(prospect.id, updates);
                  }
                  setShowModal(false); 
                  setEditMode(false); 
                }}>
                  <input type="text" className="w-full px-3 py-2 rounded border dark:bg-slate-700 dark:text-white" value={editProspect?.firstName || ''} onChange={e => setEditProspect(p => p ? { ...p, firstName: e.target.value } : p)} placeholder="First Name" />
                  <input type="text" className="w-full px-3 py-2 rounded border dark:bg-slate-700 dark:text-white" value={editProspect?.lastName || ''} onChange={e => setEditProspect(p => p ? { ...p, lastName: e.target.value } : p)} placeholder="Last Name" />
                  <input type="text" className="w-full px-3 py-2 rounded border dark:bg-slate-700 dark:text-white" value={editProspect?.title || ''} onChange={e => setEditProspect(p => p ? { ...p, title: e.target.value } : p)} placeholder="Title" />
                  <input type="text" className="w-full px-3 py-2 rounded border dark:bg-slate-700 dark:text-white" value={editProspect?.company || ''} onChange={e => setEditProspect(p => p ? { ...p, company: e.target.value } : p)} placeholder="Company" />
                  <input type="text" className="w-full px-3 py-2 rounded border dark:bg-slate-700 dark:text-white" value={editProspect?.phone || ''} onChange={e => setEditProspect(p => p ? { ...p, phone: e.target.value } : p)} placeholder="Phone" />
                  <input type="email" className="w-full px-3 py-2 rounded border dark:bg-slate-700 dark:text-white" value={editProspect?.email || ''} onChange={e => setEditProspect(p => p ? { ...p, email: e.target.value } : p)} placeholder="Email" />
                  <select className="w-full px-3 py-2 rounded border dark:bg-slate-700 dark:text-white" value={editProspect?.status || ''} onChange={e => setEditProspect(p => p ? { ...p, status: e.target.value as any } : p)}>
                    <option value="New">New</option>
                    <option value="Callback">Callback</option>
                    <option value="Follow Up Required">Follow Up Required</option>
                    <option value="Busy Later">Busy Later</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Lost">Lost</option>
                    <option value="Do Not Call">Do Not Call</option>
                  </select>
                  <textarea className="w-full px-3 py-2 rounded border dark:bg-slate-700 dark:text-white" value={editProspect?.notes || ''} onChange={e => setEditProspect(p => p ? { ...p, notes: e.target.value } : p)} placeholder="Notes" />
                  <div className="flex gap-2 mt-2">
                    <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Save</button>
                    <button type="button" className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500" onClick={() => { setEditMode(false); setShowModal(false); }}>Cancel</button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Delete Lead</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Are you sure you want to delete <strong>{prospect.firstName} {prospect.lastName}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (onDelete) onDelete(prospect.id);
                  setShowDeleteConfirm(false);
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export const ProspectTable: React.FC<Props> = React.memo(({ prospects, onCall, onUpload, onDelete, onUpdate }) => {
  const [selectedProspectIds, setSelectedProspectIds] = React.useState<Set<string>>(new Set());
  const [showCallHistoryModal, setShowCallHistoryModal] = React.useState<{prospectId: string; prospectName: string} | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = React.useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);
  const ITEMS_PER_PAGE = 100;
  
  // Column filters state
  const [filters, setFilters] = React.useState<{
    name: string;
    phone: string;
    company: string;
    status: string;
    timezone: string;
  }>({
    name: '',
    phone: '',
    company: '',
    status: '',
    timezone: '',
  });
  const [showFilters, setShowFilters] = React.useState(false);

  // All available statuses for filtering
  const allStatuses = ['New', 'Callback', 'Follow Up Required', 'Busy Later', 'Contacted', 'Qualified', 'Lost', 'Do Not Call'];
  
  const uniqueTimezones = React.useMemo(() => 
    [...new Set(prospects.map(p => p.timezone))].filter(Boolean).sort(),
  [prospects]);

  // Apply filters to prospects
  const filteredProspects = React.useMemo(() => {
    return prospects.filter(p => {
      const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
      if (filters.name && !fullName.includes(filters.name.toLowerCase())) return false;
      if (filters.phone && !p.phone.includes(filters.phone)) return false;
      if (filters.company && !p.company?.toLowerCase().includes(filters.company.toLowerCase())) return false;
      if (filters.status && p.status !== filters.status) return false;
      if (filters.timezone && p.timezone !== filters.timezone) return false;
      return true;
    });
  }, [prospects, filters]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredProspects.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedProspects = filteredProspects.slice(startIndex, endIndex);
  
  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onUpload(file);
      event.target.value = '';
    }
  }, [onUpload]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Use totalCalls from prospect data instead of fetching individually
  // This prevents N API calls on component mount
  const callCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const prospect of prospects) {
      counts[prospect.id] = prospect.totalCalls || 0;
    }
    return counts;
  }, [prospects]);

  const toggleSelectProspect = (prospectId: string) => {
    const newSet = new Set(selectedProspectIds);
    if (newSet.has(prospectId)) {
      newSet.delete(prospectId);
    } else {
      newSet.add(prospectId);
    }
    setSelectedProspectIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedProspectIds.size === paginatedProspects.length) {
      setSelectedProspectIds(new Set());
    } else {
      setSelectedProspectIds(new Set(paginatedProspects.map(p => p.id)));
    }
  };

  const handleBulkDelete = () => {
    selectedProspectIds.forEach(id => {
      if (onDelete) onDelete(id);
    });
    setSelectedProspectIds(new Set());
    setShowBulkDeleteConfirm(false);
  };

  return (
    <div className="bg-white dark:bg-slate-800 shadow-sm border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden transition-colors duration-200">
      <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Priority Lists</h2>
          <span className="text-xs font-medium px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">{filteredProspects.length} leads</span>
          {selectedProspectIds.size > 0 && (
            <span className="text-xs font-medium px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full">{selectedProspectIds.size} selected</span>
          )}
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${showFilters ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-600'}`}
          >
            🔍 Filters {Object.values(filters).some(f => f) && `(${Object.values(filters).filter(f => f).length})`}
          </button>
          {selectedProspectIds.size > 0 && (
            <>
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition"
              >
                Delete Selected
              </button>
              <button
                onClick={() => setSelectedProspectIds(new Set())}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg text-sm font-medium hover:bg-gray-400 dark:hover:bg-gray-500 transition"
              >
                Clear
              </button>
            </>
          )}
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileChange}
          />
          <button 
            onClick={handleUploadClick}
            className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600 transition shadow-sm"
          >
            <Upload size={16} />
            <span>Import CSV</span>
          </button>
        </div>
      </div>

      {/* Column Filters */}
      {showFilters && (
        <div className="p-4 bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-600">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name</label>
              <input
                type="text"
                value={filters.name}
                onChange={e => setFilters(f => ({ ...f, name: e.target.value }))}
                placeholder="Search name..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Phone</label>
              <input
                type="text"
                value={filters.phone}
                onChange={e => setFilters(f => ({ ...f, phone: e.target.value }))}
                placeholder="Search phone..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Company</label>
              <input
                type="text"
                value={filters.company}
                onChange={e => setFilters(f => ({ ...f, company: e.target.value }))}
                placeholder="Search company..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              >
                <option value="">All Statuses</option>
                {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Timezone</label>
              <select
                value={filters.timezone}
                onChange={e => setFilters(f => ({ ...f, timezone: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              >
                <option value="">All Timezones</option>
                {uniqueTimezones.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => setFilters({ name: '', phone: '', company: '', status: '', timezone: '' })}
              className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
              <th className="p-4 font-semibold">
                <input
                  type="checkbox"
                  checked={selectedProspectIds.size === paginatedProspects.length && paginatedProspects.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded cursor-pointer"
                />
              </th>
              <th className="p-4 font-semibold">Name</th>
              <th className="p-4 font-semibold">Phone</th>
              <th className="p-4 font-semibold">Title / Company</th>
              <th className="p-4 font-semibold">Location</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold">Calls</th>
              <th className="p-4 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {paginatedProspects.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-gray-500 dark:text-gray-400">No prospects found</td></tr>
            ) : (
              paginatedProspects.map(prospect => (
                <ProspectRowWithMenu
                  key={prospect.id}
                  prospect={prospect}
                  onCall={onCall}
                  onDelete={onDelete}
                  onUpdate={onUpdate}
                  isSelected={selectedProspectIds.has(prospect.id)}
                  onToggleSelect={toggleSelectProspect}
                  callCount={callCounts[prospect.id] || 0}
                  onShowCallHistory={(prospectId, prospectName) => {
                    setShowCallHistoryModal({ prospectId, prospectName });
                  }}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredProspects.length)} of {filteredProspects.length} prospects
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 text-sm rounded ${currentPage === pageNum ? 'bg-indigo-600 text-white' : 'border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600'}`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Last
            </button>
          </div>
        </div>
      )}

      {showCallHistoryModal && (
        <CallHistoryModal
          prospectId={showCallHistoryModal.prospectId}
          prospectName={showCallHistoryModal.prospectName}
          onClose={() => setShowCallHistoryModal(null)}
        />
      )}

      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Delete Selected Prospects</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Are you sure you want to delete {selectedProspectIds.size} prospect{selectedProspectIds.size !== 1 ? 's' : ''}? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleBulkDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Delete
              </button>
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
