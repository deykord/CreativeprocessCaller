import React, { useEffect, useState, useCallback } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { backendAPI } from '../services/BackendAPI';

interface IncomingCall {
  callControlId: string;
  from: string;
  to: string;
  startTime: string;
}

interface IncomingCallNotificationProps {
  onCallAnswered?: (callControlId: string) => void;
}

export default function IncomingCallNotification({ onCallAnswered }: IncomingCallNotificationProps) {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [isRinging, setIsRinging] = useState(false);

  const checkForIncomingCalls = useCallback(async () => {
    try {
      const response = await backendAPI.getPendingInboundCalls();
      if (response.success && response.calls && response.calls.length > 0) {
        const call = response.calls[0]; // Take the first pending call
        setIncomingCall(call);
        setIsRinging(true);
      } else {
        setIncomingCall(null);
        setIsRinging(false);
      }
    } catch (error) {
      console.error('Error checking for incoming calls:', error);
    }
  }, []);

  useEffect(() => {
    // Check for incoming calls every 2 seconds
    const interval = setInterval(checkForIncomingCalls, 2000);
    checkForIncomingCalls(); // Check immediately

    return () => clearInterval(interval);
  }, [checkForIncomingCalls]);

  const handleAnswer = async () => {
    if (!incomingCall) return;

    try {
      console.log('📞 Answering inbound call:', incomingCall.callControlId);
      
      // First, answer on the backend (Telnyx API)
      // This will transfer the call to the WebRTC client
      const result = await backendAPI.answerInboundCall(incomingCall.callControlId);
      console.log('✓ Backend answer call initiated');
      
      setIsRinging(false);
      setIncomingCall(null);
      
      // Notify parent component that call was answered
      // The parent will handle the WebRTC connection
      if (onCallAnswered) {
        onCallAnswered(incomingCall.callControlId);
      }
      
      console.log('✓ Inbound call process completed');
    } catch (error) {
      console.error('❌ Error answering call:', error);
      alert('Failed to answer call: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleReject = async () => {
    if (!incomingCall) return;

    try {
      await backendAPI.endCall(incomingCall.callControlId);
      setIsRinging(false);
      setIncomingCall(null);
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
  };

  if (!incomingCall || !isRinging) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md w-full border border-gray-200 dark:border-slate-700">
        <div className="text-center">
          <div className="mx-auto w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4 animate-pulse">
            <Phone className="w-10 h-10 text-green-600 dark:text-green-400 animate-bounce" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Incoming Call</h2>
          
          <div className="mb-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">From</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">{incomingCall.from}</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
              {new Date(incomingCall.startTime).toLocaleTimeString()}
            </p>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={handleReject}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <PhoneOff className="w-5 h-5" />
              Decline
            </button>
            
            <button
              onClick={handleAnswer}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Phone className="w-5 h-5" />
              Answer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
