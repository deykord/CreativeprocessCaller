import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { backendAPI } from '../services/BackendAPI';
import { 
  Phone, Clock, Calendar, Filter, Download, Trash2, Search, 
  ChevronDown, ChevronUp, X, Plus, Save, Eye, Edit2, 
  CheckCircle, XCircle, PhoneOutgoing, PhoneMissed, Voicemail,
  MoreVertical, Play, Pause, RefreshCw, Settings, Columns,
  ArrowUpDown, User, Building, Hash, FileText, Timer
} from 'lucide-react';

interface CallLog {
  id: string;
  prospectId?: string;
  prospectName: string;
  phoneNumber: string;
  fromNumber: string;
  outcome: string;
  duration: number;
  note: string;
  timestamp: string;
  callerName?: string;
  company?: string;
  callSid?: string;
  endReason?: string;
  answeredBy?: string;
  recordingUrl?: string;
}

interface SavedView {
  id: string;
  name: string;
  filters: FilterState;
  columns: string[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  isDefault?: boolean;
  createdAt: string;
}

interface FilterState {
  search: string;
  dateFrom: string;
  dateTo: string;
  outcomes: string[];
  callers: string[];
  durationMin: string;
  durationMax: string;
  hasRecording: 'all' | 'yes' | 'no';
  answeredBy: string[];
}

// Orum-style Call Dispositions - matching PowerDialer
const OUTCOMES = [
  // Not Contacted - No Conversation
  'No Answer',
  'Left Voicemail',
  'Went to Voicemail',
  'Busy Signal',
  'Bad Number',
  'False Positive',
  // Contacted - Gatekeeper
  'Gatekeeper: Did not Transfer',
  'Gatekeeper transferred: Did not leave VM',
  'Gatekeeper transferred: Left VM',
  // Contacted - Negative/Rejection
  'Hang Up',
  'Hook Rejected',
  'Elevator Pitch Rejected',
  // Contacted - Objections
  'Objection: Already Have a Solution',
  'Objection: Asked to Send Info',
  'Objection: Not a Priority',
  'Objection: Other',
  // Contacted - Wrong Person
  'Wrong Person: Gave Referral',
  'Wrong Person: No referral',
  'Person Left Company',
  // Contacted - Follow Up
  'Follow-Up Required',
  'Busy: Call Later',
  'Reach back out in X time',
  // Contacted - Positive Outcome
  'Meeting Scheduled',
  // Legacy outcomes for backward compatibility
  'Connected',
  'Voicemail',
  'Busy',
  'Not Interested',
  'Callback',
  'Wrong Number',
];
const ANSWERED_BY_OPTIONS = ['human', 'machine', 'unknown'];

const DEFAULT_COLUMNS = ['timestamp', 'prospectName', 'phoneNumber', 'duration', 'outcome', 'callerName', 'note', 'recording'];

const ALL_COLUMNS = [
  { key: 'timestamp', label: 'Date & Time', icon: Calendar },
  { key: 'prospectName', label: 'Prospect', icon: User },
  { key: 'company', label: 'Company', icon: Building },
  { key: 'phoneNumber', label: 'Phone', icon: Phone },
  { key: 'fromNumber', label: 'Caller ID', icon: Hash },
  { key: 'duration', label: 'Duration', icon: Timer },
  { key: 'outcome', label: 'Outcome', icon: CheckCircle },
  { key: 'callerName', label: 'Agent', icon: User },
  { key: 'answeredBy', label: 'Answered By', icon: Phone },
  { key: 'endReason', label: 'End Reason', icon: XCircle },
  { key: 'note', label: 'Notes', icon: FileText },
  { key: 'recording', label: 'Recording', icon: Play },
];

const CallHistoryAdvanced: React.FC = () => {
  // Data state
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    dateFrom: '',
    dateTo: '',
    outcomes: [],
    callers: [],
    durationMin: '',
    durationMax: '',
    hasRecording: 'all',
    answeredBy: [],
  });
  const [showFilters, setShowFilters] = useState(true);
  
  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  
  // Sorting
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Saved views
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeView, setActiveView] = useState<SavedView | null>(null);
  const [showSaveViewModal, setShowSaveViewModal] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [showViewsDropdown, setShowViewsDropdown] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  // Recording menu state
  const [openRecordingMenu, setOpenRecordingMenu] = useState<string | null>(null);
  
  // Unique callers for filter dropdown
  const uniqueCallers = useMemo(() => {
    const callers = new Set<string>();
    callLogs.forEach(log => {
      if (log.callerName) callers.add(log.callerName);
    });
    return Array.from(callers).sort();
  }, [callLogs]);

  // Load call logs
  const loadCallLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const logs = await backendAPI.getCallHistory();
      setCallLogs(logs);
    } catch (err: any) {
      setError(err.message || 'Failed to load call history');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load saved views from localStorage
  const loadSavedViews = useCallback(() => {
    try {
      const saved = localStorage.getItem('callHistoryViews');
      if (saved) {
        setSavedViews(JSON.parse(saved));
      }
    } catch (err) {
      console.error('Failed to load saved views:', err);
    }
  }, []);

  useEffect(() => {
    loadCallLogs();
    loadSavedViews();
  }, [loadCallLogs, loadSavedViews]);

  // Close recording menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openRecordingMenu) {
        setOpenRecordingMenu(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openRecordingMenu]);

  // Filter and sort logs
  const filteredLogs = useMemo(() => {
    let result = [...callLogs];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(log =>
        log.prospectName?.toLowerCase().includes(searchLower) ||
        log.phoneNumber?.includes(filters.search) ||
        log.note?.toLowerCase().includes(searchLower) ||
        log.callerName?.toLowerCase().includes(searchLower)
      );
    }

    // Date filters
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      result = result.filter(log => new Date(log.timestamp) >= fromDate);
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter(log => new Date(log.timestamp) <= toDate);
    }

    // Outcome filter
    if (filters.outcomes.length > 0) {
      result = result.filter(log => filters.outcomes.includes(log.outcome));
    }

    // Caller filter
    if (filters.callers.length > 0) {
      result = result.filter(log => log.callerName && filters.callers.includes(log.callerName));
    }

    // Duration filter
    if (filters.durationMin) {
      const min = parseInt(filters.durationMin) * 60;
      result = result.filter(log => log.duration >= min);
    }
    if (filters.durationMax) {
      const max = parseInt(filters.durationMax) * 60;
      result = result.filter(log => log.duration <= max);
    }

    // Recording filter
    if (filters.hasRecording === 'yes') {
      result = result.filter(log => log.recordingUrl);
    } else if (filters.hasRecording === 'no') {
      result = result.filter(log => !log.recordingUrl);
    }

    // Answered by filter
    if (filters.answeredBy.length > 0) {
      result = result.filter(log => log.answeredBy && filters.answeredBy.includes(log.answeredBy));
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortBy as keyof CallLog];
      let bVal: any = b[sortBy as keyof CallLog];

      if (sortBy === 'timestamp') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else if (sortBy === 'duration') {
        aVal = aVal || 0;
        bVal = bVal || 0;
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return result;
  }, [callLogs, filters, sortBy, sortOrder]);

  // Paginated logs
  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, page, pageSize]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize);

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get outcome badge style
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

  // Handle column sort
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  // Save view
  const saveView = () => {
    if (!newViewName.trim()) return;

    const newView: SavedView = {
      id: Date.now().toString(),
      name: newViewName.trim(),
      filters: { ...filters },
      columns: [...visibleColumns],
      sortBy,
      sortOrder,
      createdAt: new Date().toISOString(),
    };

    const updatedViews = [...savedViews, newView];
    setSavedViews(updatedViews);
    localStorage.setItem('callHistoryViews', JSON.stringify(updatedViews));
    setShowSaveViewModal(false);
    setNewViewName('');
    setActiveView(newView);
  };

  // Apply saved view
  const applyView = (view: SavedView) => {
    setFilters(view.filters);
    setVisibleColumns(view.columns);
    setSortBy(view.sortBy);
    setSortOrder(view.sortOrder);
    setActiveView(view);
    setShowViewsDropdown(false);
  };

  // Delete saved view
  const deleteView = (viewId: string) => {
    const updatedViews = savedViews.filter(v => v.id !== viewId);
    setSavedViews(updatedViews);
    localStorage.setItem('callHistoryViews', JSON.stringify(updatedViews));
    if (activeView?.id === viewId) {
      setActiveView(null);
    }
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      search: '',
      dateFrom: '',
      dateTo: '',
      outcomes: [],
      callers: [],
      durationMin: '',
      durationMax: '',
      hasRecording: 'all',
      answeredBy: [],
    });
    setActiveView(null);
  };

  // Toggle outcome filter
  const toggleOutcome = (outcome: string) => {
    setFilters(prev => ({
      ...prev,
      outcomes: prev.outcomes.includes(outcome)
        ? prev.outcomes.filter(o => o !== outcome)
        : [...prev.outcomes, outcome]
    }));
  };

  // Toggle caller filter
  const toggleCaller = (caller: string) => {
    setFilters(prev => ({
      ...prev,
      callers: prev.callers.includes(caller)
        ? prev.callers.filter(c => c !== caller)
        : [...prev.callers, caller]
    }));
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = visibleColumns.map(col => ALL_COLUMNS.find(c => c.key === col)?.label || col);
    const rows = filteredLogs.map(log => 
      visibleColumns.map(col => {
        const val = log[col as keyof CallLog];
        if (col === 'timestamp') return new Date(val as string).toLocaleString();
        if (col === 'duration') return formatDuration(val as number);
        return val || '';
      })
    );

    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `call-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Delete selected
  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} call log(s)?`)) return;

    try {
      await backendAPI.deleteCallLogs(Array.from(selectedIds));
      setCallLogs(prev => prev.filter(log => !selectedIds.has(log.id)));
      setSelectedIds(new Set());
    } catch (err) {
      alert('Failed to delete call logs');
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const totalCalls = filteredLogs.length;
    const totalDuration = filteredLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
    const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
    const connected = filteredLogs.filter(log => log.outcome === 'Connected').length;
    const connectRate = totalCalls > 0 ? Math.round((connected / totalCalls) * 100) : 0;

    return { totalCalls, totalDuration, avgDuration, connected, connectRate };
  }, [filteredLogs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Call History</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filteredLogs.length} calls {filters.search || filters.outcomes.length > 0 ? '(filtered)' : ''}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Saved Views Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowViewsDropdown(!showViewsDropdown)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition"
              >
                <Eye size={18} />
                <span>{activeView?.name || 'Views'}</span>
                <ChevronDown size={16} />
              </button>
              
              {showViewsDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50">
                  <div className="p-2 border-b border-gray-200 dark:border-gray-600">
                    <button
                      onClick={() => {
                        setShowSaveViewModal(true);
                        setShowViewsDropdown(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                    >
                      <Plus size={16} />
                      Save Current View
                    </button>
                  </div>
                  
                  {savedViews.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                      No saved views
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto">
                      {savedViews.map(view => (
                        <div
                          key={view.id}
                          className={`flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 ${
                            activeView?.id === view.id ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                          }`}
                        >
                          <button
                            onClick={() => applyView(view)}
                            className="flex-1 text-left text-sm text-gray-700 dark:text-gray-300"
                          >
                            {view.name}
                          </button>
                          <button
                            onClick={() => deleteView(view.id)}
                            className="p-1 text-gray-400 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition ${
                showFilters 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <Filter size={18} />
              Filters
              {(filters.outcomes.length > 0 || filters.callers.length > 0 || filters.search) && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full">
                  {filters.outcomes.length + filters.callers.length + (filters.search ? 1 : 0)}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition"
            >
              <Columns size={18} />
              Columns
            </button>

            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition"
            >
              <Download size={18} />
              Export
            </button>

            <button
              onClick={loadCallLogs}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            >
              <RefreshCw size={18} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Phone size={16} className="text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">Total Calls:</span>
            <span className="font-semibold text-gray-900 dark:text-white">{stats.totalCalls}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">Total Time:</span>
            <span className="font-semibold text-gray-900 dark:text-white">{formatDuration(stats.totalDuration)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Timer size={16} className="text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">Avg Duration:</span>
            <span className="font-semibold text-gray-900 dark:text-white">{formatDuration(stats.avgDuration)}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-green-500" />
            <span className="text-gray-600 dark:text-gray-400">Connect Rate:</span>
            <span className="font-semibold text-green-600 dark:text-green-400">{stats.connectRate}%</span>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Search</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  placeholder="Search prospects, notes..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">From Date</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">To Date</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Duration Range */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Duration (min)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={filters.durationMin}
                  onChange={(e) => setFilters(prev => ({ ...prev, durationMin: e.target.value }))}
                  placeholder="Min"
                  className="w-1/2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  value={filters.durationMax}
                  onChange={(e) => setFilters(prev => ({ ...prev, durationMax: e.target.value }))}
                  placeholder="Max"
                  className="w-1/2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Outcome Filters */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Outcomes</label>
            <div className="flex flex-wrap gap-2">
              {OUTCOMES.map(outcome => {
                const badge = getOutcomeBadge(outcome);
                const isSelected = filters.outcomes.includes(outcome);
                return (
                  <button
                    key={outcome}
                    onClick={() => toggleOutcome(outcome)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition ${
                      isSelected
                        ? `${badge.bg} ${badge.text} ring-2 ring-offset-1 ring-blue-500`
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {badge.icon}
                    {outcome}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Agent Filter */}
          {uniqueCallers.length > 0 && (
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Agents</label>
              <div className="flex flex-wrap gap-2">
                {uniqueCallers.map(caller => {
                  const isSelected = filters.callers.includes(caller);
                  return (
                    <button
                      key={caller}
                      onClick={() => toggleCaller(caller)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition ${
                        isSelected
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-2 ring-offset-1 ring-blue-500'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <User size={14} />
                      {caller}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recording & Reset */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Has Recording:</label>
              <select
                value={filters.hasRecording}
                onChange={(e) => setFilters(prev => ({ ...prev, hasRecording: e.target.value as any }))}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="all">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            <button
              onClick={resetFilters}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
            >
              <X size={16} />
              Reset Filters
            </button>
          </div>
        </div>
      )}

      {/* Column Picker Dropdown */}
      {showColumnPicker && (
        <div className="absolute right-24 top-36 w-64 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-gray-900 dark:text-white">Visible Columns</span>
            <button onClick={() => setShowColumnPicker(false)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {ALL_COLUMNS.map(col => (
              <label key={col.key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(col.key)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setVisibleColumns(prev => [...prev, col.key]);
                    } else {
                      setVisibleColumns(prev => prev.filter(c => c !== col.key));
                    }
                  }}
                  className="w-4 h-4 rounded"
                />
                <col.icon size={14} className="text-gray-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{col.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Selection Toolbar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800 px-6 py-3 flex items-center justify-between">
          <span className="text-sm text-blue-700 dark:text-blue-300">
            {selectedIds.size} call(s) selected
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={deleteSelected}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition"
            >
              <Trash2 size={16} />
              Delete Selected
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
            <tr>
              <th className="px-4 py-3 w-12">
                <input
                  type="checkbox"
                  checked={selectedIds.size === paginatedLogs.length && paginatedLogs.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(new Set(paginatedLogs.map(l => l.id)));
                    } else {
                      setSelectedIds(new Set());
                    }
                  }}
                  className="w-4 h-4 rounded"
                />
              </th>
              {visibleColumns.map(colKey => {
                const col = ALL_COLUMNS.find(c => c.key === colKey);
                if (!col) return null;
                return (
                  <th
                    key={colKey}
                    onClick={() => handleSort(colKey)}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <div className="flex items-center gap-2">
                      <col.icon size={14} />
                      {col.label}
                      {sortBy === colKey && (
                        sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
            {paginatedLogs.map(log => (
              <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(log.id)}
                    onChange={(e) => {
                      setSelectedIds(prev => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(log.id);
                        else next.delete(log.id);
                        return next;
                      });
                    }}
                    className="w-4 h-4 rounded"
                  />
                </td>
                {visibleColumns.map(colKey => {
                  switch (colKey) {
                    case 'timestamp':
                      return (
                        <td key={colKey} className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                      );
                    case 'prospectName':
                      return (
                        <td key={colKey} className="px-4 py-3">
                          <span className="font-medium text-gray-900 dark:text-white">{log.prospectName}</span>
                        </td>
                      );
                    case 'company':
                      return (
                        <td key={colKey} className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                          {log.company || '-'}
                        </td>
                      );
                    case 'phoneNumber':
                      return (
                        <td key={colKey} className="px-4 py-3 text-sm font-mono text-gray-500 dark:text-gray-400">
                          {log.phoneNumber}
                        </td>
                      );
                    case 'fromNumber':
                      return (
                        <td key={colKey} className="px-4 py-3 text-sm font-mono text-gray-500 dark:text-gray-400">
                          {log.fromNumber || '-'}
                        </td>
                      );
                    case 'duration':
                      return (
                        <td key={colKey} className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                          {formatDuration(log.duration)}
                        </td>
                      );
                    case 'outcome':
                      const badge = getOutcomeBadge(log.outcome);
                      return (
                        <td key={colKey} className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                            {badge.icon}
                            {log.outcome}
                          </span>
                        </td>
                      );
                    case 'callerName':
                      return (
                        <td key={colKey} className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                          {log.callerName || '-'}
                        </td>
                      );
                    case 'answeredBy':
                      return (
                        <td key={colKey} className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 capitalize">
                          {log.answeredBy || '-'}
                        </td>
                      );
                    case 'endReason':
                      return (
                        <td key={colKey} className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                          {log.endReason || '-'}
                        </td>
                      );
                    case 'note':
                      return (
                        <td key={colKey} className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                          {log.note || '-'}
                        </td>
                      );
                    case 'recording':
                      return (
                        <td key={colKey} className="px-4 py-3">
                          {log.recordingUrl ? (
                            <div className="flex items-center gap-2">
                              <audio controls src={`/api/calls/recording/${log.id}/stream`} className="h-8 w-32" />
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenRecordingMenu(openRecordingMenu === log.id ? null : log.id);
                                  }}
                                  className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                  title="More options"
                                >
                                  <MoreVertical size={16} className="text-gray-500 dark:text-gray-400" />
                                </button>
                                {openRecordingMenu === log.id && (
                                  <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 min-w-[140px] py-1">
                                    <a
                                      href={`/api/calls/recording/${log.id}/download`}
                                      download={`recording-${log.id}.mp3`}
                                      onClick={() => setOpenRecordingMenu(null)}
                                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    >
                                      <Download size={14} />
                                      Download
                                    </a>
                                    <button
                                      onClick={() => {
                                        window.open(`/api/calls/recording/${log.id}/stream`, '_blank');
                                        setOpenRecordingMenu(null);
                                      }}
                                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-full text-left"
                                    >
                                      <Eye size={14} />
                                      Open in new tab
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                      );
                    default:
                      return <td key={colKey} className="px-4 py-3">-</td>;
                  }
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {paginatedLogs.length === 0 && (
          <div className="text-center py-12">
            <Phone size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No calls match your filters</p>
            <button onClick={resetFilters} className="mt-2 text-blue-600 hover:underline text-sm">
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50"
            >
              <ChevronUp size={16} className="rotate-[-90deg]" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50"
            >
              <ChevronDown size={16} className="rotate-[-90deg]" />
            </button>
          </div>
        </div>
      )}

      {/* Save View Modal */}
      {showSaveViewModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Save Custom View</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Save your current filters and column configuration as a reusable view.
            </p>
            <input
              type="text"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="View name (e.g., 'This Week's Connected Calls')"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowSaveViewModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={saveView}
                disabled={!newViewName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg"
              >
                Save View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallHistoryAdvanced;
