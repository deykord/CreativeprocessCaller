import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { telnyxService } from '../services/TelnyxService';
import { CallState } from '../types';

interface Props {
  callControlId: string;
  fromNumber: string;
  fromName?: string;
  onCallEnded?: () => void;
}

export const InboundCallActive: React.FC<Props> = ({ 
  callControlId, 
  fromNumber, 
  fromName,
  onCallEnded 
}) => {
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [callEnded, setCallEnded] = useState(false);

  useEffect(() => {
    // Start timer
    const interval = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);

    // Listen for call state changes
    const unsubscribe = telnyxService.registerStatusCallback((stateInfo) => {
      if (stateInfo.state === 'wrap-up' || stateInfo.state === 'completed') {
        setCallEnded(true);
        if (onCallEnded) {
          onCallEnded();
        }
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [onCallEnded]);

  const handleHangup = async () => {
    try {
      console.log('📞 Hanging up call:', callControlId);
      telnyxService.disconnect();
      setCallEnded(true);
      
      if (onCallEnded) {
        onCallEnded();
      }
    } catch (error) {
      console.error('Error hanging up:', error);
      alert('Failed to hang up: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleToggleMute = () => {
    try {
      telnyxService.mute(!isMuted);
      setIsMuted(!isMuted);
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

  const handleToggleHold = () => {
    try {
      telnyxService.hold(!isOnHold);
      setIsOnHold(!isOnHold);
    } catch (error) {
      console.error('Error toggling hold:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (callEnded) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl p-8 max-w-md w-full text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
            <PhoneOff className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Call Ended</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Call duration: {formatDuration(duration)}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center z-40">
      {/* Call Info Card */}
      <div className="max-w-md w-full mx-4">
        <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-3xl p-8 shadow-2xl">
          {/* Call Status */}
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50">
                <Phone className="w-12 h-12 text-white animate-pulse" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Call Connected</h1>
            <p className="text-4xl font-mono text-green-400 mb-4">{formatDuration(duration)}</p>
            <p className="text-xl text-slate-200">{fromName || fromNumber}</p>
            <p className="text-sm text-slate-400">{fromNumber}</p>
          </div>

          {/* Audio Quality Indicator */}
          <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300">Signal Quality</span>
              <span className="text-sm font-semibold text-green-400">Excellent</span>
            </div>
            <div className="w-full h-2 bg-slate-600 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-400 to-green-500" style={{ width: '95%' }}></div>
            </div>
          </div>

          {/* Call Controls */}
          <div className="flex gap-4 mb-6">
            {/* Mute Button */}
            <button
              onClick={handleToggleMute}
              className={`flex-1 py-4 rounded-2xl font-semibold transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 ${
                isMuted
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
              }`}
            >
              {isMuted ? (
                <>
                  <MicOff size={20} />
                  <span>Unmute</span>
                </>
              ) : (
                <>
                  <Mic size={20} />
                  <span>Mute</span>
                </>
              )}
            </button>

            {/* Hold Button */}
            <button
              onClick={handleToggleHold}
              className={`flex-1 py-4 rounded-2xl font-semibold transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 ${
                isOnHold
                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
              }`}
            >
              {isOnHold ? (
                <>
                  <Volume2 size={20} />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <VolumeX size={20} />
                  <span>Hold</span>
                </>
              )}
            </button>
          </div>

          {/* Hangup Button */}
          <button
            onClick={handleHangup}
            className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-red-600/50 transition-all transform hover:scale-105 active:scale-95"
          >
            <PhoneOff size={24} />
            <span>End Call</span>
          </button>

          {/* Call Info */}
          <div className="mt-6 pt-6 border-t border-slate-600 text-center text-sm text-slate-400">
            <p>Call ID: {callControlId.slice(0, 8)}...</p>
            <p className="mt-1">Inbound Call • WebRTC Audio</p>
          </div>
        </div>
      </div>
    </div>
  );
};
