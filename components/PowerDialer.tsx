
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Prospect } from '../types';
import { Play, SkipForward, Phone, Pause, CheckCircle } from 'lucide-react';

declare global {
  interface Window {
    __powerDialerAdvanceToNext?: () => void;
    __powerDialerSetDispositionSaved?: (v: boolean) => void;
  }
}

interface Props {
  queue: Prospect[];
  onCall: (prospect: Prospect) => void;
  disabled?: boolean;
  onAdvanceToNext?: () => void;
  dispositionSaved: boolean;
  setDispositionSaved: (v: boolean) => void;
}

const PowerDialer: React.FC<Props> = React.memo(({ queue, onCall, disabled = false, onAdvanceToNext, dispositionSaved, setDispositionSaved }) => {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [delayBetweenCalls, setDelayBetweenCalls] = useState(3);
  const [countdown, setCountdown] = useState(delayBetweenCalls);
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  // Memoized completion check
  const isCompleted = useCallback((prospectId: string) => completedIds.includes(prospectId), [completedIds]);

  // Expose control methods globally
  useEffect(() => {
    window.__powerDialerSetDispositionSaved = (v: boolean) => setDispositionSaved(v);
    return () => { delete window.__powerDialerSetDispositionSaved; };
  }, [setDispositionSaved]);

  // Countdown timer
  useEffect(() => {
    if (isActive && !isPaused && currentIndex < queue.length) {
      setCountdown(delayBetweenCalls);
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timer);
            handleAdvanceToNext();
            return delayBetweenCalls;
          }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isActive, isPaused, currentIndex, queue.length, delayBetweenCalls]);

  // Expose advance to next method
  useEffect(() => {
    window.__powerDialerAdvanceToNext = () => {
      handleAdvanceToNext();
    };
    return () => { if (window.__powerDialerAdvanceToNext) delete window.__powerDialerAdvanceToNext; };
  }, [currentIndex, queue.length, completedIds]);

  // Auto-advance when disposition is saved
  useEffect(() => {
    if (dispositionSaved && isActive) {
      handleCompleteLead();
      setDispositionSaved(false);
    }
  }, [dispositionSaved, isActive, setDispositionSaved]);

  // Memoized event handlers
  const handleStart = useCallback(() => {
    setIsActive(true);
    setIsPaused(false);
    setCurrentIndex(0);
    setCompletedIds([]);
  }, []);

  const handleSkip = useCallback(() => {
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, queue.length]);

  const handleAdvanceToNext = useCallback(() => {
    setCurrentIndex(prev => {
      if (prev < queue.length - 1) {
        if (onAdvanceToNext) onAdvanceToNext();
        return prev + 1;
      } else {
        setIsActive(false);
        return prev;
      }
    });
  }, [queue.length, onAdvanceToNext]);

  const handleCompleteLead = useCallback(() => {
    if (currentIndex < queue.length) {
      const prospectId = queue[currentIndex].id;
      setCompletedIds(prev => [...prev, prospectId]);
      handleAdvanceToNext();
    }
  }, [currentIndex, queue, handleAdvanceToNext]);

  const handleClickProspect = useCallback((index: number) => {
    if (isActive && !completedIds.includes(queue[index].id)) {
      setCurrentIndex(index);
    }
  }, [isActive, completedIds, queue]);

  // Memoized computed values
  const isCurrentActive = useMemo(() => currentIndex, [currentIndex]);
  const progressPercentage = useMemo(() => (completedIds.length / queue.length) * 100, [completedIds.length, queue.length]);

  return (
    <div className="w-full h-full bg-gray-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Power Dialer</h2>
          <p className="text-gray-600 dark:text-gray-400">
            {!isActive ? 'Ready to start dialing' : `${completedIds.length} completed • ${queue.length - completedIds.length} remaining`}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Leads List */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden h-[600px] flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-slate-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">Call Queue ({queue.length})</h3>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                {queue.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                    No leads available
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-slate-700">
                    {queue.map((prospect, index) => {
                      const isCurrentActive = isActive && currentIndex === index;
                      const isDone = isCompleted(prospect.id);
                      
                      return (
                        <div
                          key={prospect.id}
                          onClick={() => handleClickProspect(index)}
                          className={`p-3 cursor-pointer transition-all duration-200 ${
                            isCurrentActive
                              ? 'bg-blue-100 dark:bg-blue-900/40 border-l-4 border-blue-600'
                              : isDone
                              ? 'bg-green-50 dark:bg-green-900/20 opacity-60'
                              : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'
                          } ${!isActive || isDone ? 'cursor-default' : ''}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold ${
                                  isCurrentActive
                                    ? 'text-blue-700 dark:text-blue-300'
                                    : isDone
                                    ? 'text-green-700 dark:text-green-300'
                                    : 'text-gray-900 dark:text-gray-200'
                                }`}>
                                  {index + 1}. {prospect.firstName} {prospect.lastName}
                                </span>
                                {isDone && <CheckCircle size={16} className="text-green-600 dark:text-green-400 flex-shrink-0" />}
                              </div>
                              <p className={`text-xs mt-1 ${
                                isCurrentActive
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : isDone
                                  ? 'text-gray-500 dark:text-gray-400'
                                  : 'text-gray-500 dark:text-gray-400'
                              }`}>
                                {prospect.company}
                              </p>
                              <p className={`text-xs ${
                                isCurrentActive
                                  ? 'text-blue-600 dark:text-blue-400 font-medium'
                                  : isDone
                                  ? 'text-gray-400 dark:text-gray-500'
                                  : 'text-gray-600 dark:text-gray-400'
                              }`}>
                                {prospect.phone}
                              </p>
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

          {/* Control Panel */}
          <div className="lg:col-span-2">
            {!isActive ? (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-8 h-[600px] flex flex-col items-center justify-center">
                <div className="text-center mb-8">
                  <Phone size={64} className="mx-auto text-blue-600 dark:text-blue-400 mb-4" />
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Ready to Start?</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {queue.length} leads available in queue
                  </p>
                </div>
                
                <button
                  onClick={handleStart}
                  disabled={disabled || queue.length === 0}
                  className={`px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg flex items-center gap-2 transition ${disabled || queue.length === 0 ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <Play size={20} />
                  Start Dialing
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Current Lead Card */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 rounded-lg shadow-sm border border-blue-200 dark:border-blue-700/50 p-6">
                  <div className="mb-4">
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Current Lead</span>
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                      {queue[currentIndex]?.firstName} {queue[currentIndex]?.lastName}
                    </h3>
                  </div>
                  
                  <div className="space-y-2 text-gray-700 dark:text-gray-300">
                    <p><span className="font-semibold">Title:</span> {queue[currentIndex]?.title}</p>
                    <p><span className="font-semibold">Company:</span> {queue[currentIndex]?.company}</p>
                    <p><span className="font-semibold">Phone:</span> <span className="font-mono text-lg">{queue[currentIndex]?.phone}</span></p>
                    <p><span className="font-semibold">Timezone:</span> {queue[currentIndex]?.timezone}</p>
                  </div>

                  {/* Countdown Display */}
                  <div className="mt-6 p-4 bg-white/50 dark:bg-slate-800/30 rounded-lg text-center">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Next call in</p>
                    <p className="text-5xl font-bold text-blue-600 dark:text-blue-400">{countdown}s</p>
                  </div>
                </div>

                {/* Controls */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => onCall(queue[currentIndex])}
                    disabled={isPaused}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition"
                  >
                    <Phone size={20} />
                    Call Now
                  </button>
                  
                  <button
                    onClick={() => setIsPaused(!isPaused)}
                    className={`px-6 py-3 font-semibold rounded-lg flex items-center justify-center gap-2 transition ${
                      isPaused
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                    }`}
                  >
                    <Pause size={20} />
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>

                  <button
                    onClick={handleSkip}
                    disabled={isPaused || currentIndex >= queue.length - 1}
                    className="px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition"
                  >
                    <SkipForward size={20} />
                    Skip
                  </button>

                  <button
                    onClick={handleCompleteLead}
                    disabled={isPaused}
                    className="px-6 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition"
                  >
                    <CheckCircle size={20} />
                    Mark Done
                  </button>
                </div>

                {/* Progress Stats */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Completed</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">{completedIds.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Remaining</p>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{queue.length - completedIds.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Progress</p>
                      <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{Math.round(progressPercentage)}%</p>
                    </div>
                  </div>
                  <div className="mt-3 w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                    <div 
                      className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default PowerDialer;
