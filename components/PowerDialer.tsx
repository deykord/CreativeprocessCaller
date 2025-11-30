import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Prospect, CallEndReason, TwilioCallStatus } from '../types';
import { 
  Play, Pause, Phone, User, ChevronDown, ChevronLeft, ChevronRight,
  Mic, Volume2, Settings, Linkedin, AlertCircle, Check, PhoneOff, X, History,
  PhoneMissed, PhoneIncoming, PhoneOutgoing, Voicemail, UserX, Clock
} from 'lucide-react';
import { backendAPI } from '../services/BackendAPI';
import { liveTwilioService } from '../services/LiveTwilioService';
import ActivityLog from './ActivityLog';
import PhoneCallHistory from './PhoneCallHistory';

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

const PowerDialer: React.FC<Props> = ({
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
  const [callStatus, setCallStatus] = useState<'idle' | 'dialing' | 'queued' | 'ringing' | 'in-progress' | 'connected' | 'completed' | 'busy' | 'no-answer' | 'failed' | 'canceled' | 'ended'>('idle');
  
  // Real-time Twilio call tracking
  const [currentCallSid, setCurrentCallSid] = useState<string | null>(null);
  const [callEndReason, setCallEndReason] = useState<CallEndReason | null>(null);
  const [twilioCallStatus, setTwilioCallStatus] = useState<TwilioCallStatus | null>(null);
  const callStatusPollRef = useRef<NodeJS.Timeout | null>(null);
  
  // UI States
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
  const [sortBy, setSortBy] = useState('default');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Phone Call History Modal
  const [phoneHistoryModal, setPhoneHistoryModal] = useState<{
    isOpen: boolean;
    prospectId: string;
    prospectName: string;
    phoneNumber: string;
  }>({ isOpen: false, prospectId: '', prospectName: '', phoneNumber: '' });
  
  // Log Call States
  type DispositionType = 'No Answer' | 'Connected' | 'Voicemail' | 'Busy' | 'Wrong Number' | 'Meeting Set' | 'Not Interested' | 'Callback';
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
  
  // Flag to prevent status polling from overwriting manual disconnect
  const isManuallyDisconnectedRef = useRef(false);

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
            'customer_hangup': 'Connected',
            'agent_hangup': 'Connected',
            'voicemail': 'Voicemail',
            'machine_detected': 'Voicemail',
            'no_answer': 'No Answer',
            'busy': 'Busy',
            'call_rejected': 'No Answer',
            'invalid_number': 'Wrong Number',
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

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopCallStatusPolling();
    };
  }, [stopCallStatusPolling]);

  // Fallback: Simulate call status progression if no real callSid
  useEffect(() => {
    if (!isActive || isPaused || currentCallSid) return; // Skip if we have real tracking
    
    const dialingTimer = setTimeout(() => setCallStatus('ringing'), 2000);
    const ringingTimer = setTimeout(() => setCallStatus('in-progress'), 5000);
    
    return () => {
      clearTimeout(dialingTimer);
      clearTimeout(ringingTimer);
    };
  }, [isActive, isPaused, currentIndex, currentCallSid]);

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
        callSid: currentCallSid || undefined
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
    
    // IMPORTANT: Disconnect the local Twilio Device/Call
    // This sends the hangup signal to Twilio and terminates the WebRTC connection
    liveTwilioService.disconnect();
    
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

  useEffect(() => {
    const loadAudioDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
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
    // Stop any active call polling
    stopCallStatusPolling();
    
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
    
    // Reset call tracking
    setCurrentCallSid(null);
    setCallEndReason(null);
    setTwilioCallStatus(null);
    
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
        'Voicemail': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        'No Answer': 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
        'Connected': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        'Busy': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        'Meeting Set': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
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
    <div className="flex h-full bg-white dark:bg-gray-900">
      {/* Left Sidebar - Dialer Options */}
      {!sidebarCollapsed && (
        <div className="w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Dialer options</h3>
            <button 
              onClick={() => setSidebarCollapsed(true)}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">List</label>
              <select className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-white">
                <option>San Diego 1.csv</option>
              </select>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <User className="w-3 h-3" /> Don Vee
              </p>
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
              <p className="text-xs text-blue-600 mt-1 cursor-pointer hover:underline">
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
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between bg-white dark:bg-gray-800">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">San Diego 1.csv</h2>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>👥 {queue.length}</span>
              <span>📞 {completedIds.length}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isActive && (
              <>
                <button
                  onClick={() => setMicMuted(!micMuted)}
                  className={`p-2 rounded ${micMuted ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'} hover:bg-gray-200`}
                  title={micMuted ? 'Unmute' : 'Mute'}
                >
                  {micMuted ? <X className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <select
                  value={selectedMicrophone}
                  onChange={(e) => setSelectedMicrophone(e.target.value)}
                  className="px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-700"
                >
                  {audioDevices.microphones.map((mic) => (
                    <option key={mic.deviceId} value={mic.deviceId}>
                      {mic.label || 'Microphone'}
                    </option>
                  ))}
                </select>
              </>
            )}

            {!isActive ? (
              <button
                onClick={handleStart}
                disabled={disabled || queue.length === 0}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium flex items-center gap-2 disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                Start Session
              </button>
            ) : (
              <>
                <button
                  onClick={handleEndSession}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium flex items-center gap-2"
                >
                  <PhoneOff className="w-4 h-4" />
                  End Session
                </button>
                <button
                  onClick={handlePauseResume}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-md text-sm font-medium flex items-center gap-2"
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  {isPaused ? 'Resume Dialing' : 'Pause Dialing'}
                </button>
              </>
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
            <div className="col-span-2">Status</div>
            <div className="col-span-3">Name</div>
            <div className="col-span-3">Phone</div>
            <div className="col-span-1">Links</div>
            <div className="col-span-2">City</div>
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
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusDisplay.className}`}>
                        {statusDisplay.icon}
                        {statusDisplay.text}
                      </span>
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
                        <option value="No Answer">No Answer</option>
                        <option value="Connected">Connected</option>
                        <option value="Voicemail">Voicemail</option>
                        <option value="Busy">Busy</option>
                        <option value="Wrong Number">Wrong Number</option>
                        <option value="Meeting Set">Meeting Set</option>
                        <option value="Not Interested">Not Interested</option>
                        <option value="Callback">Callback</option>
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
            
            return (
              <div 
                key={prospect.id}
                className={`grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
                  isCompleted ? 'opacity-60' : ''
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
                <div className="col-span-2">
                  {getStatusBadge(prospect, idx)}
                </div>
                <div className="col-span-3 text-sm font-medium text-gray-900 dark:text-white">
                  {prospect.firstName} {prospect.lastName}
                </div>
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
                <div className="col-span-1">
                  <a
                    href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${prospect.firstName} ${prospect.lastName}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-blue-600 transition-colors"
                    title={`Search LinkedIn for ${prospect.firstName} ${prospect.lastName}`}
                  >
                    <Linkedin className="w-4 h-4" />
                  </a>
                </div>
                <div className="col-span-2 text-sm text-gray-600 dark:text-gray-400">
                  {prospect.timezone?.split('/')[1]?.replace('_', ' ') || 'San Diego'}
                </div>
              </div>
            );
          })}

          {queue.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No prospects available. Please add prospects to begin dialing.
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
    </div>
  );
};

export default PowerDialer;
