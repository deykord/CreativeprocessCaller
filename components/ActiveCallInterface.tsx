import React, { useState, useEffect } from 'react';
import { CallState, Prospect } from '../types';
import { Mic, MicOff, PhoneOff, User, Building, Clock, Save, X } from 'lucide-react';

interface Props {
  prospect: Prospect;
  callState: CallState;
  onHangup: () => void;
  onSaveDisposition: (outcome: string, note: string) => void;
}

export const ActiveCallInterface: React.FC<Props> = ({ prospect, callState, onHangup, onSaveDisposition }) => {
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState('Connected');

  useEffect(() => {
    let interval: any;
    if (callState === CallState.CONNECTED) {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callState]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const isWrapUp = callState === CallState.WRAP_UP;

  return (
    <div className="fixed bottom-0 right-0 w-full md:w-96 md:bottom-4 md:right-4 bg-white dark:bg-slate-800 shadow-2xl border border-gray-200 dark:border-slate-700 rounded-t-xl md:rounded-xl z-50 overflow-hidden flex flex-col max-h-[90vh]">
      {/* Header */}
      <div className={`p-4 flex justify-between items-start ${isWrapUp ? 'bg-gray-800 dark:bg-slate-950' : 'bg-indigo-600 dark:bg-indigo-800'} text-white transition-colors duration-300`}>
        <div>
          <h3 className="font-bold text-lg flex items-center gap-2 mb-1">
            {callState === CallState.DIALING && 'Dialing...'}
            {callState === CallState.RINGING && 'Ringing...'}
            {callState === CallState.CONNECTED && 'Connected'}
            {callState === CallState.WRAP_UP && 'Call Ended - Wrap Up'}
          </h3>
          <div className="text-indigo-100 text-sm flex items-center">
            {callState === CallState.CONNECTED ? (
              <>
                <span className="font-mono text-lg font-medium mr-3">{formatTime(duration)}</span>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-red-50 text-[10px] font-bold tracking-wider">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
                  REC
                </div>
              </>
            ) : (
              <span>{prospect.phone}</span>
            )}
          </div>
        </div>
        {callState === CallState.CONNECTED && (
          <div className="flex items-center space-x-1 bg-indigo-700/50 px-2 py-1 rounded text-xs mt-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span>Live</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-6 flex-1 overflow-y-auto">
        <div className="flex items-start space-x-4 mb-6">
          <div className="w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-300">
            <User size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{prospect.firstName} {prospect.lastName}</h2>
            <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm mt-1">
              <Building size={14} className="mr-1" />
              {prospect.title} @ {prospect.company}
            </div>
            <div className="flex items-center text-gray-400 text-xs mt-1">
              <Clock size={12} className="mr-1" />
              Local Time: {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} (EST)
            </div>
          </div>
        </div>

        {/* Notes Section */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Call Notes
          </label>
          <textarea
            className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none h-32"
            placeholder="Type notes here..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus={callState === CallState.CONNECTED}
          />
        </div>

        {/* Wrap Up Options */}
        {isWrapUp && (
          <div className="animate-fade-in-up">
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Outcome
            </label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {['Connected', 'Voicemail', 'Busy', 'Meeting Set', 'Not Interested'].map((o) => (
                <button
                  key={o}
                  onClick={() => setOutcome(o)}
                  className={`px-3 py-2 text-sm rounded-md border ${
                    outcome === o 
                      ? 'bg-indigo-50 dark:bg-indigo-900/50 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-medium' 
                      : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="p-4 bg-gray-50 dark:bg-slate-750 border-t border-gray-200 dark:border-slate-700">
        {!isWrapUp ? (
          <div className="flex justify-between items-center">
             <button
              onClick={() => setIsMuted(!isMuted)}
              className={`flex flex-col items-center justify-center w-12 h-12 rounded-full ${isMuted ? 'bg-amber-100 text-amber-600' : 'bg-white dark:bg-slate-600 text-gray-600 dark:text-white border border-gray-300 dark:border-slate-500'} hover:shadow-md transition`}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            
            <button
              onClick={onHangup}
              className="flex-1 mx-4 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-full shadow-lg shadow-red-200 dark:shadow-red-900/30 transition flex items-center justify-center"
            >
              <PhoneOff size={20} className="mr-2" />
              End Call
            </button>
          </div>
        ) : (
          <div className="flex space-x-3">
             <button
              onClick={() => onSaveDisposition(outcome, note)}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-sm transition flex items-center justify-center"
            >
              <Save size={18} className="mr-2" />
              Save & Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};