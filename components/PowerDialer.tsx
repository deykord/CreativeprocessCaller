import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Prospect, CallEndReason, TwilioCallStatus, LeadList, User as UserType, CallState } from '../types';
import { 
  Play, Pause, Phone, User as UserIcon, Users, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft,
  Mic, MicOff, Volume2, Settings, Linkedin, AlertCircle, Check, PhoneOff, X, History,
  PhoneMissed, PhoneIncoming, PhoneOutgoing, Voicemail, UserX, Clock, Plus,
  Upload, Trash2, RefreshCw, CheckCircle, MoreVertical, Ban, PhoneForwarded,
  FileText, ArrowLeft, ArrowRight, Loader2, AlertTriangle, Share2, Zap, TrendingUp
} from 'lucide-react';
import { backendAPI } from '../services/BackendAPI';
import { voiceService, UnifiedCallStateInfo } from '../services/VoiceService';
import { standardizePhoneNumber } from '../utils/phoneUtils';
import ActivityLog from './ActivityLog';
import PhoneCallHistory from './PhoneCallHistory';
import { LeadListManager } from './LeadListManager';

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
  openImportModal?: boolean;
  onImportModalClose?: () => void;
  currentUser?: UserType | null;
}

const PowerDialer: React.FC<Props> = ({
  queue,
  onCall,
  disabled = false,
  dispositionSaved,
  setDispositionSaved,
  onDeleteProspect,
  onUpdateProspect,
  powerDialerPaused,
  setPowerDialerPaused,
  openImportModal = false,
  onImportModalClose,
  currentUser
}) => {
  // Session States
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [callDispositions, setCallDispositions] = useState<Record<string, string>>({});
  const [stableQueue, setStableQueue] = useState<Prospect[]>([]);
  const [callTimer, setCallTimer] = useState(0);
  const [callStatus, setCallStatus] = useState<'idle' | 'dialing' | 'queued' | 'ringing' | 'in-progress' | 'connected' | 'completed' | 'busy' | 'no-answer' | 'failed' | 'canceled' | 'ended'>('idle');
  
  // Microphone Permission States
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [showAudioDropdown, setShowAudioDropdown] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [speakerLevel, setSpeakerLevel] = useState(0);
  const [isTesting, setIsTesting] = useState(false);
  const [testAudio, setTestAudio] = useState<HTMLAudioElement | null>(null);
  const audioDropdownRef = useRef<HTMLDivElement>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micAnimationRef = useRef<number | null>(null);
  
  // Real-time Twilio call tracking
  const [currentCallSid, setCurrentCallSid] = useState<string | null>(null);
  const [callEndReason, setCallEndReason] = useState<CallEndReason | null>(null);
  const [twilioCallStatus, setTwilioCallStatus] = useState<TwilioCallStatus | null>(null);
  const callStatusPollRef = useRef<NodeJS.Timeout | null>(null);
  
  // Stuck call detection
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [isCallStuck, setIsCallStuck] = useState(false);
  const STUCK_CALL_THRESHOLD = 60000; // 60 seconds without progress = stuck
  
  // UI States
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('default');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    status: true,
    name: true,
    phone: true,
    links: true,
    city: true
  });
  
  // Phone Call History Modal
  const [phoneHistoryModal, setPhoneHistoryModal] = useState<{
    isOpen: boolean;
    prospectId: string;
    prospectName: string;
    phoneNumber: string;
  }>({ isOpen: false, prospectId: '', prospectName: '', phoneNumber: '' });
  
  // Log Call States - Orum-style dispositions
  // Contacted: Conversation happened
  // Orum-style Call Dispositions
  type DispositionType = 
    // Not Contacted - No Conversation
    | 'No Answer'
    | 'Left Voicemail'
    | 'Went to Voicemail'
    | 'Busy Signal'
    | 'Bad Number'
    | 'False Positive'
    // Contacted - Gatekeeper
    | 'Gatekeeper: Did not Transfer'
    | 'Gatekeeper transferred: Did not leave VM'
    | 'Gatekeeper transferred: Left VM'
    // Contacted - Negative/Rejection
    | 'Hang Up'
    | 'Hook Rejected'
    | 'Elevator Pitch Rejected'
    // Contacted - Objections
    | 'Objection: Already Have a Solution'
    | 'Objection: Asked to Send Info'
    | 'Objection: Not a Priority'
    | 'Objection: Other'
    // Contacted - Wrong Person
    | 'Wrong Person: Gave Referral'
    | 'Wrong Person: No referral'
    | 'Person Left Company'
    // Contacted - Follow Up
    | 'Follow-Up Required'
    | 'Busy: Call Later'
    | 'Reach back out in X time'
    // Contacted - Positive Outcome
    | 'Meeting Scheduled';
  const [selectedDisposition, setSelectedDisposition] = useState<DispositionType>('No Answer');
  const [callNote, setCallNote] = useState('');
  
  // Dialer Options
  const [parallelDials, setParallelDials] = useState(1);
  const [callFromNumber, setCallFromNumber] = useState('');
  const [twilioNumbers, setTwilioNumbers] = useState<Array<{sid: string; phoneNumber: string; friendlyName?: string}>>([]);
  const [audioDevices, setAudioDevices] = useState<{
    microphones: MediaDeviceInfo[];
    speakers: MediaDeviceInfo[];
  }>({ microphones: [], speakers: [] });
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('');
  const [micMuted, setMicMuted] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Voicemail states
  const [voicemails, setVoicemails] = useState<Array<{
    id: string;
    name: string;
    duration: number;
    isDefault: boolean;
    audioData: string;
    usageCount: number;
  }>>([]);
  const [selectedVoicemailId, setSelectedVoicemailId] = useState<string>('');
  
  // Lead List States
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [leadLists, setLeadLists] = useState<LeadList[]>([]);
  const [listProspects, setListProspects] = useState<Prospect[]>([]); // Prospects fetched for the selected list
  const [isLoadingProspects, setIsLoadingProspects] = useState(false);
  const [showListDropdown, setShowListDropdown] = useState(false);
  const [hoveredListId, setHoveredListId] = useState<string | null>(null);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [listToReassign, setListToReassign] = useState<LeadList | null>(null);
  const [reassignUserId, setReassignUserId] = useState('');
  const [showDeleteListModal, setShowDeleteListModal] = useState(false);
  const [listToDelete, setListToDelete] = useState<LeadList | null>(null);
  const [listSearchQuery, setListSearchQuery] = useState('');
  const listDropdownRef = useRef<HTMLDivElement>(null);
  
  // Track prospects called today (from database)
  const [calledTodayIds, setCalledTodayIds] = useState<Set<string>>(new Set());
  // Track last disposition for each prospect from database
  const [prospectDispositions, setProspectDispositions] = useState<Record<string, string>>({});
  const listSearchInputRef = useRef<HTMLInputElement>(null);
  
  // Sharing state (for admins)
  const [showShareModal, setShowShareModal] = useState(false);
  const [listToShare, setListToShare] = useState<LeadList | null>(null);
  const [teamMembers, setTeamMembers] = useState<UserType[]>([]);
  const [selectedShareUsers, setSelectedShareUsers] = useState<string[]>([]);
  const [listShares, setListShares] = useState<Array<{userId: string; user: {firstName: string; lastName: string; email: string}}>>([]);
  const [isLoadingShares, setIsLoadingShares] = useState(false);
  
  // Check if current user is admin
  const isAdmin = currentUser?.role === 'admin';

  // CSV Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [importListName, setImportListName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
  const [mappingErrors, setMappingErrors] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<Partial<Prospect>[]>([]);
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle');
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; failed: number; errors: string[] }>({ success: 0, failed: 0, errors: [] });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Define prospect fields that can be mapped (same as LeadListManager)
  const PROSPECT_FIELDS = [
    { key: 'firstName', label: 'First Name', required: false },
    { key: 'lastName', label: 'Last Name', required: false },
    { key: 'phone', label: 'Phone', required: true },
    { key: 'email', label: 'Email', required: false },
    { key: 'company', label: 'Company', required: false },
    { key: 'title', label: 'Title', required: false },
    { key: 'timezone', label: 'Timezone', required: false },
    { key: 'notes', label: 'Notes', required: false },
  ] as const;
  
  // Flag to prevent status polling from overwriting manual disconnect
  const isManuallyDisconnectedRef = useRef(false);

  const isAdvancingRef = React.useRef(false);
  const isCallingRef = React.useRef(false);
  const stableQueueRef = React.useRef<Prospect[]>([]);
  const currentIndexRef = React.useRef(0);

  const effectivePaused = isPaused || Boolean(powerDialerPaused);
  
  // Get selected lead list for filtering
  const selectedLeadList = selectedList ? leadLists.find(l => l.id === selectedList) : null;
  
  // Apply filtering - use fetched listProspects when a list is selected
  let filteredQueue: Prospect[] = [];
  
  if (isActive) {
    // During active session, use stableQueue (snapshot of the list when session started)
    filteredQueue = stableQueue;
  } else if (selectedList && listProspects.length > 0) {
    // When a list is selected, use the fetched prospects for that list
    filteredQueue = listProspects;
  }
  // else: no list selected and not active = empty queue (filteredQueue = [])
  
  // Filter by status
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
    
    // Listen for new imports from LeadListManager
    const handleLeadListImported = async () => {
      // Reload lists when a new one is imported
      await loadLeadLists();
    };
    
    window.addEventListener('leadListImported', handleLeadListImported);
    
    return () => {
      window.removeEventListener('leadListImported', handleLeadListImported);
    };
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

  // Call timer effect - only count when connected
  useEffect(() => {
    if (!isActive || isPaused || !['in-progress', 'connected'].includes(callStatus)) return;
    
    const timer = setInterval(() => {
      setCallTimer(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isActive, isPaused, callStatus]);

  // Real-time call status polling from Twilio
  const pollCallStatus = useCallback(async () => {
    if (!currentCallSid) return;
    
    // Don't poll if manually disconnected - user is in disposition selection
    if (isManuallyDisconnectedRef.current) return;
    
    try {
      const status = await backendAPI.getCallStatus(currentCallSid);
      setTwilioCallStatus(status);
      
      // Map Twilio status to our call status
      const statusMap: Record<string, typeof callStatus> = {
        'queued': 'queued',
        'ringing': 'ringing',
        'in-progress': 'in-progress',
        'completed': 'completed',
        'busy': 'busy',
        'no-answer': 'no-answer',
        'failed': 'failed',
        'canceled': 'canceled'
      };
      
      const newStatus = statusMap[status.status] || callStatus;
      setCallStatus(newStatus);
      
      // If call ended, set end reason and stop polling
      if (['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(status.status)) {
        setCallEndReason(status.endReason || null);
        stopCallStatusPolling();
        
        // Auto-set disposition based on end reason
        if (status.endReason) {
          const reasonToDisposition: Record<string, DispositionType> = {
            'customer_hangup': 'Hang Up',
            'agent_hangup': 'Follow-Up Required',
            'voicemail': 'Went to Voicemail',
            'machine_detected': 'Went to Voicemail',
            'no_answer': 'No Answer',
            'busy': 'Busy Signal',
            'call_rejected': 'No Answer',
            'invalid_number': 'Bad Number',
          };
          const autoDisp = reasonToDisposition[status.endReason];
          if (autoDisp) setSelectedDisposition(autoDisp);
        }
      }
    } catch (error) {
      console.error('Failed to fetch call status:', error);
    }
  }, [currentCallSid, callStatus]);

  const startCallStatusPolling = useCallback((callSid: string) => {
    setCurrentCallSid(callSid);
    setCallEndReason(null);
    
    // Poll every 1 second for real-time updates
    callStatusPollRef.current = setInterval(() => {
      pollCallStatus();
    }, 1000);
    
    // Also poll immediately
    pollCallStatus();
  }, [pollCallStatus]);

  const stopCallStatusPolling = useCallback(() => {
    if (callStatusPollRef.current) {
      clearInterval(callStatusPollRef.current);
      callStatusPollRef.current = null;
    }
  }, []);

  // Stuck call detection - check if call has been in dialing/ringing/in-progress for too long
  useEffect(() => {
    if (!isActive || isPaused) {
      setCallStartedAt(null);
      setIsCallStuck(false);
      return;
    }
    
    // Track when call started
    if (['dialing', 'ringing', 'in-progress', 'connected'].includes(callStatus) && !callStartedAt) {
      setCallStartedAt(Date.now());
    }
    
    // Reset when call ends
    if (['ended', 'completed', 'idle'].includes(callStatus)) {
      setCallStartedAt(null);
      setIsCallStuck(false);
    }
  }, [isActive, isPaused, callStatus, callStartedAt]);

  // Check for stuck calls every 5 seconds
  useEffect(() => {
    if (!callStartedAt || !isActive || isPaused) return;
    
    const checkStuck = setInterval(() => {
      const elapsed = Date.now() - callStartedAt;
      // Only mark as stuck if we're still in a calling state and timer hasn't progressed much
      if (elapsed > STUCK_CALL_THRESHOLD && ['dialing', 'ringing', 'in-progress', 'connected'].includes(callStatus)) {
        // If in-progress/connected but timer is still 0-2 seconds, likely stuck
        if (['in-progress', 'connected'].includes(callStatus) && callTimer < 3) {
          setIsCallStuck(true);
        } else if (['dialing', 'ringing'].includes(callStatus)) {
          setIsCallStuck(true);
        }
      }
    }, 5000);
    
    return () => clearInterval(checkStuck);
  }, [callStartedAt, isActive, isPaused, callStatus, callTimer]);

  // Skip stuck call - force end and move to next
  const handleSkipStuckCall = useCallback(async () => {
    console.log('Skipping stuck call');
    
    // Stop polling
    stopCallStatusPolling();
    
    // Try to disconnect
    try {
      voiceService.disconnect();
    } catch (e) {
      console.warn('Error disconnecting:', e);
    }
    
    // End via API if we have a callSid
    if (currentCallSid) {
      try {
        await backendAPI.endCall(currentCallSid);
      } catch (e) {
        console.warn('Error ending call via API:', e);
      }
    }
    
    // Reset states
    setCallStatus('ended');
    setIsCallStuck(false);
    setCallStartedAt(null);
    setCallTimer(0);
    setCurrentCallSid(null);
    setCallEndReason(CallEndReason.FAILED);
    
    // Auto-disposition as failed/no answer
    const currentProspect = activeQueue[currentIndex];
    if (currentProspect) {
      setCallDispositions(prev => ({ ...prev, [currentProspect.id]: 'No Answer' }));
      
      // Log the failed call
      try {
        await backendAPI.logCall({
          prospectName: `${currentProspect.firstName} ${currentProspect.lastName}`,
          phoneNumber: currentProspect.phone,
          duration: 0,
          outcome: 'No Answer',
          note: 'Call skipped - connection issue',
          fromNumber: callFromNumber,
          timestamp: new Date().toISOString(),
          prospectId: currentProspect.id,
          endReason: CallEndReason.FAILED,
          callSid: currentCallSid || undefined,
          direction: 'outbound'
        });
      } catch (e) {
        console.error('Failed to log skipped call:', e);
      }
      
      // Advance to next
      if (setDispositionSaved) {
        setDispositionSaved(true);
      }
    }
  }, [currentCallSid, activeQueue, currentIndex, callFromNumber, stopCallStatusPolling, setDispositionSaved]);

  const handleQuickDisposition = async (disp: DispositionType) => {
    const currentProspect = activeQueue[currentIndex];
    if (!currentProspect) return;

    setCallDispositions(prev => ({ ...prev, [currentProspect.id]: disp }));
    setCallStatus('ended');
    
    // Reset stuck call state
    setIsCallStuck(false);
    setCallStartedAt(null);
    
    // Mark as called today immediately (real-time update)
    setCalledTodayIds(prev => new Set([...prev, currentProspect.id]));
    
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
        prospectId: currentProspect.id,
        endReason: callEndReason || undefined,
        callSid: currentCallSid || undefined,
        direction: 'outbound'
      });
      
      // Update prospect status to Contacted
      await backendAPI.updateProspect(currentProspect.id, { status: 'Contacted' });
    } catch (error) {
      console.error('Failed to log call:', error);
    }

    // Advance to next after short delay
    setTimeout(() => {
      advanceToNextLead();
    }, 500);
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopCallStatusPolling();
    };
  }, [stopCallStatusPolling]);

  // Get CallSid from voiceService when call starts (for logging purposes only)
  useEffect(() => {
    if (!isActive || isPaused) return;
    if (callStatus === 'idle' || callStatus === 'ended') return;
    if (currentCallSid) return; // Already have it
    
    // Poll every 500ms to check if CallSid is available
    const pollForCallSid = setInterval(() => {
      const callSid = voiceService.getCurrentCallSid();
      if (callSid && callSid !== currentCallSid) {
        console.log('Got CallSid from VoiceService:', callSid);
        setCurrentCallSid(callSid);
        clearInterval(pollForCallSid);
      }
    }, 500);
    
    // Also check immediately
    const callSid = voiceService.getCurrentCallSid();
    if (callSid) {
      console.log('Got CallSid immediately:', callSid);
      setCurrentCallSid(callSid);
      clearInterval(pollForCallSid);
    }
    
    // Stop polling after 30 seconds
    const timeout = setTimeout(() => {
      clearInterval(pollForCallSid);
    }, 30000);
    
    return () => {
      clearInterval(pollForCallSid);
      clearTimeout(timeout);
    };
  }, [isActive, isPaused, callStatus, currentCallSid]);

  // Register for real-time WebRTC call status updates from voice service
  useEffect(() => {
    // Map CallState enum to our local callStatus string format
    const mapCallStateToStatus = (state: CallState): typeof callStatus => {
      const stateMap: Record<CallState, typeof callStatus> = {
        [CallState.IDLE]: 'idle',
        [CallState.DIALING]: 'dialing',
        [CallState.QUEUED]: 'queued',
        [CallState.RINGING]: 'ringing',
        [CallState.IN_PROGRESS]: 'in-progress',
        [CallState.CONNECTED]: 'connected',
        [CallState.COMPLETED]: 'completed',
        [CallState.BUSY]: 'busy',
        [CallState.NO_ANSWER]: 'no-answer',
        [CallState.FAILED]: 'failed',
        [CallState.CANCELED]: 'canceled',
        [CallState.WRAP_UP]: 'ended',
      };
      return stateMap[state] || 'idle';
    };

    // Register callback for real call state updates from Telnyx/Twilio WebRTC
    voiceService.registerStatusCallback((stateInfo: UnifiedCallStateInfo) => {
      console.log('PowerDialer received real call status:', stateInfo.state);
      const newStatus = mapCallStateToStatus(stateInfo.state);
      setCallStatus(newStatus);
      
      // Handle call end reason if present
      if (stateInfo.endReason) {
        setCallEndReason(stateInfo.endReason);
      }
    });
  }, []);

  const formatCallTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get human-readable call end reason
  const getEndReasonDisplay = (reason: CallEndReason | null): { text: string; icon: React.ReactNode; color: string } => {
    if (!reason) return { text: '', icon: null, color: '' };
    
    const reasons: Record<CallEndReason, { text: string; icon: React.ReactNode; color: string }> = {
      [CallEndReason.CUSTOMER_HANGUP]: { 
        text: 'Customer hung up', 
        icon: <PhoneMissed className="w-4 h-4" />,
        color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30'
      },
      [CallEndReason.AGENT_HANGUP]: { 
        text: 'You ended the call', 
        icon: <PhoneOff className="w-4 h-4" />,
        color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30'
      },
      [CallEndReason.VOICEMAIL]: { 
        text: 'Went to voicemail', 
        icon: <Voicemail className="w-4 h-4" />,
        color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30'
      },
      [CallEndReason.NO_ANSWER]: { 
        text: 'No answer', 
        icon: <Clock className="w-4 h-4" />,
        color: 'text-gray-600 bg-gray-100 dark:bg-gray-700'
      },
      [CallEndReason.BUSY]: { 
        text: 'Line busy', 
        icon: <Phone className="w-4 h-4" />,
        color: 'text-red-600 bg-red-100 dark:bg-red-900/30'
      },
      [CallEndReason.FAILED]: { 
        text: 'Call failed', 
        icon: <AlertCircle className="w-4 h-4" />,
        color: 'text-red-600 bg-red-100 dark:bg-red-900/30'
      },
      [CallEndReason.CANCELED]: { 
        text: 'Call canceled', 
        icon: <X className="w-4 h-4" />,
        color: 'text-gray-600 bg-gray-100 dark:bg-gray-700'
      },
      [CallEndReason.MACHINE_DETECTED]: { 
        text: 'Answering machine', 
        icon: <Voicemail className="w-4 h-4" />,
        color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30'
      },
      [CallEndReason.CALL_REJECTED]: { 
        text: 'Call rejected', 
        icon: <UserX className="w-4 h-4" />,
        color: 'text-red-600 bg-red-100 dark:bg-red-900/30'
      },
      [CallEndReason.INVALID_NUMBER]: { 
        text: 'Invalid number', 
        icon: <AlertCircle className="w-4 h-4" />,
        color: 'text-red-600 bg-red-100 dark:bg-red-900/30'
      },
      [CallEndReason.NETWORK_ERROR]: { 
        text: 'Network error', 
        icon: <AlertCircle className="w-4 h-4" />,
        color: 'text-red-600 bg-red-100 dark:bg-red-900/30'
      },
      [CallEndReason.TIMEOUT]: { 
        text: 'Call timed out', 
        icon: <Clock className="w-4 h-4" />,
        color: 'text-gray-600 bg-gray-100 dark:bg-gray-700'
      },
      [CallEndReason.UNKNOWN]: { 
        text: 'Call ended', 
        icon: <PhoneOff className="w-4 h-4" />,
        color: 'text-gray-600 bg-gray-100 dark:bg-gray-700'
      },
    };
    
    return reasons[reason] || { text: 'Call ended', icon: <PhoneOff className="w-4 h-4" />, color: 'text-gray-600 bg-gray-100' };
  };

  // Get call status display info
  const getCallStatusDisplay = () => {
    const isCallEnded = ['completed', 'busy', 'no-answer', 'failed', 'canceled', 'ended'].includes(callStatus);
    
    if (isCallEnded && callEndReason) {
      const endInfo = getEndReasonDisplay(callEndReason);
      return {
        text: endInfo.text,
        icon: endInfo.icon,
        className: endInfo.color,
        showTimer: callTimer > 0
      };
    }
    
    switch (callStatus) {
      case 'idle':
        return { text: 'Ready', icon: <Phone className="w-3 h-3" />, className: 'bg-gray-100 text-gray-700', showTimer: false };
      case 'dialing':
      case 'queued':
        return { text: 'Dialing...', icon: <PhoneOutgoing className="w-3 h-3 animate-pulse" />, className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400', showTimer: false };
      case 'ringing':
        return { text: 'Ringing...', icon: <PhoneIncoming className="w-3 h-3 animate-bounce" />, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400', showTimer: false };
      case 'in-progress':
      case 'connected':
        return { text: `Connected: ${formatCallTime(callTimer)}`, icon: <Phone className="w-3 h-3" />, className: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400', showTimer: true };
      case 'ended':
      case 'completed':
        return { text: 'Call Ended', icon: <PhoneOff className="w-3 h-3" />, className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', showTimer: callTimer > 0 };
      default:
        return { text: callStatus, icon: <Phone className="w-3 h-3" />, className: 'bg-gray-100 text-gray-700', showTimer: false };
    }
  };

  // Log Call - just log without advancing
  const handleLogCall = async () => {
    if (!currentProspect) return;

    setCallDispositions(prev => ({ ...prev, [currentProspect.id]: selectedDisposition }));
    
    try {
      await backendAPI.logCall({
        prospectName: `${currentProspect.firstName} ${currentProspect.lastName}`,
        phoneNumber: currentProspect.phone,
        duration: callTimer,
        outcome: selectedDisposition,
        note: callNote,
        fromNumber: callFromNumber,
        timestamp: new Date().toISOString(),
        prospectId: currentProspect.id,
        endReason: callEndReason || undefined,
        callSid: currentCallSid || undefined,
        direction: 'outbound'
      });
      
      // Update prospect status to Contacted
      await backendAPI.updateProspect(currentProspect.id, { status: 'Contacted' });
    } catch (error) {
      console.error('Failed to log call:', error);
    }

    // Reset call tracking state after logging
    setCurrentCallSid(null);
    setCallEndReason(null);
    setTwilioCallStatus(null);
    setCallNote('');
    setCallStatus('idle');
    setCallTimer(0);
    isManuallyDisconnectedRef.current = false;
    stopCallStatusPolling();
  };

  // Log & Dial Next
  const handleLogAndDialNext = async () => {
    await handleLogCall();
    
    setTimeout(() => {
      advanceToNextLead();
    }, 300);
  };

  // Disconnect current call - ends the call but lets user select disposition
  const handleDisconnect = async () => {
    if (!currentProspect) return;
    
    // Mark as manually disconnected to prevent polling from overwriting status
    isManuallyDisconnectedRef.current = true;
    
    // Stop polling FIRST before any async operations
    stopCallStatusPolling();
    
    // Set status to ended immediately - this stops the timer
    setCallStatus('ended');
    
    // IMPORTANT: Disconnect the local Voice Service Device/Call
    // This sends the hangup signal and terminates the WebRTC connection
    voiceService.disconnect();
    
    // Also end it via API to ensure Twilio server-side is updated
    if (currentCallSid) {
      try {
        const result = await backendAPI.endCall(currentCallSid);
        setCallEndReason(result.endReason as CallEndReason);
        console.log('Call ended via API:', result);
      } catch (error) {
        console.error('Failed to end call via API:', error);
        // Still set a default end reason
        setCallEndReason(CallEndReason.AGENT_HANGUP);
      }
    } else {
      setCallEndReason(CallEndReason.AGENT_HANGUP);
    }
    
    // DON'T log the call here - let the user select disposition first
    // DON'T reset call tracking state - keep it for logging
  };

  useEffect(() => {
    const loadTelnyxNumbers = async () => {
      try {
        // Try to load Telnyx numbers first
        const telnyxNumbers = await backendAPI.getTelnyxNumbers();
        if (telnyxNumbers && telnyxNumbers.length > 0) {
          setTwilioNumbers(telnyxNumbers);
          if (!callFromNumber) {
            setCallFromNumber(telnyxNumbers[0].phoneNumber);
          }
          return;
        }
        
        // Fallback to Twilio numbers if Telnyx not available
        const twilioNumbers = await backendAPI.getTwilioNumbers();
        setTwilioNumbers(twilioNumbers);
        if (twilioNumbers.length > 0 && !callFromNumber) {
          setCallFromNumber(twilioNumbers[0].phoneNumber);
        }
      } catch (error) {
        console.error('Failed to load phone numbers:', error);
      }
    };
    loadTelnyxNumbers();
  }, []);
  
  // Load voicemails
  useEffect(() => {
    const loadVoicemails = async () => {
      try {
        const vms = await backendAPI.getVoicemails();
        setVoicemails(vms);
        // Auto-select default voicemail
        const defaultVm = vms.find(v => v.isDefault);
        if (defaultVm) {
          setSelectedVoicemailId(defaultVm.id);
        }
      } catch (error) {
        console.error('Failed to load voicemails:', error);
      }
    };
    loadVoicemails();
  }, []);

  // Fetch prospects for a specific lead list and load today's call history
  const fetchListProspects = async (listId: string) => {
    setIsLoadingProspects(true);
    try {
      // Get all prospects from API
      const allProspects = await backendAPI.getProspects();
      
      // Find the list to get its prospect IDs
      const list = leadLists.find(l => l.id === listId);
      if (!list || !list.prospectIds || list.prospectIds.length === 0) {
        setListProspects([]);
        setCalledTodayIds(new Set());
        return;
      }
      
      // Filter to only prospects in this list
      const listProspectsFiltered = allProspects.filter(p => 
        list.prospectIds.includes(p.id)
      );
      
      // Fetch call logs to mark already-called prospects and get last dispositions
      try {
        const callHistory = await backendAPI.getCallHistory();
        const today = new Date().toDateString();
        const calledToday = new Set<string>();
        const dispositions: Record<string, string> = {};
        
        // Sort by timestamp desc to get most recent first
        const sortedHistory = [...callHistory].sort((a: any, b: any) => {
          const dateA = new Date(a.timestamp || a.startedAt || a.created_at).getTime();
          const dateB = new Date(b.timestamp || b.startedAt || b.created_at).getTime();
          return dateB - dateA;
        });
        
        sortedHistory.forEach((log: any) => {
          const logDate = new Date(log.timestamp || log.startedAt || log.created_at).toDateString();
          if (logDate === today && log.prospectId) {
            calledToday.add(log.prospectId);
          }
          // Store the most recent disposition for each prospect (first encounter since sorted desc)
          if (log.prospectId && !dispositions[log.prospectId]) {
            dispositions[log.prospectId] = log.outcome || log.disposition || '';
          }
        });
        
        setCalledTodayIds(calledToday);
        setProspectDispositions(dispositions);
        // Also mark them as completed in the session
        setCompletedIds(Array.from(calledToday).filter(id => list.prospectIds.includes(id)));
      } catch (err) {
        console.error('Failed to fetch call history:', err);
      }
      
      setListProspects(listProspectsFiltered);
    } catch (error) {
      console.error('Failed to fetch list prospects:', error);
      setListProspects([]);
    } finally {
      setIsLoadingProspects(false);
    }
  };

  // Redial the current prospect
  const handleRedial = () => {
    const currentProspect = activeQueue[currentIndex];
    if (!currentProspect) return;
    
    // Reset call state for redial
    setCallTimer(0);
    setCallStatus('dialing');
    setCallEndReason(null);
    setTwilioCallStatus(null);
    setCurrentCallSid(null);
    
    // Make the call
    onCall(currentProspect);
  };

  // Lead List Action Handlers
  const handleUseList = async (list: LeadList) => {
    setSelectedList(list.id);
    setShowListDropdown(false);
    setHoveredListId(null);
    setListSearchQuery('');
    
    // Reset the dialer state when changing lists
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    setCompletedIds([]);
    setCallDispositions({});
    setCallTimer(0);
    setCallStatus('idle');
    setExpandedRowId(null);
    
    // Stop any active call polling
    stopCallStatusPolling();
    setCurrentCallSid(null);
    setCallEndReason(null);
    setTwilioCallStatus(null);

    // Fetch prospects for this list
    await fetchListProspects(list.id);
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
        setSelectedList(null);
        setListProspects([]); // Clear prospects when list is deleted
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

  // --- Share List Functions (Admin only) ---
  const handleShareList = async (list: LeadList) => {
    setListToShare(list);
    setShowShareModal(true);
    setShowListDropdown(false);
    setHoveredListId(null);
    setSelectedShareUsers([]);
    
    // Load team members and current shares
    setIsLoadingShares(true);
    try {
      const [members, shares] = await Promise.all([
        backendAPI.getTeamMembers(),
        backendAPI.getLeadListPermissions(list.id)
      ]);
      // Filter out current user and list creator
      const filteredMembers = members.filter((m: UserType) => 
        m.id !== currentUser?.id && m.id !== list.createdBy
      );
      setTeamMembers(filteredMembers);
      setListShares(shares);
      // Pre-select already shared users
      setSelectedShareUsers(shares.map((s: any) => s.userId));
    } catch (err) {
      console.error('Failed to load share data:', err);
    } finally {
      setIsLoadingShares(false);
    }
  };

  const toggleShareUser = (userId: string) => {
    setSelectedShareUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const confirmShareList = async () => {
    if (!listToShare) return;
    
    try {
      // Get current shares
      const currentSharedIds = listShares.map(s => s.userId);
      
      // Add new shares
      const toAdd = selectedShareUsers.filter(id => !currentSharedIds.includes(id));
      // Remove old shares
      const toRemove = currentSharedIds.filter(id => !selectedShareUsers.includes(id));
      
      // Process additions
      for (const userId of toAdd) {
        await backendAPI.addLeadListPermission(listToShare.id, userId, true, false);
      }
      
      // Process removals
      for (const userId of toRemove) {
        await backendAPI.removeLeadListPermission(listToShare.id, userId);
      }
      
      setShowShareModal(false);
      setListToShare(null);
      setSelectedShareUsers([]);
    } catch (err) {
      console.error('Failed to share list:', err);
    }
  };

  const getSelectedListName = () => {
    if (!selectedList) return 'Select a list...';
    const list = leadLists.find(l => l.id === selectedList);
    return list?.name || 'Select a list...';
  };

  // Filter lead lists based on search query
  const filteredLeadLists = leadLists.filter(list => 
    list && list.name && typeof list.name === 'string' && 
    list.name.toLowerCase().includes(listSearchQuery.toLowerCase())
  );

  // Handle clearing the list selection
  const handleClearListSelection = () => {
    setSelectedList(null);
    setListSearchQuery('');
    setListProspects([]); // Clear prospects when deselecting list
    setCurrentIndex(0);
    currentIndexRef.current = 0;
  };

  // CSV Import Functions
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        alert('Please select a CSV file');
        return;
      }
      setSelectedFile(file);
      parseCSV(file);
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length === 0) {
          alert('CSV file is empty');
          return;
        }

        const headers = parseCSVLine(lines[0]);
        const maxRows = Math.min(lines.length - 1, 10000);
        const data: string[][] = [];
        
        for (let i = 1; i <= maxRows; i++) {
          const values = parseCSVLine(lines[i]);
          if (values.length > 0) {
            data.push(values);
          }
        }
        
        setCsvHeaders(headers);
        setCsvData(data);
      } catch (err) {
        console.error('CSV parse error:', err);
        alert('Failed to parse CSV file. Please check the file format.');
      }
    };
    reader.readAsText(file);
  };

  const parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
    }
    
    values.push(current.trim());
    return values;
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        alert('Please drop a CSV file');
        return;
      }
      setSelectedFile(file);
      parseCSV(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const resetImportModal = () => {
    setShowImportModal(false);
    setImportStep(1);
    setImportListName('');
    setSelectedFile(null);
    setCsvData([]);
    setCsvHeaders([]);
    setIsUploading(false);
    setFieldMappings({});
    setMappingErrors([]);
    setPreviewData([]);
    setImportProgress(0);
    setImportStatus('idle');
    setImportResults({ success: 0, failed: 0, errors: [] });
  };

  const autoDetectMappings = () => {
    const mappings: Record<string, string> = {};
    const headerLower = csvHeaders.map(h => h.toLowerCase().replace(/[_\s-]/g, ''));
    
    PROSPECT_FIELDS.forEach(field => {
      const fieldLower = field.key.toLowerCase();
      const fieldLabel = field.label.toLowerCase().replace(/\s/g, '');
      
      const matchIndex = headerLower.findIndex(h => 
        h === fieldLower || 
        h === fieldLabel ||
        h.includes(fieldLower) ||
        fieldLower.includes(h) ||
        (fieldLower === 'firstname' && (h === 'first' || h === 'fname')) ||
        (fieldLower === 'lastname' && (h === 'last' || h === 'lname')) ||
        (fieldLower === 'phone' && (h.includes('phone') || h.includes('mobile') || h.includes('cell'))) ||
        (fieldLower === 'email' && h.includes('email')) ||
        (fieldLower === 'company' && (h.includes('company') || h.includes('organization') || h.includes('org'))) ||
        (fieldLower === 'title' && (h.includes('title') || h.includes('position') || h.includes('jobtitle')))
      );
      
      if (matchIndex !== -1) {
        mappings[csvHeaders[matchIndex]] = field.key;
      }
    });
    
    setFieldMappings(mappings);
  };

  const validateMappings = (): boolean => {
    const errors: string[] = [];
    const mappedFields = Object.values(fieldMappings);
    
    PROSPECT_FIELDS.filter(f => f.required).forEach(field => {
      if (!mappedFields.includes(field.key)) {
        errors.push(`Required field "${field.label}" is not mapped`);
      }
    });
    
    const duplicates = mappedFields.filter((item, index) => mappedFields.indexOf(item) !== index && item !== '');
    if (duplicates.length > 0) {
      errors.push(`Duplicate mappings found: ${[...new Set(duplicates)].join(', ')}`);
    }
    
    setMappingErrors(errors);
    return errors.length === 0;
  };

  const handleImportNext = () => {
    if (importStep === 1) {
      if (!importListName.trim()) {
        alert('Please enter a list name');
        return;
      }
      if (!selectedFile) {
        alert('Please select a CSV file');
        return;
      }
      autoDetectMappings();
      setImportStep(2);
    } else if (importStep === 2) {
      if (!validateMappings()) {
        return;
      }
      const preview: Partial<Prospect>[] = [];
      
      csvData.forEach((row, index) => {
        const prospect: Partial<Prospect> = {
          id: `preview-${index}`,
          status: 'New',
          timezone: 'America/Los_Angeles',
        };
        
        Object.entries(fieldMappings).forEach(([csvHeader, prospectField]) => {
          const headerIndex = csvHeaders.indexOf(csvHeader);
          if (headerIndex !== -1 && row[headerIndex]) {
            (prospect as any)[prospectField] = row[headerIndex];
          }
        });
        
        preview.push(prospect);
      });
      
      setPreviewData(preview);
      setImportStep(3);
    }
  };

  const handleImportBack = () => {
    if (importStep === 2) {
      setImportStep(1);
    } else if (importStep === 3) {
      setImportStep(2);
    }
  };

  const handleImport = async () => {
    setImportStatus('importing');
    setImportProgress(0);
    
    const results = { 
      success: 0, 
      failed: 0,
      skipped: 0,
      errors: [] as string[] 
    };
    const prospectIds: string[] = [];
    
    try {
      // Create the lead list first
      const newList = await backendAPI.createLeadList({
        name: importListName,
        description: `Imported CSV - ${new Date().toLocaleDateString()}`,
      });

      // Get existing prospects to find duplicates by phone
      let existingProspects: Prospect[] = [];
      try {
        existingProspects = await backendAPI.getProspects();
      } catch (err) {
        console.warn('Could not fetch existing prospects:', err);
      }

      // Create a map of phone numbers to existing prospect IDs
      const phoneToProspectId = new Map<string, string>();
      existingProspects.forEach(p => {
        if (p.phone) {
          // Normalize phone number (remove non-digits)
          const normalizedPhone = p.phone.replace(/\D/g, '');
          phoneToProspectId.set(normalizedPhone, p.id);
        }
      });

      // Import prospects one by one
      for (let i = 0; i < previewData.length; i++) {
        try {
          const prospect = previewData[i];
          
          // Validate required fields
          if (!prospect.firstName || !prospect.lastName || !prospect.phone) {
            results.failed++;
            results.errors.push(`Row ${i + 1}: Missing required fields`);
            setImportProgress(((i + 1) / previewData.length) * 100);
            continue;
          }

          // Check if prospect already exists by phone
          const normalizedPhone = prospect.phone.replace(/\D/g, '');
          const existingId = phoneToProspectId.get(normalizedPhone);
          
          if (existingId) {
            // Prospect already exists, add to list without creating new one
            prospectIds.push(existingId);
            results.skipped++;
            setImportProgress(((i + 1) / previewData.length) * 100);
            continue;
          }

          // Create prospect
          const createdProspect = await backendAPI.createProspect({
            firstName: prospect.firstName || '',
            lastName: prospect.lastName || '',
            phone: prospect.phone || '',
            email: prospect.email || '',
            company: prospect.company || '',
            title: prospect.title || '',
            timezone: prospect.timezone || 'America/Los_Angeles',
            notes: prospect.notes || '',
            status: 'New',
          });

          prospectIds.push(createdProspect.id);
          // Also add to our local map in case of duplicates in CSV
          phoneToProspectId.set(normalizedPhone, createdProspect.id);
          results.success++;
          setImportProgress(((i + 1) / previewData.length) * 100);
        } catch (err: any) {
          // Handle 409 conflict (duplicate) by trying to find existing prospect
          if (err.status === 409) {
            results.skipped++;
            // Try to find by phone and add to list anyway
            const prospect = previewData[i];
            if (prospect.phone) {
              const normalizedPhone = prospect.phone.replace(/\D/g, '');
              const existingId = phoneToProspectId.get(normalizedPhone);
              if (existingId && !prospectIds.includes(existingId)) {
                prospectIds.push(existingId);
              }
            }
          } else {
            results.failed++;
            results.errors.push(`Row ${i + 1}: ${err.message || 'Failed to create prospect'}`);
          }
          setImportProgress(((i + 1) / previewData.length) * 100);
        }
      }

      // Add prospects to the lead list (backend expects 'prospects' not 'prospectIds')
      if (prospectIds.length > 0) {
        try {
          await backendAPI.updateLeadList(newList.id, {
            prospects: prospectIds,
          });
        } catch (updateErr) {
          console.warn('Failed to update lead list with prospects, but prospects were created:', updateErr);
        }
      }

      setImportResults({
        success: results.success,
        failed: results.failed,
        errors: results.skipped > 0 
          ? [`${results.skipped} existing prospects added to list`, ...results.errors]
          : results.errors
      });
      setImportStatus('success');
      
      // Reload lead lists
      const lists = await backendAPI.getLeadLists();
      setLeadLists(lists);
      
      // Auto-select the newly created list and fetch its prospects
      setSelectedList(newList.id);
      
      // Fetch prospects for the new list
      const updatedList = lists.find((l: LeadList) => l.id === newList.id);
      if (updatedList) {
        await fetchListProspects(newList.id);
      }
      
      // Close modal after 2 seconds
      setTimeout(() => {
        resetImportModal();
      }, 2000);
    } catch (err: any) {
      console.error('Import failed:', err);
      setImportStatus('error');
      setImportResults({
        success: 0,
        failed: previewData.length,
        errors: [err.message || 'Import failed'],
      });
    }
  };

  // Focus search input when dropdown opens
  useEffect(() => {
    if (showListDropdown && listSearchInputRef.current) {
      setTimeout(() => listSearchInputRef.current?.focus(), 50);
    }
  }, [showListDropdown]);

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

  // Don't auto-load audio devices - wait for user to start session
  // This prevents accessing microphone without user permission

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
      setCallTimer(0);
      setCallStatus('dialing');
      setSelectedDisposition('No Answer');
      
      // Reset call tracking for new call
      stopCallStatusPolling();
      setCurrentCallSid(null);
      setCallEndReason(null);
      setTwilioCallStatus(null);
      isManuallyDisconnectedRef.current = false;

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
  }, [onCall, effectivePaused, stopCallStatusPolling]);

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

  const handleRequestMicPermission = async () => {
    setIsRequestingPermission(true);
    setMicPermissionError(null);
    
    // Always revoke existing permissions and request fresh
    if (micStream) {
      micStream.getTracks().forEach(track => track.stop());
      setMicStream(null);
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStream(stream);
      
      // Load audio devices after permission is granted
      const devices = await navigator.mediaDevices.enumerateDevices();
      const microphones = devices.filter(d => d.kind === 'audioinput');
      const speakers = devices.filter(d => d.kind === 'audiooutput');
      
      setAudioDevices({ microphones, speakers });
      
      if (microphones.length > 0 && !selectedMicrophone) {
        setSelectedMicrophone(microphones[0].deviceId);
      }
      if (speakers.length > 0 && !selectedSpeaker) {
        setSelectedSpeaker(speakers[0].deviceId);
      }
      
      setMicPermissionGranted(true);
      setIsRequestingPermission(false);
      
      // Auto-expand audio dropdown and start mic level monitoring
      setShowAudioDropdown(true);
      setIsTesting(true);
    } catch (error: any) {
      console.error('Microphone permission denied:', error);
      setMicPermissionError(error.message || 'Microphone permission denied. Please allow microphone access to make calls.');
      setIsRequestingPermission(false);
    }
  };

  const handleStartCalling = () => {
    // Use the filtered queue (already filtered by selected lead list) as the starting snapshot
    const snapshot = [...activeQueue];
    stableQueueRef.current = snapshot;
    currentIndexRef.current = 0;
    setStableQueue(snapshot);
    setIsActive(true);
    setIsPaused(false);
    setCurrentIndex(0);
    setCompletedIds([]);
    setCallTimer(0);
    setCallStatus('dialing');
    setSelectedDisposition('No Answer');
    setCallNote('');
    
    // Reset call tracking
    stopCallStatusPolling();
    setCurrentCallSid(null);
    setCallEndReason(null);
    setTwilioCallStatus(null);

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

  const handleStart = () => {
    // Just request microphone permission, don't start calling yet
    handleRequestMicPermission();
  };

  const handlePauseResume = useCallback(() => {
    setIsPaused(prev => !prev);
    if (setPowerDialerPaused) {
      setPowerDialerPaused(!effectivePaused);
    }
  }, [effectivePaused, setPowerDialerPaused]);

  const handleEndSession = () => {
    // Stop any active call polling
    stopCallStatusPolling();
    
    // Hangup any active call
    try {
      voiceService.disconnect();
    } catch (e) {
      console.warn('No active call to disconnect');
    }
    
    // Stop mic stream and cleanup
    if (micStream) {
      micStream.getTracks().forEach(track => track.stop());
      setMicStream(null);
    }
    if (micAnimationRef.current) {
      cancelAnimationFrame(micAnimationRef.current);
      micAnimationRef.current = null;
    }
    if (testAudio) {
      testAudio.pause();
      setTestAudio(null);
    }
    setMicLevel(0);
    setSpeakerLevel(0);
    setIsTesting(false);
    setShowAudioDropdown(false);
    
    setIsActive(false);
    setIsPaused(false);
    setCurrentIndex(0);
    setStableQueue([]);
    setCompletedIds([]);
    setCallDispositions({});
    setSelectedIds([]);
    setCallTimer(0);
    setCallStatus('idle');
    setCallNote('');
    setExpandedRowId(null);
    
    // Reset call tracking
    setCurrentCallSid(null);
    setCallEndReason(null);
    setTwilioCallStatus(null);
    
    // Reset microphone permission state
    setMicPermissionGranted(false);
    setMicPermissionError(null);
    
    stableQueueRef.current = [];
    currentIndexRef.current = 0;
  };

  // Mic level monitoring
  const startMicLevelMonitoring = useCallback(() => {
    if (!micStream) return;
    
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(micStream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    micAnalyserRef.current = analyser;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const updateLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setMicLevel(Math.min(100, (average / 128) * 100));
      micAnimationRef.current = requestAnimationFrame(updateLevel);
    };
    
    updateLevel();
    
    return () => {
      if (micAnimationRef.current) {
        cancelAnimationFrame(micAnimationRef.current);
      }
      audioContext.close();
    };
  }, [micStream]);

  // Test microphone - shows live level
  const handleTestMic = useCallback(() => {
    if (isTesting) {
      // Stop testing
      if (micAnimationRef.current) {
        cancelAnimationFrame(micAnimationRef.current);
        micAnimationRef.current = null;
      }
      setMicLevel(0);
      setIsTesting(false);
    } else {
      // Start testing
      setIsTesting(true);
      startMicLevelMonitoring();
    }
  }, [isTesting, startMicLevelMonitoring]);

  // Test speaker - plays a test sound
  const handleTestSpeaker = useCallback(async () => {
    if (testAudio) {
      testAudio.pause();
      setTestAudio(null);
      setSpeakerLevel(0);
      return;
    }
    
    // Create oscillator for test tone
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    setSpeakerLevel(75);
    
    // Stop after 2 seconds
    setTimeout(() => {
      oscillator.stop();
      audioContext.close();
      setSpeakerLevel(0);
    }, 2000);
  }, [testAudio]);

  // Click outside to close audio dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (audioDropdownRef.current && !audioDropdownRef.current.contains(event.target as Node)) {
        setShowAudioDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-start mic level monitoring when testing is enabled and stream is available
  useEffect(() => {
    if (isTesting && micStream && !micAnimationRef.current) {
      startMicLevelMonitoring();
    }
  }, [isTesting, micStream, startMicLevelMonitoring]);

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

  const getStatusBadge = (prospect: Prospect, idx: number) => {
    if (idx === currentIndex && isActive) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <Phone className="w-3 h-3" />
          Connected: {formatCallTime(callTimer)}
        </span>
      );
    }

    if (completedIds.includes(prospect.id)) {
      const disp = callDispositions[prospect.id] || 'Ended';
      const styles: Record<string, string> = {
        // Not Contacted - Gray/Orange
        'Voicemail': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        'No Answer': 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
        'Busy': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        'Wrong Number': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        'Disconnected': 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
        'Gatekeeper - No Connect': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        // Contacted - Blue
        'Connected': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        'Callback Scheduled': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        'Sent Info': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        'Gatekeeper - Message Left': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        // Qualified - Green/Purple
        'Meeting Booked': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        'Qualified - Interested': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        'Demo Scheduled': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
        'Referral Given': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        // Disqualified - Red
        'Not Interested': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        'Bad Timing': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        'No Budget': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        'Wrong Contact': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        'Do Not Call': 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300',
        'Competitor': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      };
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${styles[disp] || styles['No Answer']}`}>
          {disp}
        </span>
      );
    }

    return null;
  };

  // Orum-style Layout
  return (
    <div className="flex h-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-slate-900">
      {/* Left Sidebar - Dialer Options */}
      {!sidebarCollapsed && (
        <div className="w-64 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex flex-col flex-shrink-0 shadow-lg">
          <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Dialer Settings
            </h3>
            <button 
              onClick={() => setSidebarCollapsed(true)}
              className="text-white/70 hover:text-white p-1 rounded hover:bg-white/10 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-visible p-4 space-y-5">
            {/* List Selector with Actions */}
            <div className="relative" ref={listDropdownRef}>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                  Lead List
                </label>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('Import button clicked, opening modal');
                    setShowImportModal(true);
                  }}
                  className="p-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"
                  title="Import CSV"
                  type="button"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              {/* Custom Dropdown Trigger */}
              <button
                onClick={() => setShowListDropdown(!showListDropdown)}
                className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between shadow-sm hover:border-blue-300 transition-all"
              >
                <span className={`truncate text-left flex-1 ${!selectedList ? 'text-gray-400' : 'font-medium'}`}>{getSelectedListName()}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {selectedList && (
                    <X 
                      className="w-4 h-4 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearListSelection();
                      }}
                    />
                  )}
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showListDropdown ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Custom Dropdown Menu */}
              {showListDropdown && (
                <div 
                  className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-[100]"
                  style={{ width: '200px' }}
                >
                  {/* Search Input */}
                  <div className="p-2 border-b border-gray-100 dark:border-gray-600">
                    <input
                      ref={listSearchInputRef}
                      type="text"
                      value={listSearchQuery}
                      onChange={(e) => setListSearchQuery(e.target.value)}
                      placeholder="Search lists..."
                      className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  
                  {/* RECENTS Header */}
                  <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-100 dark:border-gray-600">
                    {listSearchQuery ? 'Search Results' : 'Recents'}
                  </div>
                  
                  {/* List Items */}
                  <div className="max-h-48 overflow-y-auto">
                    {filteredLeadLists.length === 0 ? (
                      <div className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400">
                        {listSearchQuery ? 'No lists match your search' : 'No lead lists available'}
                      </div>
                    ) : (
                      filteredLeadLists.map((list) => (
                        <div
                          key={list.id}
                          className="relative"
                        >
                          <div
                            className={`px-2 py-1.5 flex items-center gap-1 ${
                              selectedList === list.id ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                            }`}
                          >
                            {/* Clickable name area */}
                            <div 
                              className="flex-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 -ml-2 -my-1.5 pl-2 pr-1 py-1.5 rounded-l"
                              onClick={() => handleUseList(list)}
                            >
                              <div className={`text-xs ${selectedList === list.id ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-800 dark:text-white'}`}>
                                {list.name}
                              </div>
                              <div className="flex items-center gap-0.5 text-xs text-gray-500 dark:text-gray-400">
                                <UserIcon className="w-2.5 h-2.5" />
                                <span>{list.createdBy || 'Don Vee'}</span>
                              </div>
                            </div>
                            
                            {/* Delete (X) button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteListClick(list);
                              }}
                              className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                              title="Delete CSV"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            
                            {/* Expand submenu button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setHoveredListId(hoveredListId === list.id ? null : list.id);
                              }}
                              className={`p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors ${
                                hoveredListId === list.id ? 'bg-gray-200 dark:bg-gray-500' : ''
                              }`}
                              title="More options"
                            >
                              <ChevronRight className={`w-3 h-3 text-gray-400 transition-transform ${hoveredListId === list.id ? 'rotate-90' : ''}`} />
                            </button>
                          </div>
                          
                          {/* Right Submenu on Click */}
                          {hoveredListId === list.id && (
                            <div 
                              className="fixed bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-xl py-1 z-[200]"
                              style={{ 
                                left: (listDropdownRef.current?.getBoundingClientRect().right || 0) + 8,
                                top: 'auto',
                                minWidth: '140px'
                              }}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUseList(list);
                                }}
                                className="w-full px-2 py-1.5 text-left text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-1.5"
                              >
                                <Check className="w-3 h-3 text-gray-600" />
                                Use this CSV
                              </button>
                              {/* Share button - Admin only */}
                              {isAdmin && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleShareList(list);
                                  }}
                                  className="w-full px-2 py-1.5 text-left text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-1.5"
                                >
                                  <Share2 className="w-3 h-3 text-blue-600" />
                                  Share with team
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReassignList(list);
                                }}
                                className="w-full px-2 py-1.5 text-left text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-1.5"
                              >
                                <RefreshCw className="w-3 h-3 text-gray-600" />
                                Reassign this CSV
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteListClick(list);
                                  }}
                                  className="w-full px-2 py-1.5 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-1.5"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete this CSV
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Import New CSV */}
                  <div className="border-t border-gray-100 dark:border-gray-600">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowListDropdown(false);
                        setHoveredListId(null);
                        setShowImportModal(true);
                      }}
                      className="w-full px-2 py-1.5 text-left text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-1.5 font-medium"
                    >
                      <Upload className="w-3 h-3" />
                      Import a new CSV
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Parallel dials</label>
              <select
                value={parallelDials}
                onChange={(e) => setParallelDials(Number(e.target.value))}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              >
                <option value={1}>1 (Power dialing)</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Phone fields</label>
              <select className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-white">
                <option>Phone</option>
                <option>Mobile Phone</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Call from number</label>
              <select
                value={callFromNumber}
                onChange={(e) => setCallFromNumber(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              >
                {twilioNumbers.map((num) => (
                  <option key={num.sid} value={num.phoneNumber}>{num.phoneNumber}</option>
                ))}
              </select>
              <p className="text-xs text-blue-600 mt-1 cursor-pointer hover:underline">Callbacks: Add number</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Voicemail</label>
              <select 
                value={selectedVoicemailId}
                onChange={(e) => setSelectedVoicemailId(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              >
                <option value="">No voicemail</option>
                {voicemails.map((vm) => (
                  <option key={vm.id} value={vm.id}>
                    {vm.name} {vm.isDefault ? '(Default)' : ''} - {Math.floor(vm.duration / 60)}:{(vm.duration % 60).toString().padStart(2, '0')}
                  </option>
                ))}
              </select>
              <p 
                className="text-xs text-blue-600 mt-1 cursor-pointer hover:underline"
                onClick={() => {
                  const navEvent = new CustomEvent('navigateTo', { detail: 'settings' });
                  window.dispatchEvent(navEvent);
                }}
              >
                {voicemails.length === 0 ? 'Record your first voicemail' : 'Manage voicemails'}
              </p>
            </div>
          </div>
        </div>
      )}

      {sidebarCollapsed && (
        <button 
          onClick={() => setSidebarCollapsed(false)}
          className="w-8 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </button>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Enhanced Design */}
        <div className="border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between bg-white dark:bg-slate-800 shadow-sm">
          <div className="flex items-center gap-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                {selectedList ? getSelectedListName() : 'Power Dialer'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {isActive ? 'Session active' : 'Ready to dial'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Called (based on prospect status - anything other than 'New' means called) */}
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl shadow-sm">
                <Phone className="w-4 h-4" />
                <span className="font-bold">{activeQueue.filter(p => p.status !== 'New').length}</span>
                <span className="text-green-100 text-sm">called</span>
              </div>
              {/* Not Called (status is 'New') */}
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl shadow-sm">
                <Users className="w-4 h-4" />
                <span className="font-bold">{activeQueue.filter(p => p.status === 'New').length}</span>
                <span className="text-blue-100 text-sm">remaining</span>
              </div>
              {/* Total in list */}
              <div className="text-gray-400 text-sm font-medium">
                of {activeQueue.length} total
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Audio Settings Dropdown - shown when session is active or permission granted */}
            {(isActive || micPermissionGranted) && (
              <div className="relative" ref={audioDropdownRef}>
                <button
                  onClick={() => setShowAudioDropdown(!showAudioDropdown)}
                  className={`p-2 rounded-lg flex items-center gap-1 transition-all ${
                    micMuted 
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  title="Audio Settings"
                >
                  {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <ChevronDown className="w-3 h-3" />
                </button>
                
                {showAudioDropdown && (
                  <div className="absolute right-0 top-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 w-72 overflow-hidden">
                    {/* Microphone Section */}
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Mic className="w-4 h-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Microphone</span>
                        </div>
                        <button
                          onClick={() => setMicMuted(!micMuted)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                            micMuted 
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' 
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                          }`}
                        >
                          {micMuted ? 'Unmute' : 'Mute'}
                        </button>
                      </div>
                      <select
                        value={selectedMicrophone}
                        onChange={(e) => setSelectedMicrophone(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 mb-3"
                      >
                        {audioDevices.microphones.map((mic) => (
                          <option key={mic.deviceId} value={mic.deviceId}>
                            {mic.label || 'Default Microphone'}
                          </option>
                        ))}
                      </select>
                      
                      {/* Mic Input Level */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-14">Input</span>
                        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 transition-all duration-100 rounded-full"
                            style={{ width: `${micLevel}%` }}
                          />
                        </div>
                        <button
                          onClick={handleTestMic}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                            isTesting 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200'
                          }`}
                        >
                          {isTesting ? 'Stop' : 'Test Mic'}
                        </button>
                      </div>
                    </div>
                    
                    {/* Speaker Section */}
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Volume2 className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Speaker</span>
                      </div>
                      <select
                        value={selectedSpeaker}
                        onChange={(e) => setSelectedSpeaker(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 mb-3"
                      >
                        {audioDevices.speakers.map((speaker) => (
                          <option key={speaker.deviceId} value={speaker.deviceId}>
                            {speaker.label || 'Default Speaker'}
                          </option>
                        ))}
                      </select>
                      
                      {/* Speaker Output Level */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-14">Output</span>
                        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 transition-all duration-100 rounded-full"
                            style={{ width: `${speakerLevel}%` }}
                          />
                        </div>
                        <button
                          onClick={handleTestSpeaker}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                            speakerLevel > 0 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200'
                          }`}
                        >
                          {speakerLevel > 0 ? 'Stop' : 'Test Speaker'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Reset List Progress Button */}
            <button
              onClick={() => {
                setCurrentIndex(0);
                currentIndexRef.current = 0;
                setCompletedIds([]);
                setCallDispositions({});
                if (isActive) {
                  setStableQueue([...queue]);
                  stableQueueRef.current = [...queue];
                }
              }}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Reset call progress - start from beginning"
            >
              <ChevronsLeft className="w-5 h-5" />
            </button>

            {/* Manual Dialer Button */}
            <button
              onClick={() => {
                const navEvent = new CustomEvent('navigateTo', { detail: 'manual-dialer' });
                window.dispatchEvent(navEvent);
              }}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Open manual dialer"
            >
              <PhoneForwarded className="w-5 h-5" />
            </button>

            {!isActive && !micPermissionGranted ? (
              <button
                onClick={handleStart}
                disabled={disabled || isRequestingPermission}
                className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-green-500/25 transition-all hover:scale-105"
              >
                {isRequestingPermission ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Requesting...
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    Start Session
                  </>
                )}
              </button>
            ) : !isActive && micPermissionGranted ? (
              <>
                <button
                  onClick={handleEndSession}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium flex items-center gap-2 transition-all"
                >
                  <PhoneOff className="w-4 h-4" />
                  End Session
                </button>
                <button
                  onClick={handleStartCalling}
                  disabled={disabled || !selectedList || activeQueue.length === 0}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25 transition-all hover:scale-105"
                  title={!selectedList ? 'Select a list first' : activeQueue.length === 0 ? 'No prospects in this list' : ''}
                >
                  <Zap className="w-4 h-4" />
                  Start Calling
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleEndSession}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium flex items-center gap-2 transition-all"
                >
                  <PhoneOff className="w-4 h-4" />
                  End Session
                </button>
                <button
                  onClick={handlePauseResume}
                  className={`px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg transition-all hover:scale-105 ${
                    isPaused 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-green-500/25' 
                      : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-orange-500/25'
                  }`}
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  {isPaused ? 'Resume Dialing' : 'Pause Dialing'}
                </button>
              </>
            )}
            
            {micPermissionError && !isActive && (
              <div className="ml-4 px-4 py-2.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl text-sm flex items-center gap-2 border border-red-200 dark:border-red-800">
                <AlertCircle className="w-4 h-4" />
                {micPermissionError}
              </div>
            )}
          </div>
        </div>

        {/* Table Toolbar */}
        <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-3">
          <div className="flex items-center gap-3">
            {/* Sort By */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-600 dark:text-gray-400">⬆ Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 cursor-pointer hover:border-blue-500"
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
                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-1"
              >
                <span className="text-gray-600">⚏</span>
                Columns
              </button>
              {showColumnsMenu && (
                <div className="absolute top-full mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-2 z-50 min-w-[140px]">
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded text-xs">
                      <input
                        type="checkbox"
                        checked={visibleColumns.status}
                        onChange={() => toggleColumn('status')}
                        className="rounded"
                      />
                      <span>Status</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded text-xs">
                      <input
                        type="checkbox"
                        checked={visibleColumns.name}
                        onChange={() => toggleColumn('name')}
                        className="rounded"
                      />
                      <span>Name</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded text-xs">
                      <input
                        type="checkbox"
                        checked={visibleColumns.phone}
                        onChange={() => toggleColumn('phone')}
                        className="rounded"
                      />
                      <span>Phone</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded text-xs">
                      <input
                        type="checkbox"
                        checked={visibleColumns.links}
                        onChange={() => toggleColumn('links')}
                        className="rounded"
                      />
                      <span>Links</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded text-xs">
                      <input
                        type="checkbox"
                        checked={visibleColumns.city}
                        onChange={() => toggleColumn('city')}
                        className="rounded"
                      />
                      <span>City</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Filter Button */}
            <div className="relative">
              <button
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-1"
              >
                <span className="text-gray-600">⊙</span>
                Filter {filterStatus !== 'all' && <span className="ml-1 text-blue-600">•</span>}
              </button>
              {showFilterMenu && (
                <div className="absolute top-full mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-2 z-50 min-w-[160px]">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-gray-500 mb-1">Filter by Status</div>
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded text-xs">
                      <input
                        type="radio"
                        name="filter"
                        checked={filterStatus === 'all'}
                        onChange={() => setFilterStatus('all')}
                        className="rounded"
                      />
                      <span>All Prospects</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded text-xs">
                      <input
                        type="radio"
                        name="filter"
                        checked={filterStatus === 'New'}
                        onChange={() => setFilterStatus('New')}
                        className="rounded"
                      />
                      <span>New</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded text-xs">
                      <input
                        type="radio"
                        name="filter"
                        checked={filterStatus === 'Contacted'}
                        onChange={() => setFilterStatus('Contacted')}
                        className="rounded"
                      />
                      <span>Contacted</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded text-xs">
                      <input
                        type="radio"
                        name="filter"
                        checked={filterStatus === 'Qualified'}
                        onChange={() => setFilterStatus('Qualified')}
                        className="rounded"
                      />
                      <span>Qualified</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Delete Selected Button */}
            {selectedIds.length > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded flex items-center gap-1 font-medium transition-colors"
              >
                🗑️ Delete ({selectedIds.length})
              </button>
            )}
          </div>
        </div>

        {/* Table Header Row */}
        <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
            <div className="col-span-1 flex items-center">
              <input
                type="checkbox"
                checked={selectedIds.length === activeQueue.length && activeQueue.length > 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="rounded border-gray-300"
              />
            </div>
            <div className="col-span-1"></div>
            {visibleColumns.status && <div className="col-span-2">Status</div>}
            {visibleColumns.name && <div className="col-span-2">Name</div>}
            {visibleColumns.phone && <div className="col-span-3">Phone</div>}
            {visibleColumns.links && <div className="col-span-1">Links</div>}
            {visibleColumns.city && <div className="col-span-2">City</div>}
          </div>
        </div>

        {/* Active Call Row - Orum Style */}
        {isActive && currentProspect && (
          <>
            <div className={`${['completed', 'busy', 'no-answer', 'failed', 'canceled', 'ended'].includes(callStatus) ? 'bg-gray-50 dark:bg-gray-800/50' : 'bg-green-50 dark:bg-green-900/20'} border-b-2 ${['completed', 'busy', 'no-answer', 'failed', 'canceled', 'ended'].includes(callStatus) ? 'border-gray-200 dark:border-gray-700' : 'border-green-200 dark:border-green-800'}`}>
              <div className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
                <div className="col-span-1">
                  <input type="checkbox" className="rounded border-gray-300" />
                </div>
                <div className="col-span-2">
                  {(() => {
                    const statusDisplay = getCallStatusDisplay();
                    return (
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusDisplay.className}`}>
                          {statusDisplay.icon}
                          {statusDisplay.text}
                        </span>
                        {isCallStuck && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400 animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            Connection issue
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div className="col-span-3 text-sm font-medium text-gray-900 dark:text-white">
                  {currentProspect.firstName} {currentProspect.lastName}
                </div>
                <div className="col-span-3 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5" />
                  <button
                    onClick={() => setPhoneHistoryModal({
                      isOpen: true,
                      prospectId: currentProspect.id,
                      prospectName: `${currentProspect.firstName} ${currentProspect.lastName}`,
                      phoneNumber: currentProspect.phone
                    })}
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {currentProspect.phone}
                  </button>
                </div>
                <div className="col-span-1">
                  <a
                    href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${currentProspect.firstName} ${currentProspect.lastName}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 transition-colors"
                    title={`Search LinkedIn for ${currentProspect.firstName} ${currentProspect.lastName}`}
                  >
                    <Linkedin className="w-4 h-4" />
                  </a>
                </div>
                <div className="col-span-2 text-sm text-gray-600 dark:text-gray-400">
                  {currentProspect.timezone?.split('/')[1]?.replace('_', ' ') || 'San Diego'}
                </div>
              </div>
            </div>

            {/* Expanded Active Call Panel */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex">
              {/* Left Panel - Prospect Details */}
              <div className="flex-1 p-6 border-r border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-cyan-100 dark:bg-cyan-900/30 rounded-full flex items-center justify-center">
                    <Phone className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      {currentProspect.firstName} {currentProspect.lastName}
                      <a
                        href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${currentProspect.firstName} ${currentProspect.lastName}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700"
                        title={`Search LinkedIn for ${currentProspect.firstName} ${currentProspect.lastName}`}
                      >
                        <Linkedin className="w-5 h-5" />
                      </a>
                    </h3>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    {/* Real-time call info */}
                    {twilioCallStatus && currentCallSid && (
                      <span className="text-xs text-gray-400 mr-2">
                        SID: ...{currentCallSid.slice(-8)}
                      </span>
                    )}
                    <span className="text-sm text-gray-500">⊙ All</span>
                    <button className="p-2 hover:bg-gray-100 rounded">
                      <Settings className="w-4 h-4 text-gray-400" />
                    </button>
                    {!['completed', 'busy', 'no-answer', 'failed', 'canceled', 'ended'].includes(callStatus) ? (
                      <div className="flex items-center gap-2">
                        {/* Drop Voicemail button - only show when voicemail is selected and call is in progress */}
                        {selectedVoicemailId && ['in-progress', 'connected', 'ringing'].includes(callStatus) && (
                          <button 
                            onClick={async () => {
                              const selectedVm = voicemails.find(v => v.id === selectedVoicemailId);
                              if (selectedVm && currentProspect) {
                                try {
                                  // Log the voicemail drop
                                  await backendAPI.logVoicemailDrop(selectedVoicemailId, currentProspect.id, currentCallSid || undefined);
                                  // Update local usage count
                                  setVoicemails(prev => prev.map(v => 
                                    v.id === selectedVoicemailId 
                                      ? { ...v, usageCount: v.usageCount + 1 } 
                                      : v
                                  ));
                                  // TODO: Actually play the voicemail audio into the call via Twilio
                                  alert(`Voicemail "${selectedVm.name}" dropped for ${currentProspect.firstName}! (Simulated - Twilio integration needed)`);
                                } catch (error) {
                                  console.error('Failed to drop voicemail:', error);
                                  alert('Failed to drop voicemail');
                                }
                              }
                            }}
                            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-md text-sm font-medium flex items-center gap-2"
                            title={`Drop voicemail: ${voicemails.find(v => v.id === selectedVoicemailId)?.name}`}
                          >
                            <Voicemail className="w-4 h-4" />
                            Drop VM
                          </button>
                        )}
                        <button 
                          onClick={handleDisconnect}
                          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium flex items-center gap-2"
                        >
                          <PhoneOff className="w-4 h-4" />
                          End Call
                        </button>
                        {/* Skip Stuck Call Button - shows when call appears stuck */}
                        {isCallStuck && (
                          <button 
                            onClick={handleSkipStuckCall}
                            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm font-medium flex items-center gap-2 animate-pulse"
                            title="Call appears stuck - skip and move to next"
                          >
                            <AlertTriangle className="w-4 h-4" />
                            Skip Stuck
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {callEndReason && (
                          <span className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 ${getEndReasonDisplay(callEndReason).color}`}>
                            {getEndReasonDisplay(callEndReason).icon}
                            {getEndReasonDisplay(callEndReason).text}
                          </span>
                        )}
                        {callTimer > 0 && (
                          <span className="text-sm text-gray-500">
                            Duration: {formatCallTime(callTimer)}
                          </span>
                        )}
                        {/* Redial Button - shows after call ends */}
                        <button
                          onClick={handleRedial}
                          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm font-medium flex items-center gap-2"
                          title="Redial this number"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Redial
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-6 border-b border-gray-200 dark:border-gray-700 mb-4">
                  <button 
                    onClick={() => setActiveTab('details')}
                    className={`pb-3 text-sm font-medium border-b-2 -mb-px ${
                      activeTab === 'details' 
                        ? 'border-blue-600 text-blue-600' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Details
                  </button>
                  <button 
                    onClick={() => setActiveTab('history')}
                    className={`pb-3 text-sm font-medium border-b-2 -mb-px ${
                      activeTab === 'history' 
                        ? 'border-blue-600 text-blue-600' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Account history
                  </button>
                </div>

                {activeTab === 'details' && (
                  <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone numbers</label>
                        <div className="mt-1 flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <button
                            onClick={() => setPhoneHistoryModal({
                              isOpen: true,
                              prospectId: currentProspect.id,
                              prospectName: `${currentProspect.firstName} ${currentProspect.lastName}`,
                              phoneNumber: currentProspect.phone
                            })}
                            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                          >
                            {currentProspect.phone}
                            <History className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Name</label>
                        <p className="text-sm text-gray-900 dark:text-white">{currentProspect.firstName} {currentProspect.lastName}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">First Name</label>
                        <p className="text-sm text-gray-900 dark:text-white">{currentProspect.firstName}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-gray-500">Last Name</label>
                        <p className="text-sm text-gray-900 dark:text-white">{currentProspect.lastName}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Phone</label>
                        <button
                          onClick={() => setPhoneHistoryModal({
                            isOpen: true,
                            prospectId: currentProspect.id,
                            prospectName: `${currentProspect.firstName} ${currentProspect.lastName}`,
                            phoneNumber: currentProspect.phone
                          })}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                        >
                          {currentProspect.phone}
                          <History className="w-3 h-3" />
                        </button>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">City</label>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {currentProspect.timezone?.split('/')[1]?.replace('_', ' ') || 'San Diego'}
                        </p>
                      </div>
                      {currentProspect.company && (
                        <div>
                          <label className="text-sm text-gray-500">Company</label>
                          <p className="text-sm text-gray-900 dark:text-white">{currentProspect.company}</p>
                        </div>
                      )}
                      {currentProspect.title && (
                        <div>
                          <label className="text-sm text-gray-500">Title</label>
                          <p className="text-sm text-gray-900 dark:text-white">{currentProspect.title}</p>
                        </div>
                      )}
                      {currentProspect.email && (
                        <div>
                          <label className="text-sm text-gray-500">Email</label>
                          <p className="text-sm text-gray-900 dark:text-white">{currentProspect.email}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="max-h-96 overflow-y-auto">
                    <ActivityLog prospectId={currentProspect.id} compact />
                  </div>
                )}
              </div>

              {/* Right Panel - Log Call + Next Dial */}
              <div className="w-80 p-6 bg-gray-50 dark:bg-gray-800/50">
                <div className="mb-6">
                  <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Log call</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Disposition</label>
                      <select
                        value={selectedDisposition}
                        onChange={(e) => setSelectedDisposition(e.target.value as DispositionType)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      >
                        <optgroup label="Not Contacted">
                          <option value="No Answer">No Answer</option>
                          <option value="Went to Voicemail">Went to Voicemail</option>
                          <option value="Left Voicemail">Left Voicemail</option>
                          <option value="Busy Signal">Busy Signal</option>
                          <option value="Bad Number">Bad Number</option>
                          <option value="False Positive">False Positive (Machine detected)</option>
                        </optgroup>
                        <optgroup label="Gatekeeper">
                          <option value="Gatekeeper: Did not Transfer">Gatekeeper: Did not Transfer</option>
                          <option value="Gatekeeper transferred: Did not leave VM">Gatekeeper transferred: No VM left</option>
                          <option value="Gatekeeper transferred: Left VM">Gatekeeper transferred: Left VM</option>
                        </optgroup>
                        <optgroup label="Rejection">
                          <option value="Hang Up">Hang Up (before intro)</option>
                          <option value="Hook Rejected">Hook Rejected</option>
                          <option value="Elevator Pitch Rejected">Elevator Pitch Rejected</option>
                        </optgroup>
                        <optgroup label="Objections">
                          <option value="Objection: Already Have a Solution">Objection: Already Have a Solution</option>
                          <option value="Objection: Asked to Send Info">Objection: Asked to Send Info</option>
                          <option value="Objection: Not a Priority">Objection: Not a Priority</option>
                          <option value="Objection: Other">Objection: Other</option>
                        </optgroup>
                        <optgroup label="Wrong Person">
                          <option value="Wrong Person: Gave Referral">Wrong Person: Gave Referral</option>
                          <option value="Wrong Person: No referral">Wrong Person: No referral</option>
                          <option value="Person Left Company">Person Left Company</option>
                        </optgroup>
                        <optgroup label="Follow Up">
                          <option value="Follow-Up Required">Follow-Up Required</option>
                          <option value="Busy: Call Later">Busy: Call Later</option>
                          <option value="Reach back out in X time">Reach back out in X time</option>
                        </optgroup>
                        <optgroup label="Positive Outcome">
                          <option value="Meeting Scheduled">Meeting Scheduled</option>
                        </optgroup>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Note</label>
                      <textarea
                        value={callNote}
                        onChange={(e) => setCallNote(e.target.value)}
                        placeholder="Add notes about this call..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm h-24 resize-none"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleLogCall}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Log Call
                      </button>
                      <button
                        onClick={handleLogAndDialNext}
                        className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium flex items-center justify-center gap-2"
                      >
                        <Phone className="w-4 h-4" />
                        Log & Dial Next
                      </button>
                    </div>
                  </div>
                </div>

                {nextProspect && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-base font-semibold text-gray-900 dark:text-white">Next dial</h4>
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${nextProspect.firstName} ${nextProspect.lastName}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                          title={`Search LinkedIn for ${nextProspect.firstName} ${nextProspect.lastName}`}
                        >
                          <Linkedin className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Name</span>
                        <span className="text-gray-900 dark:text-white">{nextProspect.firstName} {nextProspect.lastName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> Other
                        </span>
                        <button
                          onClick={() => setPhoneHistoryModal({
                            isOpen: true,
                            prospectId: nextProspect.id,
                            prospectName: `${nextProspect.firstName} ${nextProspect.lastName}`,
                            phoneNumber: nextProspect.phone
                          })}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {nextProspect.phone}
                        </button>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">City</span>
                        <span className="text-gray-900 dark:text-white">
                          {nextProspect.timezone?.split('/')[1]?.replace('_', ' ') || 'San Diego'}
                        </span>
                      </div>
                      {nextProspect.notes && (
                        <div>
                          <span className="text-gray-500">Note</span>
                          <p className="text-gray-900 dark:text-white mt-1">{nextProspect.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Rest of Queue Table */}
        <div className="flex-1 overflow-auto">
          {activeQueue.map((prospect, idx) => {
            if (isActive && idx === currentIndex) return null;
            
            const isCompleted = completedIds.includes(prospect.id);
            const wasCalledToday = calledTodayIds.has(prospect.id);
            const isExpanded = expandedRowId === prospect.id;
            
            return (
              <React.Fragment key={prospect.id}>
                <div 
                  className={`grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
                    isCompleted || wasCalledToday ? 'opacity-60 bg-gray-50 dark:bg-gray-800/50' : ''
                  }`}
                >
                  <div className="col-span-1">
                    <input 
                      type="checkbox"
                      checked={selectedIds.includes(prospect.id)}
                      onChange={(e) => handleSelectOne(prospect.id, e.target.checked)}
                      className="rounded border-gray-300"
                    />
                  </div>
                  <div className="col-span-1">
                    <button
                      onClick={() => setExpandedRowId(isExpanded ? null : prospect.id)}
                      className="hover:bg-gray-100 dark:hover:bg-gray-600 rounded p-1"
                    >
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`} />
                    </button>
                  </div>
                  {visibleColumns.status && (
                    <div className="col-span-2 flex flex-col gap-0.5">
                      <div className="flex items-center gap-1">
                        {getStatusBadge(prospect, idx)}
                        {wasCalledToday && (
                          <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded" title="Called today">
                            ✓
                          </span>
                        )}
                      </div>
                      {/* Show last disposition from database if not in current session */}
                      {!completedIds.includes(prospect.id) && prospectDispositions[prospect.id] && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate" title={`Last: ${prospectDispositions[prospect.id]}`}>
                          Last: {prospectDispositions[prospect.id]}
                        </span>
                      )}
                    </div>
                  )}
                  {visibleColumns.name && (
                    <div className="col-span-2 text-sm font-medium text-gray-900 dark:text-white">
                      {prospect.firstName} {prospect.lastName}
                      {prospect.title && (
                        <span className="text-gray-500 dark:text-gray-400 text-xs ml-1">
                          , {prospect.title}
                        </span>
                      )}
                    </div>
                  )}
                  {visibleColumns.phone && (
                    <div className="col-span-3 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5" />
                      <button
                        onClick={() => setPhoneHistoryModal({
                          isOpen: true,
                          prospectId: prospect.id,
                          prospectName: `${prospect.firstName} ${prospect.lastName}`,
                          phoneNumber: prospect.phone
                        })}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {prospect.phone}
                      </button>
                    </div>
                  )}
                  {visibleColumns.links && (
                    <div className="col-span-1 flex items-center gap-1">
                      <a
                        href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${prospect.firstName} ${prospect.lastName}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                        title={`Search LinkedIn for ${prospect.firstName} ${prospect.lastName}`}
                      >
                        <Linkedin className="w-4 h-4" />
                      </a>
                      {isActive && !completedIds.includes(prospect.id) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Remove from stable queue
                            const newQueue = stableQueue.filter(p => p.id !== prospect.id);
                            setStableQueue(newQueue);
                            stableQueueRef.current = newQueue;
                            // Adjust current index if needed
                            if (idx < currentIndex) {
                              setCurrentIndex(prev => Math.max(0, prev - 1));
                              currentIndexRef.current = Math.max(0, currentIndexRef.current - 1);
                            } else if (idx === currentIndex && newQueue.length > 0) {
                              // If removing current, stay at same index (next lead will shift in)
                              setCurrentIndex(prev => Math.min(prev, newQueue.length - 1));
                            }
                          }}
                          className="text-gray-400 hover:text-red-500 transition-colors p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Skip this lead"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                  {visibleColumns.city && (
                    <div className="col-span-2 text-sm text-gray-600 dark:text-gray-400">
                      {prospect.timezone?.split('/')[1]?.replace('_', ' ') || 'San Diego'}
                    </div>
                  )}
                </div>
                
                {/* Expanded Row Details */}
                {isExpanded && (
                  <div className="bg-gray-50 dark:bg-gray-700/30 border-b border-gray-200 dark:border-gray-600 px-4 py-4">
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
                  </div>
                )}
              </React.Fragment>
            );
          })}

          {isLoadingProspects && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p>Loading prospects...</p>
            </div>
          )}

          {!isLoadingProspects && activeQueue.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {!selectedList ? 'Select a lead list to start dialing' : 'No prospects in this list'}
            </div>
          )}
        </div>
      </div>

      {/* Phone Call History Modal */}
      <PhoneCallHistory
        isOpen={phoneHistoryModal.isOpen}
        prospectId={phoneHistoryModal.prospectId}
        prospectName={phoneHistoryModal.prospectName}
        phoneNumber={phoneHistoryModal.phoneNumber}
        onClose={() => setPhoneHistoryModal({ isOpen: false, prospectId: '', prospectName: '', phoneNumber: '' })}
      />

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

      {/* Share List Modal (Admin Only) */}
      {showShareModal && listToShare && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
                <Share2 size={24} className="text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
                Share CSV with Team
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
                Select team members who can access <span className="font-semibold">"{listToShare.name}"</span>
              </p>
              
              {isLoadingShares ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : teamMembers.length === 0 ? (
                <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No other team members to share with</p>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto mb-4 border border-gray-200 dark:border-slate-600 rounded-lg">
                  {teamMembers.map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer border-b border-gray-100 dark:border-slate-600 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedShareUsers.includes(member.id)}
                        onChange={() => toggleShareUser(member.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {member.firstName} {member.lastName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {member.email}
                        </div>
                      </div>
                      {listShares.some(s => s.userId === member.id) && (
                        <span className="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded">
                          Shared
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowShareModal(false);
                    setListToShare(null);
                    setSelectedShareUsers([]);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmShareList}
                  disabled={teamMembers.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Share2 size={16} />
                  Save Sharing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-800 z-10">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Import Leads from CSV</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Step {importStep} of 3</p>
              </div>
              <button
                onClick={resetImportModal}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
              >
                <X size={24} />
              </button>
            </div>

            {/* Step Progress Indicator */}
            <div className="px-6 pt-6">
              <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    importStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-gray-400'
                  }`}>
                    {importStep > 1 ? <CheckCircle size={18} /> : '1'}
                  </div>
                  <span className={`text-sm font-medium ${
                    importStep >= 1 ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                  }`}>Upload File</span>
                </div>
                <div className={`w-16 h-0.5 ${importStep >= 2 ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'}`}></div>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    importStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-gray-400'
                  }`}>
                    {importStep > 2 ? <CheckCircle size={18} /> : '2'}
                  </div>
                  <span className={`text-sm font-medium ${
                    importStep >= 2 ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                  }`}>Map Fields</span>
                </div>
                <div className={`w-16 h-0.5 ${importStep >= 3 ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'}`}></div>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    importStep >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-gray-400'
                  }`}>
                    {importStep > 3 ? <CheckCircle size={18} /> : '3'}
                  </div>
                  <span className={`text-sm font-medium ${
                    importStep >= 3 ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                  }`}>Review & Import</span>
                </div>
              </div>
            </div>

            {/* Step 1: Upload File */}
            {importStep === 1 && (
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    List Name *
                  </label>
                  <input
                    type="text"
                    value={importListName}
                    onChange={(e) => setImportListName(e.target.value)}
                    placeholder="Enter a name for this lead list"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Upload CSV File *
                  </label>
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
                      selectedFile 
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                        : 'border-gray-300 dark:border-slate-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    
                    {selectedFile ? (
                      <div className="space-y-3">
                        <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                          <FileText size={32} className="text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">{selectedFile.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {(selectedFile.size / 1024).toFixed(1)} KB • {csvData.length} records found
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                            setCsvData([]);
                            setCsvHeaders([]);
                          }}
                          className="text-sm text-red-600 dark:text-red-400 hover:underline"
                        >
                          Remove file
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                          <Upload size={32} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            Drop your CSV file here
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            or click to browse your files
                          </p>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          Supported format: .csv
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {csvData.length > 0 && csvHeaders.length > 0 && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Preview (First 5 rows)
                    </label>
                    <div className="border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-600">
                          <thead className="bg-gray-50 dark:bg-slate-700">
                            <tr>
                              {csvHeaders.slice(0, 6).map((header, idx) => (
                                <th key={idx} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                  {header}
                                </th>
                              ))}
                              {csvHeaders.length > 6 && (
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                  +{csvHeaders.length - 6} more
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-600">
                            {csvData.slice(0, 5).map((row, rowIdx) => (
                              <tr key={rowIdx}>
                                {row.slice(0, 6).map((cell, cellIdx) => (
                                  <td key={cellIdx} className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200 whitespace-nowrap truncate max-w-[150px]">
                                    {cell || '-'}
                                  </td>
                                ))}
                                {row.length > 6 && (
                                  <td className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500">...</td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Field Mapping */}
            {importStep === 2 && (
              <div className="p-6 space-y-6">
                {mappingErrors.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={20} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-red-800 dark:text-red-300 mb-1">Please fix the following errors:</p>
                        <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400 space-y-1">
                          {mappingErrors.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                <div className="border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-600">
                    <thead className="bg-gray-50 dark:bg-slate-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider w-1/3">
                          CSV Column
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider w-16">
                          →
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider w-1/3">
                          Map To Field
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                          Sample Data
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-600">
                      {csvHeaders.map((header, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{header}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <ArrowRight size={16} className="text-gray-400 mx-auto" />
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={fieldMappings[header] || ''}
                              onChange={(e) => {
                                setFieldMappings(prev => ({
                                  ...prev,
                                  [header]: e.target.value
                                }));
                                setMappingErrors([]);
                              }}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">-- Don't import --</option>
                              {PROSPECT_FIELDS.map(field => (
                                <option key={field.key} value={field.key}>
                                  {field.label} {field.required && '*'}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-500 dark:text-gray-400 truncate block max-w-[200px]">
                              {csvData[0]?.[idx] || '-'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    {Object.values(fieldMappings).filter(v => v).length} of {csvHeaders.length} columns mapped
                  </span>
                  <button
                    onClick={autoDetectMappings}
                    className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    Auto-detect mappings
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Review & Import */}
            {importStep === 3 && (
              <div className="p-6 space-y-6">
                {importStatus === 'idle' && (
                  <>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        Ready to import <strong>{previewData.length}</strong> leads
                      </p>
                    </div>

                    <div className="border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-600">
                        <thead className="bg-gray-50 dark:bg-slate-700 sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                              Name
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                              Phone
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                              Email
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                              Company
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-600">
                          {previewData.map((prospect, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                {prospect.firstName} {prospect.lastName}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                {prospect.phone || '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 truncate">
                                {prospect.email || '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 truncate">
                                {prospect.company || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {importStatus === 'importing' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center">
                      <Loader2 size={32} className="text-blue-600 dark:text-blue-400 animate-spin" />
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${importProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                      Importing leads... {Math.round(importProgress)}%
                    </p>
                  </div>
                )}

                {importStatus === 'success' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center">
                      <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                        <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
                      </div>
                    </div>
                    <div className="text-center">
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Import Complete!</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Successfully imported <strong className="text-green-600 dark:text-green-400">{importResults.success}</strong> leads
                      </p>
                      {importResults.failed > 0 && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          <strong className="text-red-600 dark:text-red-400">{importResults.failed}</strong> leads failed to import
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {importStatus === 'error' && (
                  <div className="space-y-4">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <p className="text-sm text-red-800 dark:text-red-300 font-semibold mb-2">Import Failed</p>
                      <ul className="text-sm text-red-700 dark:text-red-400 space-y-1">
                        {importResults.errors.map((err, idx) => (
                          <li key={idx}>• {err}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-slate-700 flex gap-3 sticky bottom-0 bg-white dark:bg-slate-800">
              {importStatus === 'idle' && (
                <>
                  {importStep > 1 && (
                    <button
                      onClick={handleImportBack}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 font-semibold transition flex items-center justify-center gap-2"
                    >
                      <ArrowLeft size={16} />
                      Back
                    </button>
                  )}
                  {importStep < 3 && (
                    <button
                      onClick={handleImportNext}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
                    >
                      Next
                      <ArrowRight size={16} />
                    </button>
                  )}
                  {importStep === 3 && (
                    <>
                      <button
                        onClick={handleImportBack}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 font-semibold transition"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleImport}
                        className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
                      >
                        <Upload size={16} />
                        Import Leads
                      </button>
                    </>
                  )}
                </>
              )}
              {importStatus !== 'idle' && (
                <button
                  onClick={resetImportModal}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-slate-600 font-semibold rounded-lg transition"
                >
                  {importStatus === 'success' ? 'Done' : 'Close'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PowerDialer;
