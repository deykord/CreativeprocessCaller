import React, { useState, useEffect } from 'react';
import { Phone, Delete, Copy, RotateCcw, Check, Clock, User, Building, Mic, MicOff, Pause, Play, PhoneOff } from 'lucide-react';
import { voiceService } from '../services/VoiceService';
import { backendAPI } from '../services/BackendAPI';

interface Props {
  onCall: (phoneNumber: string) => void;
  disabled?: boolean;
}

// Orum-style Call Dispositions - matching PowerDialer
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

const OUTCOMES: DispositionType[] = [
  'No Answer',
  'Left Voicemail',
  'Went to Voicemail',
  'Busy Signal',
  'Bad Number',
  'False Positive',
  'Gatekeeper: Did not Transfer',
  'Gatekeeper transferred: Did not leave VM',
  'Gatekeeper transferred: Left VM',
  'Hang Up',
  'Hook Rejected',
  'Elevator Pitch Rejected',
  'Objection: Already Have a Solution',
  'Objection: Asked to Send Info',
  'Objection: Not a Priority',
  'Objection: Other',
  'Wrong Person: Gave Referral',
  'Wrong Person: No referral',
  'Person Left Company',
  'Follow-Up Required',
  'Busy: Call Later',
  'Reach back out in X time',
  'Meeting Scheduled'
];

