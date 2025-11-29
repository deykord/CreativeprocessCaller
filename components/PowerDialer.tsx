import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Prospect } from '../types';
import { Play, SkipForward, Phone, Pause, CheckCircle, User, Building, ChevronRight, X } from 'lucide-react';
import { backendAPI } from '../services/BackendAPI';

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
  dispositionSaved?: boolean;
  setDispositionSaved?: (v: boolean) => void;
  onDeleteProspect?: (id: string) => void;
  onUpdateProspect?: (id: string, updates: Partial<Prospect>) => void;
  powerDialerPaused?: boolean;
  setPowerDialerPaused?: (v: boolean) => void;
}

const PowerDialer: React.FC<Props> = React.memo(({ 
  queue, 
  onCall, 
  disabled = false, 
  onAdvanceToNext, 
  dispositionSaved, 
  setDispositionSaved, 
  onDeleteProspect, 
  onUpdateProspect, 
  powerDialerPaused, 
  setPowerDialerPaused 
}) => {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const effectivePaused = isPaused || Boolean(powerDialerPaused);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [modalProspect, setModalProspect] = useState<Prospect | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editProspect, setEditProspect] = useState<Prospect | null>(null);
  const [user, setUser] = useState<{ role?: string } | null>(null);
  const isAdvancingRef = React.useRef(false);
  
  // CRITICAL: Store a stable copy of the queue when dialer starts
  // This prevents index shifting when prospects are updated (status changes)
  const [stableQueue, setStableQueue] = useState<Prospect[]>([]);

  useEffect(() => {
    try {
      const u = localStorage.getItem('user');
      setUser(u ? JSON.parse(u) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const progressPercentage = useMemo(() => {
    const total = stableQueue.length;
    const completed = completedIds.length;
    return total > 0 ? (completed / total) * 100 : 0;
  }, [completedIds.length, stableQueue.length]);

  // Use stableQueue for operations during active session, queue for preview
  const activeQueue = isActive ? stableQueue : queue;

  const advanceToNextLead = React.useCallback((shouldCall: boolean = true) => {
    if (isAdvancingRef.current) return;
    isAdvancingRef.current = true;
    
    setCurrentIndex(prev => {
      let nextIndex = prev;
      // Mark current as completed
      const prospectId = stableQueue[prev]?.id;
      if (prospectId && !completedIds.includes(prospectId)) {
        setCompletedIds(ids => [...ids, prospectId]);
      }
      
      // Move to next
      if (prev < stableQueue.length - 1) {
        nextIndex = prev + 1;
      } else {
        // Reached the end
        setIsActive(false);
        setTimeout(() => { isAdvancingRef.current = false; }, 100);
        return prev;
      }
      
      // Call next prospect (using stableQueue which is stable)
      if (shouldCall && nextIndex < stableQueue.length && stableQueue[nextIndex]) {
        setTimeout(() => onCall(stableQueue[nextIndex]), 50);
      }
      
      setTimeout(() => { isAdvancingRef.current = false; }, 300);
      return nextIndex;
    });
  }, [stableQueue, completedIds, onCall]);

  useEffect(() => {
    window.__powerDialerAdvanceToNext = advanceToNextLead;
    return () => { if (window.__powerDialerAdvanceToNext) delete window.__powerDialerAdvanceToNext; };
  }, [advanceToNextLead]);

  useEffect(() => {
    const externallyPaused = Boolean(powerDialerPaused);
    if (dispositionSaved && isActive && !isPaused && !externallyPaused) {
      advanceToNextLead(true);
      if (setDispositionSaved) setDispositionSaved(false);
    }
  }, [dispositionSaved, isActive, isPaused, powerDialerPaused, advanceToNextLead, setDispositionSaved]);

  const handleStart = useCallback(() => {
    // CRITICAL: Snapshot the queue at start time so indices remain stable
    // even when prospects update their status (New -> Contacted)
    setStableQueue([...queue]);
    setIsActive(true);
    setIsPaused(false);
    setCurrentIndex(0);
    setCompletedIds([]);
    if (queue.length > 0) {
      onCall(queue[0]);
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
  }, []);

  const currentProspect = activeQueue[currentIndex];

  return (
    <div className="h-full">
      {!isActive ? (
        /* Start Screen */
        <div className="flex flex-col items-center justify-center h-full min-h-[500px] bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-600/30">
              <Phone size={40} className="text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Power Dialer</h2>
            <p className="text-slate-400 text-lg">
              {queue.length} leads ready to call
            </p>
          </div>
          
          <button
            onClick={handleStart}
            disabled={disabled || queue.length === 0}
            className={`
              px-10 py-4 rounded-xl font-semibold text-lg flex items-center gap-3 transition-all
              ${disabled || queue.length === 0 
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/30 hover:shadow-green-500/40'
              }
            `}
          >
            <Play size={24} />
            Start Dialing
          </button>

          {queue.length > 0 && (
            <div className="mt-8 w-full max-w-md">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Queue Preview
              </h3>
              <div className="space-y-2">
                {queue.slice(0, 3).map((prospect, i) => (
                  <div key={prospect.id} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                    <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-slate-400">
                      <User size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{prospect.firstName} {prospect.lastName}</p>
                      <p className="text-slate-500 text-sm truncate">{prospect.company}</p>
                    </div>
                    {i === 0 && (
                      <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded">First</span>
                    )}
                  </div>
                ))}
                {queue.length > 3 && (
                  <p className="text-slate-500 text-sm text-center">+ {queue.length - 3} more leads</p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Active Dialing Screen */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* Left Panel - Queue */}
          <div className="lg:col-span-1 bg-slate-900 rounded-xl border border-slate-700 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-semibold text-white">Queue</h3>
              <span className="text-sm text-slate-400">{completedIds.length}/{activeQueue.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {activeQueue.map((prospect, index) => {
                const isCurrent = currentIndex === index;
                const isDone = completedIds.includes(prospect.id);
                return (
                  <div
                    key={prospect.id}
                    onClick={() => {
                      setModalProspect(prospect);
                      setShowLeadModal(true);
                    }}
                    className={`
                      p-3 rounded-lg cursor-pointer transition-all flex items-center gap-3
                      ${isCurrent 
                        ? 'bg-blue-600/20 border border-blue-500/50' 
                        : isDone 
                          ? 'bg-slate-800/30 opacity-50' 
                          : 'bg-slate-800/50 hover:bg-slate-700/50'
                      }
                    `}
                  >
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                      ${isCurrent ? 'bg-blue-600 text-white' : isDone ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}
                    `}>
                      {isDone ? <CheckCircle size={16} /> : <User size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${isCurrent ? 'text-blue-400' : isDone ? 'text-slate-500' : 'text-white'}`}>
                        {prospect.firstName} {prospect.lastName}
                      </p>
                      <p className="text-slate-500 text-xs truncate">{prospect.company}</p>
                    </div>
                    {isCurrent && (
                      <ChevronRight size={16} className="text-blue-400 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel - Controls & Stats */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Lead Card */}
            {currentProspect && (
              <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-slate-700 rounded-xl flex items-center justify-center text-slate-400">
                    <User size={32} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-white">
                      {currentProspect.firstName} {currentProspect.lastName}
                    </h2>
                    <div className="flex items-center gap-1 text-slate-400 mt-1">
                      <Building size={14} />
                      <span>{currentProspect.title} at {currentProspect.company}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-3">
                      <span className="text-slate-300">{currentProspect.phone}</span>
                      <span className="text-slate-500">{currentProspect.email}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Control Panel */}
            <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
              <div className="flex flex-wrap gap-3 justify-center">
                <button
                  onClick={handlePauseResume}
                  className={`
                    px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all
                    ${effectivePaused 
                      ? 'bg-green-600 hover:bg-green-500 text-white' 
                      : 'bg-yellow-600 hover:bg-yellow-500 text-white'
                    }
                  `}
                >
                  {effectivePaused ? <Play size={20} /> : <Pause size={20} />}
                  {effectivePaused ? 'Resume' : 'Pause'}
                </button>

                <button
                  onClick={handleSkip}
                  disabled={effectivePaused || currentIndex >= activeQueue.length - 1}
                  className="px-6 py-3 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl flex items-center gap-2 transition-all"
                >
                  <SkipForward size={20} />
                  Skip
                </button>

                <button
                  onClick={handleStop}
                  className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl flex items-center gap-2 transition-all"
                >
                  <X size={20} />
                  Stop
                </button>
              </div>

              {/* Status indicator */}
              <div className="mt-6 flex items-center justify-center gap-2">
                <div className={`w-3 h-3 rounded-full ${effectivePaused ? 'bg-yellow-500' : 'bg-green-500 animate-pulse'}`} />
                <span className="text-slate-400">
                  {effectivePaused ? 'Paused - Waiting to resume' : 'Active - Dialing in progress'}
                </span>
              </div>
            </div>

            {/* Progress Stats */}
            <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
              <div className="grid grid-cols-3 gap-6 text-center mb-4">
                <div>
                  <p className="text-3xl font-bold text-green-500">{completedIds.length}</p>
                  <p className="text-slate-400 text-sm mt-1">Completed</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-blue-500">{activeQueue.length - completedIds.length}</p>
                  <p className="text-slate-400 text-sm mt-1">Remaining</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white">{Math.round(progressPercentage)}%</p>
                  <p className="text-slate-400 text-sm mt-1">Progress</p>
                </div>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-600 to-green-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lead Info Modal */}
      {showLeadModal && modalProspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowLeadModal(false)} />
          <div className="relative bg-slate-900 rounded-xl shadow-2xl border border-slate-700 p-6 w-full max-w-md">
            <button 
              className="absolute top-4 right-4 text-slate-400 hover:text-white" 
              onClick={() => setShowLeadModal(false)}
            >
              <X size={20} />
            </button>
            
            {!editMode ? (
              <>
                <h3 className="text-xl font-bold text-white mb-4">Lead Details</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-slate-400">
                      <User size={24} />
                    </div>
                    <div>
                      <p className="text-white font-semibold">{modalProspect.firstName} {modalProspect.lastName}</p>
                      <p className="text-slate-400 text-sm">{modalProspect.title}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-slate-800 p-3 rounded-lg">
                      <p className="text-slate-400 text-xs mb-1">Company</p>
                      <p className="text-white">{modalProspect.company}</p>
                    </div>
                    <div className="bg-slate-800 p-3 rounded-lg">
                      <p className="text-slate-400 text-xs mb-1">Status</p>
                      <p className="text-white">{modalProspect.status}</p>
                    </div>
                    <div className="bg-slate-800 p-3 rounded-lg">
                      <p className="text-slate-400 text-xs mb-1">Phone</p>
                      <p className="text-white">{modalProspect.phone}</p>
                    </div>
                    <div className="bg-slate-800 p-3 rounded-lg">
                      <p className="text-slate-400 text-xs mb-1">Email</p>
                      <p className="text-white truncate">{modalProspect.email}</p>
                    </div>
                  </div>
                  {modalProspect.notes && (
                    <div className="bg-slate-800 p-3 rounded-lg">
                      <p className="text-slate-400 text-xs mb-1">Notes</p>
                      <p className="text-white text-sm">{modalProspect.notes}</p>
                    </div>
                  )}
                </div>
                {user?.role === 'admin' && (
                  <div className="flex gap-2 mt-6">
                    <button 
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium"
                      onClick={() => { setEditMode(true); setEditProspect(modalProspect); }}
                    >
                      Edit
                    </button>
                    <button 
                      className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium"
                      onClick={() => { 
                        if (onDeleteProspect && modalProspect) { 
                          onDeleteProspect(modalProspect.id); 
                          setShowLeadModal(false); 
                        } 
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-white mb-4">Edit Lead</h3>
                <form className="space-y-3" onSubmit={async e => {
                  e.preventDefault();
                  if (editProspect) {
                    try {
                      await backendAPI.updateProspect(editProspect.id, editProspect);
                      if (onUpdateProspect) {
                        onUpdateProspect(editProspect.id, editProspect);
                      }
                    } catch (err) {
                      console.error('Failed to save prospect:', err);
                      alert('Failed to save changes');
                    }
                  }
                  setEditMode(false);
                  setShowLeadModal(false);
                }}>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" value={editProspect?.firstName || ''} onChange={e => setEditProspect(p => p ? { ...p, firstName: e.target.value } : p)} placeholder="First Name" />
                    <input type="text" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" value={editProspect?.lastName || ''} onChange={e => setEditProspect(p => p ? { ...p, lastName: e.target.value } : p)} placeholder="Last Name" />
                  </div>
                  <input type="text" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" value={editProspect?.title || ''} onChange={e => setEditProspect(p => p ? { ...p, title: e.target.value } : p)} placeholder="Title" />
                  <input type="text" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" value={editProspect?.company || ''} onChange={e => setEditProspect(p => p ? { ...p, company: e.target.value } : p)} placeholder="Company" />
                  <input type="text" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" value={editProspect?.phone || ''} onChange={e => setEditProspect(p => p ? { ...p, phone: e.target.value } : p)} placeholder="Phone" />
                  <input type="email" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" value={editProspect?.email || ''} onChange={e => setEditProspect(p => p ? { ...p, email: e.target.value } : p)} placeholder="Email" />
                  <select className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" value={editProspect?.status || ''} onChange={e => setEditProspect(p => p ? { ...p, status: e.target.value as any } : p)}>
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Lost">Lost</option>
                    <option value="Do Not Call">Do Not Call</option>
                  </select>
                  <textarea className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" rows={2} value={editProspect?.notes || ''} onChange={e => setEditProspect(p => p ? { ...p, notes: e.target.value } : p)} placeholder="Notes" />
                  <div className="flex gap-2 pt-2">
                    <button type="submit" className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium">Save</button>
                    <button type="button" className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-medium" onClick={() => setEditMode(false)}>Cancel</button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default PowerDialer;
