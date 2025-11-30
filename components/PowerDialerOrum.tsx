import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Prospect, LeadList } from '../types';
import { 
  Play, Pause, Phone, User, ChevronDown, ChevronLeft, ChevronRight,
  Mic, Volume2, Settings, Linkedin, AlertCircle, Check, MoreVertical,
  CheckCircle, RefreshCw, Trash2, X, Plus, Upload
} from 'lucide-react';
import { backendAPI } from '../services/BackendAPI';

declare global {
  interface Window {
    __powerDialerAdvanceToNext?: () => void;
  }
}

interface Props {
  queue: Prospect[];
  onCall: (prospect: Prospect) => void;
  disabled?: boolean;
  dispositionSaved?: boolean;
  setDispositionSaved?: (v: boolean) => void;
  onDeleteProspect?: (id: string) => void;
  onUpdateProspect?: (id: string, updates: Partial<Prospect>) => void;
  powerDialerPaused?: boolean;
  setPowerDialerPaused?: (v: boolean) => void;
}

const PowerDialerOrum: React.FC<Props> = ({
  queue,
  onCall,
  disabled = false,
  dispositionSaved,
  setDispositionSaved,
  onDeleteProspect,
  onUpdateProspect,
  powerDialerPaused,
  setPowerDialerPaused
}) => {
  // Session States
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [callDispositions, setCallDispositions] = useState<Record<string, string>>({});
  const [stableQueue, setStableQueue] = useState<Prospect[]>([]);
  const [callTimer, setCallTimer] = useState(0);
  const [callStatus, setCallStatus] = useState<'dialing' | 'ringing' | 'connected' | 'ended'>('dialing');
  
  // UI States
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('default');
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState({
    status: true,
    name: true,
    phone: true,
    links: true,
    city: true
  });
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [numberTemp, setNumberTemp] = useState('default');
  
  // Dialer Options
  const [selectedList, setSelectedList] = useState('current');
  const [parallelDials, setParallelDials] = useState(1);
  const [phoneField, setPhoneField] = useState('Phone');
  const [callFromNumber, setCallFromNumber] = useState('');
  const [voicemailOption, setVoicemailOption] = useState('No voicemail');
  const [twilioNumbers, setTwilioNumbers] = useState<Array<{sid: string; phoneNumber: string; friendlyName?: string}>>([]);
  const [audioDevices, setAudioDevices] = useState<{
    microphones: MediaDeviceInfo[];
    speakers: MediaDeviceInfo[];
  }>({ microphones: [], speakers: [] });
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('');
  const [micMuted, setMicMuted] = useState(false);
  const [micVolume, setMicVolume] = useState(80);
  const [speakerVolume, setSpeakerVolume] = useState(80);

  // Lead List States
  const [leadLists, setLeadLists] = useState<LeadList[]>([]);
  const [showListDropdown, setShowListDropdown] = useState(false);
  const [hoveredListId, setHoveredListId] = useState<string | null>(null);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [listToReassign, setListToReassign] = useState<LeadList | null>(null);
  const [reassignUserId, setReassignUserId] = useState('');
  const [showDeleteListModal, setShowDeleteListModal] = useState(false);
  const [listToDelete, setListToDelete] = useState<LeadList | null>(null);
  const listDropdownRef = useRef<HTMLDivElement>(null);

  const isAdvancingRef = React.useRef(false);
  const isCallingRef = React.useRef(false);
  const stableQueueRef = React.useRef<Prospect[]>([]);
  const currentIndexRef = React.useRef(0);

  const effectivePaused = isPaused || Boolean(powerDialerPaused);
  
  // Apply filtering
  let filteredQueue = isActive ? stableQueue : queue;
  if (filterStatus !== 'all') {
    filteredQueue = filteredQueue.filter(p => p.status === filterStatus);
  }
  
  // Apply sorting
  let sortedQueue = [...filteredQueue];
  if (sortBy === 'name') {
    sortedQueue.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  } else if (sortBy === 'status') {
    sortedQueue.sort((a, b) => a.status.localeCompare(b.status));
  }
  
  const activeQueue = sortedQueue;
  const currentProspect = activeQueue[currentIndex];
  const nextProspect = activeQueue[currentIndex + 1];

  React.useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Load lead lists
  useEffect(() => {
    const loadLeadLists = async () => {
      try {
        const lists = await backendAPI.getLeadLists();
        setLeadLists(lists);
      } catch (err) {
        console.error('Failed to load lead lists:', err);
      }
    };
    loadLeadLists();
  }, []);

  // Close list dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (listDropdownRef.current && !listDropdownRef.current.contains(event.target as Node)) {
        setShowListDropdown(false);
        setHoveredListId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Call timer effect
  useEffect(() => {
    if (!isActive || isPaused || callStatus === 'ended') return;
    
    const timer = setInterval(() => {
      setCallTimer(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isActive, isPaused, callStatus]);

  // Simulate call status progression (replace with real Twilio events)
  useEffect(() => {
    if (!isActive || isPaused) return;
    
    const dialingTimer = setTimeout(() => setCallStatus('ringing'), 2000);
    const ringingTimer = setTimeout(() => setCallStatus('connected'), 5000);
    
    return () => {
      clearTimeout(dialingTimer);
      clearTimeout(ringingTimer);
    };
  }, [isActive, isPaused, currentIndex]);

  const formatCallTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Lead List Action Handlers
  const handleUseList = (list: LeadList) => {
    setSelectedList(list.id);
    setShowListDropdown(false);
    setHoveredListId(null);
  };

  const handleReassignList = (list: LeadList) => {
    setListToReassign(list);
    setShowReassignModal(true);
    setShowListDropdown(false);
    setHoveredListId(null);
  };

  const handleDeleteListClick = (list: LeadList) => {
    setListToDelete(list);
    setShowDeleteListModal(true);
    setShowListDropdown(false);
    setHoveredListId(null);
  };

  const confirmDeleteList = async () => {
    if (!listToDelete) return;
    try {
      await backendAPI.deleteLeadList(listToDelete.id);
      setLeadLists(prev => prev.filter(l => l.id !== listToDelete.id));
      if (selectedList === listToDelete.id) {
        setSelectedList('current');
      }
      setShowDeleteListModal(false);
      setListToDelete(null);
    } catch (err) {
      console.error('Failed to delete list:', err);
    }
  };

  const confirmReassignList = async () => {
    if (!listToReassign || !reassignUserId) return;
    try {
      // Add permission to the new user
      await backendAPI.addLeadListPermission(listToReassign.id, reassignUserId, true, true);
      setShowReassignModal(false);
      setListToReassign(null);
      setReassignUserId('');
    } catch (err) {
      console.error('Failed to reassign list:', err);
    }
  };

  const getSelectedListName = () => {
    if (selectedList === 'current') return 'San Diego 1.csv';
    const list = leadLists.find(l => l.id === selectedList);
    return list?.name || 'Select a list';
  };

  const handleQuickDisposition = async (disp: 'Connected' | 'Voicemail' | 'Busy' | 'No Answer' | 'Meeting Set' | 'Not Interested') => {
    const currentProspect = activeQueue[currentIndex];
    if (!currentProspect) return;

    setCallDispositions(prev => ({ ...prev, [currentProspect.id]: disp }));
    setCallStatus('ended');
    
    // Log the call
    try {
      await backendAPI.logCall({
        prospectName: `${currentProspect.firstName} ${currentProspect.lastName}`,
        phoneNumber: currentProspect.phone,
        duration: callTimer,
        outcome: disp,
        note: '',
        fromNumber: callFromNumber,
        timestamp: new Date().toISOString(),
        prospectId: currentProspect.id
      });
    } catch (error) {
      console.error('Failed to log call:', error);
    }

    // Advance to next after short delay
    setTimeout(() => {
      advanceToNextLead();
    }, 500);
  };

  useEffect(() => {
    const loadTwilioNumbers = async () => {
      try {
        const numbers = await backendAPI.getTwilioNumbers();
        setTwilioNumbers(numbers);
        if (numbers.length > 0 && !callFromNumber) {
          setCallFromNumber(numbers[0].phoneNumber);
        }
      } catch (error) {
        console.error('Failed to load Twilio numbers:', error);
      }
    };
    loadTwilioNumbers();
  }, []);

  // Load audio devices
  useEffect(() => {
    const loadAudioDevices = async () => {
      try {
        // Request microphone permission first
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Get all audio devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const microphones = devices.filter(d => d.kind === 'audioinput');
        const speakers = devices.filter(d => d.kind === 'audiooutput');
        
        setAudioDevices({ microphones, speakers });
        
        // Set defaults
        if (microphones.length > 0 && !selectedMicrophone) {
          setSelectedMicrophone(microphones[0].deviceId);
        }
        if (speakers.length > 0 && !selectedSpeaker) {
          setSelectedSpeaker(speakers[0].deviceId);
        }
      } catch (error) {
        console.error('Failed to load audio devices:', error);
      }
    };

    loadAudioDevices();
  }, []);

  const advanceToNextLead = useCallback((shouldCall: boolean = true) => {
    if (isAdvancingRef.current || isCallingRef.current) return;
    isAdvancingRef.current = true;

    const currentQueue = stableQueueRef.current;
    const prevIndex = currentIndexRef.current;

    if (!currentQueue.length) {
      isAdvancingRef.current = false;
      return;
    }

    const prospectId = currentQueue[prevIndex]?.id;
    if (prospectId) {
      setCompletedIds(ids => ids.includes(prospectId) ? ids : [...ids, prospectId]);
    }

    if (prevIndex < currentQueue.length - 1) {
      const nextIndex = prevIndex + 1;
      currentIndexRef.current = nextIndex;
      setCurrentIndex(nextIndex);

      const nextProspect = currentQueue[nextIndex];
      if (shouldCall && nextProspect) {
        isCallingRef.current = true;
        setTimeout(() => {
          if (!effectivePaused) {
            onCall(nextProspect);
          }
          isCallingRef.current = false;
          isAdvancingRef.current = false;
        }, 500);
      } else {
        isAdvancingRef.current = false;
      }
    } else {
      isAdvancingRef.current = false;
    }
  }, [onCall, effectivePaused]);

  useEffect(() => {
    window.__powerDialerAdvanceToNext = advanceToNextLead;
    return () => {
      if (window.__powerDialerAdvanceToNext) delete window.__powerDialerAdvanceToNext;
    };
  }, [advanceToNextLead]);

  useEffect(() => {
    if (dispositionSaved && isActive && !isPaused && !powerDialerPaused) {
      advanceToNextLead(true);
      if (setDispositionSaved) setDispositionSaved(false);
    }
  }, [dispositionSaved, isActive, isPaused, powerDialerPaused, advanceToNextLead, setDispositionSaved]);

  const handleStart = () => {
    const snapshot = [...queue];
    stableQueueRef.current = snapshot;
    currentIndexRef.current = 0;
    setStableQueue(snapshot);
    setIsActive(true);
    setIsPaused(false);
    setCurrentIndex(0);
    setCompletedIds([]);
    setCallTimer(0);
    setCallStatus('dialing');

    if (snapshot.length > 0) {
      isCallingRef.current = true;
      onCall(snapshot[0]);
      // Auto-expand the current row being called
      setExpandedRowId(snapshot[0].id);
      setTimeout(() => {
        isCallingRef.current = false;
      }, 2000);
    }
  };

  const handlePauseResume = useCallback(() => {
    setIsPaused(prev => !prev);
    if (setPowerDialerPaused) {
      setPowerDialerPaused(!effectivePaused);
    }
  }, [effectivePaused, setPowerDialerPaused]);

  const handleEndSession = () => {
    setIsActive(false);
    setIsPaused(false);
    setCurrentIndex(0);
    setStableQueue([]);
    setCompletedIds([]);
    setCallDispositions({});
    setSelectedIds([]);
    setCallTimer(0);
    setCallStatus('dialing');
    setExpandedRowId(null);
    stableQueueRef.current = [];
    currentIndexRef.current = 0;
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(activeQueue.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(i => i !== id));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    
    if (!confirm(`Delete ${selectedIds.length} selected prospect(s)?`)) return;

    const successIds: string[] = [];
    const failedIds: string[] = [];

    try {
      // Delete from backend one by one to track failures
      for (const id of selectedIds) {
        try {
          await backendAPI.deleteProspect(id);
          successIds.push(id);
        } catch (error: any) {
          console.error(`Failed to delete prospect ${id}:`, error);
          failedIds.push(id);
        }
      }
      
      // Update local state for ALL selected (even failed ones should be removed from selection)
      if (isActive) {
        setStableQueue(stableQueue.filter(p => !selectedIds.includes(p.id)));
      }
      
      // Notify parent if callback exists
      if (onDeleteProspect && successIds.length > 0) {
        successIds.forEach(id => onDeleteProspect(id));
      }
      
      // Clear all selections
      setSelectedIds([]);
      
      // Show result
      if (failedIds.length > 0 && successIds.length === 0) {
        alert(`Failed to delete prospects. They may have already been deleted or you may not have permission.`);
      } else if (failedIds.length > 0) {
        alert(`Deleted ${successIds.length} prospect(s). ${failedIds.length} prospect(s) could not be deleted (may already be deleted).`);
      }
      // Success - no alert needed for full success
    } catch (error) {
      console.error('Failed to delete prospects:', error);
      alert('An error occurred while deleting prospects. Please try again.');
    }
  };

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns({ ...visibleColumns, [column]: !visibleColumns[column] });
  };

  const getStatusBadge = (index: number) => {
    const prospect = stableQueue[index];
    if (!prospect) return null;

    if (index === currentIndex) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-blue-50 text-blue-700 border border-blue-200">
          <Phone className="w-3.5 h-3.5 animate-pulse" />
          Dialing ...
        </span>
      );
    }

    if (completedIds.includes(prospect.id)) {
      const callDisposition = callDispositions[prospect.id] || 'Ended';
      
      // Map dispositions to badge styles
      const dispositionStyles: Record<string, { bg: string; text: string; border: string; icon: any }> = {
        'Voicemail': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: AlertCircle },
        'No Answer': { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', icon: Phone },
        'Wrong Number': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: AlertCircle },
        'Connected': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: Check },
        'Not Interested': { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', icon: AlertCircle },
        'Callback': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: Phone },
        'Meeting Set': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: Check },
        'Ended': { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', icon: AlertCircle }
      };
      
      const style = dispositionStyles[callDisposition] || dispositionStyles['Ended'];
      const Icon = style.icon;
      
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm ${style.bg} ${style.text} border ${style.border}`}>
          <Icon className="w-3.5 h-3.5" />
          {callDisposition}
        </span>
      );
    }

    if (index > currentIndex) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-gray-50 text-gray-600 border border-gray-200">
          <Phone className="w-3.5 h-3.5" />
          Upcoming
        </span>
      );
    }

    return null;
  };

  // Main Layout - Always show table with left sidebar
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Left Sidebar - Dialer Options (collapsible) */}
      <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-visible">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Dialer options</h3>
            <button className="text-gray-400 hover:text-gray-600">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-visible p-4 space-y-5">
          {/* List Selector with Actions */}
          <div className="relative" ref={listDropdownRef}>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                List
              </label>
              <button
                onClick={() => window.location.href = '#/lead-lists?import=true'}
                className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition"
                title="Add CSV"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            {/* Custom Dropdown Trigger */}
            <button
              onClick={() => setShowListDropdown(!showListDropdown)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
            >
              <span className="truncate text-left flex-1">{getSelectedListName()}</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <X 
                  className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedList('current');
                  }}
                />
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showListDropdown ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Custom Dropdown Menu */}
            {showListDropdown && (
              <div 
                className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-[100]"
                style={{ width: '220px' }}
              >
                {/* RECENTS Header */}
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-100 dark:border-gray-600">
                  Recents
                </div>
                
                {/* List Items */}
                <div className="max-h-60 overflow-y-auto">
                  {leadLists.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                      No lead lists available
                    </div>
                  ) : (
                    leadLists.map((list) => (
                      <div
                        key={list.id}
                        className="relative"
                      >
                        <div
                          className={`px-3 py-2.5 flex items-center gap-2 ${
                            selectedList === list.id ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                          }`}
                        >
                          {/* Clickable name area */}
                          <div 
                            className="flex-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 -ml-3 -my-2.5 pl-3 pr-2 py-2.5 rounded-l"
                            onClick={() => handleUseList(list)}
                          >
                            <div className={`text-sm ${selectedList === list.id ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-800 dark:text-white'}`}>
                              {list.name}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              <User className="w-3 h-3" />
                              <span>{list.createdBy || 'Don Vee'}</span>
                            </div>
                          </div>
                          
                          {/* Delete (X) button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteListClick(list);
                            }}
                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            title="Delete CSV"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          
                          {/* Expand submenu button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setHoveredListId(hoveredListId === list.id ? null : list.id);
                            }}
                            className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors ${
                              hoveredListId === list.id ? 'bg-gray-200 dark:bg-gray-500' : ''
                            }`}
                            title="More options"
                          >
                            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${hoveredListId === list.id ? 'rotate-90' : ''}`} />
                          </button>
                        </div>
                        
                        {/* Right Submenu on Click */}
                        {hoveredListId === list.id && (
                          <div 
                            className="fixed bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-xl py-1 z-[200]"
                            style={{ 
                              left: (listDropdownRef.current?.getBoundingClientRect().right || 0) + 8,
                              top: 'auto',
                              minWidth: '160px'
                            }}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUseList(list);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                            >
                              <Check className="w-4 h-4 text-gray-600" />
                              Use this CSV
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReassignList(list);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                            >
                              <RefreshCw className="w-4 h-4 text-gray-600" />
                              Reassign this CSV
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteListClick(list);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete this CSV
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Import New CSV */}
                <div className="border-t border-gray-100 dark:border-gray-600">
                  <button
                    onClick={() => {
                      setShowListDropdown(false);
                      setHoveredListId(null);
                      // Navigate to lead lists page with import modal
                      const event = new CustomEvent('openImportModal');
                      window.dispatchEvent(event);
                      // Also change view
                      const navEvent = new CustomEvent('navigateTo', { detail: 'lead-lists' });
                      window.dispatchEvent(navEvent);
                    }}
                    className="w-full px-3 py-2.5 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2 font-medium"
                  >
                    <Upload className="w-4 h-4" />
                    Import a new CSV
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Parallel Dials */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              Parallel dials
            </label>
            <div className="relative">
              <select
                value={parallelDials}
                onChange={(e) => setParallelDials(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md appearance-none bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>1 (Power dialing)</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Phone Fields */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              Phone fields
            </label>
            <div className="relative">
              <select
                value={phoneField}
                onChange={(e) => setPhoneField(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md appearance-none bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Phone">Phone</option>
                <option value="Mobile Phone">Mobile Phone</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Call From Number */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              Call from number
            </label>
            <div className="relative">
              <select
                value={callFromNumber}
                onChange={(e) => setCallFromNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md appearance-none bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={twilioNumbers.length === 0}
              >
                {twilioNumbers.length === 0 ? (
                  <option value="">Loading...</option>
                ) : (
                  twilioNumbers.map((num) => (
                    <option key={num.sid} value={num.phoneNumber}>
                      {num.phoneNumber}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 cursor-pointer hover:underline">
              Callbacks: Add number
            </p>
          </div>

          {/* Voicemail */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              Voicemail
            </label>
            <div className="relative">
              <select
                value={voicemailOption}
                onChange={(e) => setVoicemailOption(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md appearance-none bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="No voicemail">No voicemail</option>
                <option value="Best voicemail">Best voicemail</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Prospect Table */}
      <div className="flex-1 overflow-hidden bg-white dark:bg-gray-800">
        <div className="h-full flex flex-col">
          {/* Table Header */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
            {!isActive ? (
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">San Diego 1.csv</h2>
                  <button className="text-gray-400 hover:text-gray-600">
                    <Settings className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <User className="w-4 h-4" />
                    <span>469</span>
                    <span className="ml-2">📞 22</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleStart}
                    disabled={disabled || queue.length === 0}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="w-4 h-4" />
                    Start Session
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between mb-3">
                {/* Active Call Info - Left Side */}
                <div className="flex items-center gap-4">
                  {currentProspect && (
                    <>
                      <div className="flex flex-col">
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                          {currentProspect.firstName} {currentProspect.lastName}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {currentProspect.phone}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span>📞 Call {currentIndex + 1} of {queue.length}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Audio Controls & Session Controls - Right Side */}
                <div className="flex items-center gap-3">
                  {/* Microphone Control */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMicMuted(!micMuted)}
                      className={`p-2 rounded-lg transition-colors ${
                        micMuted 
                          ? 'bg-red-500 hover:bg-red-600 text-white' 
                          : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                      }`}
                      title={micMuted ? 'Unmute' : 'Mute'}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {micMuted ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        )}
                      </svg>
                    </button>
                    <select
                      value={selectedMicrophone}
                      onChange={(e) => setSelectedMicrophone(e.target.value)}
                      className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {audioDevices.microphones.map((mic) => (
                        <option key={mic.deviceId} value={mic.deviceId}>
                          {mic.label || `Microphone ${mic.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Speaker Control */}
                  <div className="flex items-center gap-2">
                    <button
                      className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                      title="Speaker"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                    </button>
                    <select
                      value={selectedSpeaker}
                      onChange={(e) => setSelectedSpeaker(e.target.value)}
                      className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {audioDevices.speakers.map((speaker) => (
                        <option key={speaker.deviceId} value={speaker.deviceId}>
                          {speaker.label || `Speaker ${speaker.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-px h-8 bg-gray-300 dark:bg-gray-600"></div>

                  {/* Session Controls */}
                  <button
                    onClick={() => setIsPaused(!isPaused)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium flex items-center gap-2 transition-colors"
                  >
                    {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    {isPaused ? 'Resume Dialing' : 'Pause Dialing'}
                  </button>
                  <button
                    onClick={handleEndSession}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                  >
                    End Session
                  </button>
                </div>
              </div>
            )}
            
            {/* Table Toolbar */}
            <div className="flex items-center gap-3 mt-3">
              {/* Sort By */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">⬆ Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 cursor-pointer hover:border-blue-500"
                >
                  <option value="default">Default (from CRM)</option>
                  <option value="name">Name A-Z</option>
                  <option value="status">Status</option>
                </select>
              </div>

              {/* Columns Button */}
              <div className="relative">
                <button
                  onClick={() => setShowColumnsMenu(!showColumnsMenu)}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2"
                >
                  <span className="text-gray-600">⚏</span>
                  Columns
                </button>
                {showColumnsMenu && (
                  <div className="absolute top-full mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3 z-50 min-w-[160px]">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={visibleColumns.status}
                          onChange={() => toggleColumn('status')}
                          className="rounded"
                        />
                        <span className="text-sm">Status</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={visibleColumns.name}
                          onChange={() => toggleColumn('name')}
                          className="rounded"
                        />
                        <span className="text-sm">Name</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={visibleColumns.phone}
                          onChange={() => toggleColumn('phone')}
                          className="rounded"
                        />
                        <span className="text-sm">Phone</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={visibleColumns.links}
                          onChange={() => toggleColumn('links')}
                          className="rounded"
                        />
                        <span className="text-sm">Links</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={visibleColumns.city}
                          onChange={() => toggleColumn('city')}
                          className="rounded"
                        />
                        <span className="text-sm">City</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Filter Button */}
              <div className="relative">
                <button
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2"
                >
                  <span className="text-gray-600">⊙</span>
                  Filter {filterStatus !== 'all' && <span className="ml-1 text-blue-600">•</span>}
                </button>
                {showFilterMenu && (
                  <div className="absolute top-full mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3 z-50 min-w-[180px]">
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-gray-500 mb-2">Filter by Status</div>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded">
                        <input
                          type="radio"
                          name="filter"
                          checked={filterStatus === 'all'}
                          onChange={() => setFilterStatus('all')}
                          className="rounded"
                        />
                        <span className="text-sm">All Prospects</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded">
                        <input
                          type="radio"
                          name="filter"
                          checked={filterStatus === 'New'}
                          onChange={() => setFilterStatus('New')}
                          className="rounded"
                        />
                        <span className="text-sm">New</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded">
                        <input
                          type="radio"
                          name="filter"
                          checked={filterStatus === 'Contacted'}
                          onChange={() => setFilterStatus('Contacted')}
                          className="rounded"
                        />
                        <span className="text-sm">Contacted</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded">
                        <input
                          type="radio"
                          name="filter"
                          checked={filterStatus === 'Qualified'}
                          onChange={() => setFilterStatus('Qualified')}
                          className="rounded"
                        />
                        <span className="text-sm">Qualified</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Number Temp Dropdown */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">📊</span>
                <select
                  value={numberTemp}
                  onChange={(e) => setNumberTemp(e.target.value)}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 cursor-pointer hover:border-blue-500"
                >
                  <option value="default">Number temp</option>
                  <option value="mobile">Mobile preferred</option>
                  <option value="work">Work only</option>
                  <option value="any">Any available</option>
                </select>
              </div>

              {/* Delete Selected Button */}
              {selectedIds.length > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  className="px-3 py-1 text-sm bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded flex items-center gap-2 font-medium transition-colors"
                >
                  🗑️ Delete ({selectedIds.length})
                </button>
              )}
            </div>
          </div>

          {/* Prospect Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === activeQueue.length && activeQueue.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 cursor-pointer"
                    />
                  </th>
                  <th className="w-10 px-4 py-3"></th>
                  {visibleColumns.status && <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Status</th>}
                  {visibleColumns.name && <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Name</th>}
                  {visibleColumns.phone && <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Phone</th>}
                  {visibleColumns.links && <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Links</th>}
                  {visibleColumns.city && <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">City</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {activeQueue.map((prospect, idx) => (
                  <React.Fragment key={prospect.id}>
                    <tr 
                      className={`
                        hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors
                        ${idx === currentIndex && isActive ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                      `}
                    >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(prospect.id)}
                        onChange={(e) => handleSelectOne(prospect.id, e.target.checked)}
                        className="rounded border-gray-300 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpandedRowId(expandedRowId === prospect.id ? null : prospect.id)}
                        className="hover:bg-gray-100 dark:hover:bg-gray-600 rounded p-1"
                      >
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
                          expandedRowId === prospect.id ? 'rotate-180' : ''
                        }`} />
                      </button>
                    </td>
                    {visibleColumns.status && (
                      <td className="px-4 py-3">
                        {isActive && getStatusBadge(idx)}
                        {!isActive && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-gray-50 text-gray-600 border border-gray-200">
                            <Phone className="w-3.5 h-3.5" />
                            Upcoming
                          </span>
                        )}
                      </td>
                    )}
                    {visibleColumns.name && (
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                        {prospect.firstName} {prospect.lastName}
                        {prospect.title && (
                          <span className="text-gray-500 dark:text-gray-400 text-xs ml-1">
                            , {prospect.title}
                          </span>
                        )}
                      </td>
                    )}
                    {visibleColumns.phone && (
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                          <span>📞 {prospect.phone}</span>
                          {prospect.phone.includes('756') || prospect.phone.includes('449') || prospect.phone.includes('473') || prospect.phone.includes('354') ? (
                            <span className="text-red-500" title="Invalid or DNC">⚠</span>
                          ) : null}
                        </div>
                      </td>
                    )}
                    {visibleColumns.links && (
                      <td className="px-4 py-3">
                        <a
                          href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${prospect.firstName} ${prospect.lastName}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          title={`Search LinkedIn for ${prospect.firstName} ${prospect.lastName}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Linkedin className="w-4 h-4" />
                        </a>
                      </td>
                    )}
                    {visibleColumns.city && (
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {prospect.timezone?.split('/')[1]?.replace('_', ' ') || 'San Diego'}
                      </td>
                    )}
                  </tr>
                  {expandedRowId === prospect.id && (
                    <tr className={idx === currentIndex && isActive ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-700/30'}>
                      <td colSpan={Object.values(visibleColumns).filter(v => v).length + 2} className="px-4 py-4">
                        {/* Show call status if this is the current calling prospect */}
                        {idx === currentIndex && isActive ? (
                          <div className="space-y-4">
                            {/* Call Status Header */}
                            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-600">
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  {callStatus === 'dialing' && (
                                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                      <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse"></div>
                                      <span className="font-medium">Dialing...</span>
                                    </div>
                                  )}
                                  {callStatus === 'ringing' && (
                                    <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                                      <Phone className="w-4 h-4 animate-bounce" />
                                      <span className="font-medium">Ringing...</span>
                                    </div>
                                  )}
                                  {callStatus === 'connected' && (
                                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                      <Phone className="w-4 h-4" />
                                      <span className="font-medium">Connected</span>
                                    </div>
                                  )}
                                  {callStatus === 'ended' && (
                                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                      <Check className="w-4 h-4" />
                                      <span className="font-medium">Call Ended</span>
                                    </div>
                                  )}
                                </div>
                                <div className="text-2xl font-mono font-bold text-gray-900 dark:text-white">
                                  {formatCallTime(callTimer)}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500 dark:text-gray-400">📞 {prospect.phone}</span>
                              </div>
                            </div>

                            {/* Quick Disposition Buttons */}
                            <div className="grid grid-cols-4 gap-3">
                              <button
                                onClick={() => handleQuickDisposition('Connected')}
                                className="px-4 py-3 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                              >
                                <Check className="w-4 h-4" />
                                Connected
                              </button>
                              <button
                                onClick={() => handleQuickDisposition('Voicemail')}
                                className="px-4 py-3 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                              >
                                <Mic className="w-4 h-4" />
                                Voicemail
                              </button>
                              <button
                                onClick={() => handleQuickDisposition('No Answer')}
                                className="px-4 py-3 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                              >
                                <Phone className="w-4 h-4" />
                                No Answer
                              </button>
                              <button
                                onClick={() => handleQuickDisposition('Busy')}
                                className="px-4 py-3 bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-400 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                              >
                                <AlertCircle className="w-4 h-4" />
                                Busy
                              </button>
                            </div>

                            {/* Prospect Details */}
                            <div className="grid grid-cols-2 gap-4 text-sm pt-3 border-t border-gray-200 dark:border-gray-600">
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Email:</span>
                                <span className="ml-2 text-gray-900 dark:text-white">{prospect.email}</span>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Company:</span>
                                <span className="ml-2 text-gray-900 dark:text-white">{prospect.company}</span>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Title:</span>
                                <span className="ml-2 text-gray-900 dark:text-white">{prospect.title}</span>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Timezone:</span>
                                <span className="ml-2 text-gray-900 dark:text-white">{prospect.timezone}</span>
                              </div>
                              {prospect.notes && (
                                <div className="col-span-2">
                                  <span className="text-gray-600 dark:text-gray-400">Notes:</span>
                                  <p className="ml-2 text-gray-900 dark:text-white">{prospect.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* Regular expanded view for non-calling rows */
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Email:</span>
                              <span className="ml-2 text-gray-900 dark:text-white">{prospect.email}</span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Company:</span>
                              <span className="ml-2 text-gray-900 dark:text-white">{prospect.company}</span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Title:</span>
                              <span className="ml-2 text-gray-900 dark:text-white">{prospect.title}</span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Timezone:</span>
                              <span className="ml-2 text-gray-900 dark:text-white">{prospect.timezone}</span>
                            </div>
                            {prospect.notes && (
                              <div className="col-span-2">
                                <span className="text-gray-600 dark:text-gray-400">Notes:</span>
                                <p className="ml-2 text-gray-900 dark:text-white">{prospect.notes}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            {queue.length === 0 && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                No prospects available. Please add prospects to begin dialing.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reassign List Modal */}
      {showReassignModal && listToReassign && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Reassign CSV</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Reassign "{listToReassign.name}" to another team member
              </p>
            </div>
            <div className="p-6">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Select Team Member
              </label>
              <select
                value={reassignUserId}
                onChange={(e) => setReassignUserId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a team member...</option>
                {/* Team members would be loaded here */}
                <option value="user-1">Team Member 1</option>
                <option value="user-2">Team Member 2</option>
              </select>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-slate-700 flex gap-3">
              <button
                onClick={() => {
                  setShowReassignModal(false);
                  setListToReassign(null);
                  setReassignUserId('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmReassignList}
                disabled={!reassignUserId}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
              >
                <RefreshCw size={16} />
                Reassign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete List Confirmation Modal */}
      {showDeleteListModal && listToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                <Trash2 size={24} className="text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
                Delete CSV
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
                Are you sure you want to delete <span className="font-semibold">"{listToDelete.name}"</span>?
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 text-center mb-6">
                This action cannot be undone. This list has <span className="font-semibold">{listToDelete.prospectCount}</span> leads.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteListModal(false);
                    setListToDelete(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteList}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} />
                  Delete CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PowerDialerOrum;