export const ManualDialer: React.FC<Props> = ({ onCall, disabled }) => {
  const [number, setNumber] = useState('');
  const [prospectName, setProspectName] = useState('');
  const [company, setCompany] = useState('');
  const [lastDialedNumber, setLastDialedNumber] = useState('');
  const [lastDialedName, setLastDialedName] = useState('');
  const [lastDialedCompany, setLastDialedCompany] = useState('');
  const [copied, setCopied] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [callTimer, setCallTimer] = useState(0);
  const [selectedOutcome, setSelectedOutcome] = useState<DispositionType>('No Answer');
  const [callNote, setCallNote] = useState('');
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [currentCallSid, setCurrentCallSid] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isHeld, setIsHeld] = useState(false);
  const [callStatus, setCallStatus] = useState<string>('');

  // Timer for active call
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isInCall && callStartTime) {
      interval = setInterval(() => {
        setCallTimer(Math.floor((Date.now() - callStartTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isInCall, callStartTime]);

  // Listen to voice service call state
  useEffect(() => {
    const unsubscribe = voiceService.registerStatusCallback((stateInfo) => {
      // Update call status display
      if (stateInfo.state === 'ringing') {
        setCallStatus('Ringing...');
        setIsInCall(true);
      } else if (stateInfo.state === 'in-progress') {
        setCallStatus('Connected');
        setIsInCall(true);
        if (!callStartTime) {
          setCallStartTime(Date.now());
        }
      } else if (stateInfo.state === 'connecting') {
        setCallStatus('Connecting...');
        setIsInCall(true);
      } else if (stateInfo.state === 'ended' || stateInfo.state === 'completed') {
        setCallStatus('');
        setIsInCall(false);
        setIsMuted(false);
        setIsHeld(false);
        if (number) {
          setShowOutcomeModal(true);
        }
      }
      
      if (stateInfo.callId && !currentCallSid) {
        setCurrentCallSid(stateInfo.callId);
      }
    });
    return () => unsubscribe();
  }, [callStartTime, number, currentCallSid]);

  const handleDigit = (digit: string) => {
    setNumber(prev => prev + digit);
  };

  const handleBackspace = () => {
    setNumber(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setNumber('');
    setProspectName('');
    setCompany('');
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      // Extract only digits, +, and common separators
      const cleaned = text.replace(/[^\d+\-() ]/g, '');
      setNumber(prev => prev + cleaned);
    } catch (err) {
      console.error('Failed to paste:', err);
    }
  };

  const handleCopy = async () => {
    if (number) {
      try {
        await navigator.clipboard.writeText(number);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const handleRedial = () => {
    if (lastDialedNumber) {
      setNumber(lastDialedNumber);
      setProspectName(lastDialedName);
      setCompany(lastDialedCompany);
    }
  };

  const handleCall = () => {
    if (disabled || isInCall) return;
    if (number.length > 3) {
      setLastDialedNumber(number);
      setLastDialedName(prospectName);
      setLastDialedCompany(company);
      setCallStartTime(Date.now());
      setCallTimer(0);
      setIsInCall(true);
      onCall(number);
      // Get call ID after a brief delay
      setTimeout(() => {
        const callId = voiceService.getCurrentCallId();
        if (callId) {
          setCurrentCallSid(callId);
        }
      }, 500);
    }
  };

  const handleEndCall = () => {
    voiceService.disconnect();
    setIsInCall(false);
    setIsMuted(false);
    setIsHeld(false);
    setCallStatus('');
    setShowOutcomeModal(true);
  };

  const handleToggleMute = () => {
    voiceService.toggleMute();
    setIsMuted(!isMuted);
  };

  const handleToggleHold = () => {
    voiceService.toggleHold();
    setIsHeld(!isHeld);
  };

  const handleSaveOutcome = async () => {
    try {
      // Log the call
      await backendAPI.logCall({
        prospectName: prospectName || `Manual Call (${number})`,
        phoneNumber: number,
        duration: callTimer,
        outcome: selectedOutcome,
        note: callNote,
        fromNumber: '', // Will be filled by backend
        timestamp: new Date().toISOString(),
        callSid: currentCallSid || undefined,
        direction: 'outbound'
      });

      // Reset form
      setShowOutcomeModal(false);
      setNumber('');
      setProspectName('');
      setCompany('');
      setCallNote('');
      setSelectedOutcome('No Answer');
      setCallTimer(0);
      setCallStartTime(null);
      setCurrentCallSid(null);
    } catch (error) {
      console.error('Failed to log call:', error);
      alert('Failed to log call outcome');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-full p-6">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700 w-full max-w-2xl transition-colors duration-200">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 text-center">
            Manual Dialer
          </h2>

          {/* Call Status Banner with Controls */}
          {isInCall && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <Clock className={callStatus === 'Connected' ? 'animate-pulse' : ''} size={20} />
                  <span className="font-semibold">{callStatus || 'Call in Progress'}</span>
                </div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {formatTime(callTimer)}
                </div>
              </div>
              
              {/* Call Control Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleToggleMute}
                  className={`flex-1 py-2 px-4 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                    isMuted 
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-white hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>
                
                <button
                  onClick={handleToggleHold}
                  className={`flex-1 py-2 px-4 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                    isHeld
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-white hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                  title={isHeld ? 'Resume' : 'Hold'}
                >
                  {isHeld ? <Play size={18} /> : <Pause size={18} />}
                  {isHeld ? 'Resume' : 'Hold'}
                </button>
                
                <button
                  onClick={handleEndCall}
                  className="flex-1 py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition flex items-center justify-center gap-2"
                  title="End Call"
                >
                  <PhoneOff size={18} />
                  End Call
                </button>
              </div>
            </div>
          )}

          {/* Contact Information */}
          <div className="mb-6 space-y-3">
            <div className="flex items-center gap-2">
              <User size={18} className="text-gray-400" />
              <input
                type="text"
                value={prospectName}
                onChange={(e) => setProspectName(e.target.value)}
                placeholder="Prospect Name (optional)"
                disabled={isInCall}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Building size={18} className="text-gray-400" />
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company (optional)"
                disabled={isInCall}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Phone Number Display */}
          <div className="mb-6 relative">
            <input
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Enter phone number..."
              disabled={isInCall}
              className="w-full text-3xl font-bold text-center text-gray-800 dark:text-white bg-transparent border-b-2 border-gray-300 dark:border-slate-600 pb-2 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <div className="absolute right-0 top-0 flex gap-2">
              {number.length > 0 && !isInCall && (
                <>
                  <button 
                    onClick={handleCopy}
                    className="text-gray-400 hover:text-blue-500 transition p-2"
                    title="Copy number"
                  >
                    {copied ? <Check size={20} className="text-green-500" /> : <Copy size={20} />}
                  </button>
                  <button 
                    onClick={handleBackspace}
                    className="text-gray-400 hover:text-red-500 transition p-2"
                    title="Delete last digit"
                  >
                    <Delete size={20} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mb-6 flex gap-3">
            <button
              onClick={handlePaste}
              disabled={isInCall}
              className="flex-1 py-3 px-4 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Copy size={18} />
              Paste
            </button>
            <button
              onClick={handleRedial}
              disabled={!lastDialedNumber || isInCall}
              className="flex-1 py-3 px-4 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <RotateCcw size={18} />
              Redial
            </button>
            <button
              onClick={handleClear}
              disabled={isInCall}
              className="flex-1 py-3 px-4 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear
            </button>
          </div>

          {/* Dialpad */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {keys.map((key) => (
              <button
                key={key}
                onClick={() => handleDigit(key)}
                disabled={isInCall}
                className="w-full h-16 rounded-xl bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 active:bg-blue-50 dark:active:bg-slate-600 text-2xl font-semibold text-gray-700 dark:text-white transition flex items-center justify-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {key}
              </button>
            ))}
          </div>

          {/* Call Button */}
          {!isInCall && (
            <button
              onClick={handleCall}
              disabled={number.length < 3 || disabled}
              className={`w-full py-4 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg transition transform active:scale-95 ${
                number.length < 3 || disabled
                  ? 'bg-gray-300 dark:bg-slate-600 cursor-not-allowed' 
                  : 'bg-green-500 hover:bg-green-600 shadow-green-200 dark:shadow-green-900/20'
              }`}
            >
              <Phone className="mr-2" size={24} fill="white" />
              Call
            </button>
          )}

          {/* Last Dialed Info */}
          {lastDialedNumber && !isInCall && (
            <div className="mt-4 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg text-sm text-gray-600 dark:text-gray-400">
              <span className="font-semibold">Last dialed:</span> {lastDialedNumber}
              {lastDialedName && ` • ${lastDialedName}`}
              {lastDialedCompany && ` • ${lastDialedCompany}`}
            </div>
          )}
        </div>
      </div>

      {/* Outcome Selection Modal */}
      {showOutcomeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white">
                Call Disposition
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {number} • Duration: {formatTime(callTimer)}
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Outcome Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Call Outcome *
                </label>
                <select
                  value={selectedOutcome}
                  onChange={(e) => setSelectedOutcome(e.target.value as DispositionType)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {OUTCOMES.map((outcome) => (
                    <option key={outcome} value={outcome}>
                      {outcome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Notes
                </label>
                <textarea
                  value={callNote}
                  onChange={(e) => setCallNote(e.target.value)}
                  placeholder="Add notes about this call..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-slate-700 flex gap-3">
              <button
                onClick={() => setShowOutcomeModal(false)}
                className="flex-1 px-6 py-3 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-white rounded-lg font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOutcome}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
              >
                Save Disposition
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};