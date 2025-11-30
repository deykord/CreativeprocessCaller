import React, { useState, useEffect, useCallback } from 'react';
import { Prospect } from '../types';
import { Play, Pause, SkipForward, Square, Phone, User, Building2, MapPin, ChevronDown, Settings, Mic, Volume2, ChevronLeft, ChevronRight, Linkedin } from 'lucide-react';
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

const PowerDialerSimple: React.FC<Props> = ({
  queue,
  onCall,
  disabled = false,
  dispositionSaved,
  setDispositionSaved,
  powerDialerPaused,
  setPowerDialerPaused
}) => {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [stableQueue, setStableQueue] = useState<Prospect[]>([]);
  
  // Audio Setup
  const [showAudioSetup, setShowAudioSetup] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [selectedMicrophone, setSelectedMicrophone] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const [micLevel, setMicLevel] = useState(50);
  const [speakerLevel, setSpeakerLevel] = useState(50);
  
  // UI State
  const [showDialerOptions, setShowDialerOptions] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
  const [disposition, setDisposition] = useState('No Answer');
  const [callNote, setCallNote] = useState('');
  
  // Dialer Options
  const [selectedList, setSelectedList] = useState('All Leads');
  const [parallelDials, setParallelDials] = useState(1);
  const [phoneField, setPhoneField] = useState('Mobile Phone, Phone');
  const [callFromNumber, setCallFromNumber] = useState('');
  const [voicemailOption, setVoicemailOption] = useState('No voicemail');
  const [twilioNumbers, setTwilioNumbers] = useState<Array<{sid: string; phoneNumber: string}>>([]);
  const [showOptions, setShowOptions] = useState(false);

  const isAdvancingRef = React.useRef(false);
  const isCallingRef = React.useRef(false);
  const stableQueueRef = React.useRef<Prospect[]>([]);
  const currentIndexRef = React.useRef(0);

  const effectivePaused = isPaused || Boolean(powerDialerPaused);
  const activeQueue = isActive ? stableQueue : queue;
  const currentProspect = activeQueue[currentIndex];

  React.useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

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
          onCall(nextProspect);
          isAdvancingRef.current = false;
          setTimeout(() => {
            isCallingRef.current = false;
          }, 2000);
        }, 100);
      } else {
        isAdvancingRef.current = false;
      }
    } else {
      setIsActive(false);
      isAdvancingRef.current = false;
    }
  }, [onCall]);

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

  const handleStart = useCallback(() => {
    const snapshot = [...queue];
    stableQueueRef.current = snapshot;
    currentIndexRef.current = 0;
    setStableQueue(snapshot);
    setIsActive(true);
    setIsPaused(false);
    setCurrentIndex(0);
    setCompletedIds([]);

    if (snapshot.length > 0) {
      isCallingRef.current = true;
      onCall(snapshot[0]);
      setTimeout(() => {
        isCallingRef.current = false;
      }, 2000);
    }
  }, [queue, onCall]);

  const handlePauseResume = useCallback(() => {
    setIsPaused(prev => !prev);
    if (setPowerDialerPaused) {
      setPowerDialerPaused(!effectivePaused);
    }
  }, [effectivePaused, setPowerDialerPaused]);

  const handleSkip = useCallback(() => {
    advanceToNextLead(true);
  }, [advanceToNextLead]);

  const handleStop = useCallback(() => {
    setIsActive(false);
    setIsPaused(false);
    setCurrentIndex(0);
    setStableQueue([]);
    setCompletedIds([]);
    stableQueueRef.current = [];
    currentIndexRef.current = 0;
  }, []);

  const progress = stableQueue.length > 0 ? (completedIds.length / stableQueue.length) * 100 : 0;

  if (!isActive) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8">
            <div className="flex items-center gap-3 mb-6">
              <Phone className="w-6 h-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Power Dialer</h2>
            </div>

            <div className="grid grid-cols-2 gap-8">
              {/* Left Column - Dialer Options */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Dialer Settings</h3>

                {/* List Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    List
                  </label>
                  <div className="relative">
                    <select
                      value={selectedList}
                      onChange={(e) => setSelectedList(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg appearance-none bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="current">Current Queue ({queue.length} leads)</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Parallel Dials */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Parallel dials
                  </label>
                  <div className="relative">
                    <select
                      value={parallelDials}
                      onChange={(e) => setParallelDials(Number(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg appearance-none bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={1}>1 (Power dialing)</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                      <option value={5}>5</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Phone Field Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Phone fields
                  </label>
                  <div className="relative">
                    <select
                      value={phoneField}
                      onChange={(e) => setPhoneField(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg appearance-none bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Mobile Phone, Phone">Mobile Phone, Phone</option>
                      <option value="Phone">Phone</option>
                      <option value="Mobile Phone">Mobile Phone</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Call From Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Call from number
                  </label>
                  <div className="relative">
                    <select
                      value={callFromNumber}
                      onChange={(e) => setCallFromNumber(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg appearance-none bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={twilioNumbers.length === 0}
                    >
                      {twilioNumbers.length === 0 ? (
                        <option value="">Loading numbers...</option>
                      ) : (
                        twilioNumbers.map((num) => (
                          <option key={num.sid} value={num.phoneNumber}>
                            {num.phoneNumber}
                          </option>
                        ))
                      )}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Voicemail Option */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Voicemail
                  </label>
                  <div className="relative">
                    <select
                      value={voicemailOption}
                      onChange={(e) => setVoicemailOption(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg appearance-none bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="No voicemail">No voicemail</option>
                      <option value="Best voicemail">Best voicemail</option>
                      <option value="Custom voicemail">Custom voicemail</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Right Column - Queue Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Queue Summary</h3>
                
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-100 dark:border-blue-800">
                  <div className="text-center">
                    <div className="text-5xl font-bold text-blue-600 dark:text-blue-400 mb-2">{queue.length}</div>
                    <div className="text-gray-600 dark:text-gray-400 font-medium">Total Leads</div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Ready to call</span>
                    <span className="font-semibold text-gray-800 dark:text-white">{queue.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Completed</span>
                    <span className="font-semibold text-gray-800 dark:text-white">0</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Success rate</span>
                    <span className="font-semibold text-gray-800 dark:text-white">--</span>
                  </div>
                </div>

                {/* Preview Queue */}
                {queue.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                      Next Up
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {queue.slice(0, 5).map((prospect, i) => (
                        <div key={prospect.id} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300">
                            <User size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {prospect.firstName} {prospect.lastName}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {prospect.company}
                            </p>
                          </div>
                        </div>
                      ))}
                      {queue.length > 5 && (
                        <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-1">
                          +{queue.length - 5} more
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 flex justify-center">
              <button
                onClick={handleStart}
                disabled={disabled || queue.length === 0}
                className={`
                  px-8 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all
                  ${disabled || queue.length === 0
                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                  }
                `}
              >
                <Play className="w-5 h-5" />
                Start Session
              </button>
            </div>

            {queue.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 mt-4">
                No prospects available. Please add prospects to begin dialing.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header with Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Active Session</h2>
            <p className="text-gray-500 dark:text-gray-400">
              {completedIds.length} of {stableQueue.length} completed
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePauseResume}
              className={`
                px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all
                ${effectivePaused
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                }
              `}
            >
              {effectivePaused ? <Play size={20} /> : <Pause size={20} />}
              <span>{effectivePaused ? 'Resume' : 'Pause'}</span>
            </button>
            <button
              onClick={handleStop}
              className="px-6 py-3 rounded-xl font-semibold flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white transition-all"
            >
              <Square size={20} />
              <span>End Session</span>
            </button>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Lead - Large Card */}
        <div className="lg:col-span-2">
          {currentProspect ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-6 mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg flex-shrink-0">
                  <User size={36} />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    {currentProspect.firstName} {currentProspect.lastName}
                  </h1>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 mb-1">
                    <Building2 size={18} />
                    <span className="text-lg">{currentProspect.title}</span>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">{currentProspect.company}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Phone
                  </p>
                  <p className="text-lg font-mono text-gray-900 dark:text-white">
                    {currentProspect.phone}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Email
                  </p>
                  <p className="text-lg text-gray-900 dark:text-white truncate">
                    {currentProspect.email}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Status
                  </p>
                  <span className="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                    {currentProspect.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <MapPin size={12} /> Timezone
                  </p>
                  <p className="text-lg text-gray-900 dark:text-white">
                    {currentProspect.timezone}
                  </p>
                </div>
              </div>

              {currentProspect.notes && (
                <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                  <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-400 uppercase tracking-wider mb-1">
                    Notes
                  </p>
                  <p className="text-yellow-900 dark:text-yellow-200">
                    {currentProspect.notes}
                  </p>
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleSkip}
                  disabled={effectivePaused}
                  className="flex-1 px-6 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all disabled:opacity-50"
                >
                  <SkipForward size={20} />
                  <span>Skip Lead</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">No more leads in queue</p>
            </div>
          )}
        </div>

        {/* Queue Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden sticky top-6">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Up Next</h3>
            </div>
            <div className="overflow-y-auto max-h-[600px] custom-scrollbar">
              {activeQueue.map((prospect, index) => {
                const isCurrent = currentIndex === index;
                const isCompleted = completedIds.includes(prospect.id);
                const isUpcoming = index > currentIndex && !isCompleted;

                if (isCompleted) return null;

                return (
                  <div
                    key={prospect.id}
                    className={`
                      p-4 border-b border-gray-100 dark:border-gray-700 transition-all
                      ${isCurrent
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500'
                        : isUpcoming
                          ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          : ''
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                        ${isCurrent
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }
                      `}>
                        <User size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${isCurrent ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                          {prospect.firstName} {prospect.lastName}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {prospect.company}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PowerDialerSimple;
