import React, { useState, useEffect } from 'react';
import { CallState, Prospect } from '../types';
import { Mic, MicOff, PhoneOff, User, Save, X, Pause, Play, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  prospect: Prospect;
  callState: CallState;
  onHangup: () => void;
  onSaveDisposition: (outcome: string, note: string) => void;
  powerDialerPaused?: boolean;
  setPowerDialerPaused?: (v: boolean) => void;
}

export const ActiveCallInterface: React.FC<Props> = ({ 
  prospect, 
  callState, 
  onHangup, 
  onSaveDisposition, 
  powerDialerPaused, 
  setPowerDialerPaused 
}) => {
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState('Connected');
  const [expanded, setExpanded] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (callState === CallState.CONNECTED) {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      if (!mediaRecorder) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
          const recorder = new MediaRecorder(stream);
          let chunks: BlobPart[] = [];
          recorder.ondataavailable = e => chunks.push(e.data);
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            setRecordingBlob(blob);
            setRecordingUrl(URL.createObjectURL(blob));
          };
          recorder.start();
          setMediaRecorder(recorder);
        }).catch(() => {});
      }
    }
    if (callState === CallState.WRAP_UP && mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setExpanded(true); // Auto-expand for wrap-up
    }
    return () => clearInterval(interval);
  }, [callState, mediaRecorder]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const isWrapUp = callState === CallState.WRAP_UP;
  const isConnecting = callState === CallState.DIALING || callState === CallState.RINGING;
  const isLive = callState === CallState.CONNECTED;

  const outcomes = [
    { label: 'Connected', color: 'bg-green-600' },
    { label: 'Voicemail', color: 'bg-blue-600' },
    { label: 'Busy', color: 'bg-yellow-600' },
    { label: 'Meeting Set', color: 'bg-purple-600' },
    { label: 'Not Interested', color: 'bg-orange-600' },
    { label: 'No Answer', color: 'bg-gray-600' },
  ];

  const handleSave = async () => {
    if (recordingBlob) {
      const formData = new FormData();
      formData.append('file', recordingBlob, `call-${prospect.id}-${Date.now()}.webm`);
      try {
        await fetch('/api/recordings/upload', { method: 'POST', body: formData });
      } catch (e) {
        console.warn('Recording upload failed:', e);
      }
    }
    onSaveDisposition(outcome, note);
  };

  return (
    <div className="bg-slate-900 border-b border-slate-700 shadow-lg">
      {/* Compact Call Bar - Always visible */}
      <div className="h-14 px-4 flex items-center justify-between">
        {/* Left: Status + Contact */}
        <div className="flex items-center gap-4">
          {/* Status indicator */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            isConnecting ? 'bg-yellow-600/20 text-yellow-400' : 
            isLive ? 'bg-green-600/20 text-green-400' : 
            'bg-slate-700 text-slate-300'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isConnecting ? 'bg-yellow-500 animate-pulse' : 
              isLive ? 'bg-green-500 animate-pulse' : 
              'bg-slate-500'
            }`} />
            {isConnecting && (callState === CallState.DIALING ? 'Dialing' : 'Ringing')}
            {isLive && `Live ${formatTime(duration)}`}
            {isWrapUp && `Ended ${formatTime(duration)}`}
          </div>

          {/* Recording badge */}
          {isLive && (
            <div className="flex items-center gap-1 px-2 py-1 bg-red-600/20 rounded text-red-400 text-xs font-bold">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              REC
            </div>
          )}

          {/* Contact info */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-slate-400">
              <User size={16} />
            </div>
            <div>
              <p className="text-white font-medium text-sm">{prospect.firstName} {prospect.lastName}</p>
              <p className="text-slate-500 text-xs">{prospect.phone}</p>
            </div>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {/* Mute button */}
          {!isWrapUp && (
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
                isMuted ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}

          {/* End/Cancel button */}
          {!isWrapUp ? (
            <button
              onClick={onHangup}
              className="h-9 px-4 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-full flex items-center gap-2 transition"
            >
              <PhoneOff size={16} />
              End
            </button>
          ) : (
            <button
              onClick={onHangup}
              className="h-9 px-3 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-full flex items-center gap-1 transition"
            >
              <X size={16} />
              Cancel
            </button>
          )}

          {/* Save button (wrap-up only) */}
          {isWrapUp && (
            <button
              onClick={handleSave}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-full flex items-center gap-2 transition"
            >
              <Save size={16} />
              Save
            </button>
          )}

          {/* Expand/collapse button */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-9 h-9 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center transition"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded Panel - Notes, Disposition, etc. */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            {/* Left column: Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Call Notes
              </label>
              <textarea
                className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                placeholder="Type notes here..."
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              
              {/* Recording playback */}
              {recordingUrl && (
                <div className="mt-2">
                  <audio controls src={recordingUrl} className="w-full h-8" style={{ filter: 'invert(1)' }} />
                </div>
              )}
            </div>

            {/* Right column: Disposition (wrap-up) or Info */}
            <div>
              {isWrapUp ? (
                <>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Outcome
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {outcomes.map((o) => (
                      <button
                        key={o.label}
                        onClick={() => setOutcome(o.label)}
                        className={`px-2 py-2 text-xs rounded-lg font-medium transition ${
                          outcome === o.label 
                            ? `${o.color} text-white ring-2 ring-white/30` 
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>

                  {/* Auto-dial toggle */}
                  <div className="flex items-center justify-between mt-4 p-3 bg-slate-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      {powerDialerPaused ? (
                        <Pause size={14} className="text-yellow-400" />
                      ) : (
                        <Play size={14} className="text-green-400" />
                      )}
                      <span className="text-sm text-slate-300">Auto-dial next</span>
                    </div>
                    <button
                      onClick={() => setPowerDialerPaused && setPowerDialerPaused(!powerDialerPaused)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        powerDialerPaused ? 'bg-slate-600' : 'bg-green-600'
                      }`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                        powerDialerPaused ? 'left-0.5' : 'left-5'
                      }`} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Contact Details
                  </label>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-2 bg-slate-800 rounded">
                      <span className="text-slate-400">Company</span>
                      <span className="text-white">{prospect.company}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-800 rounded">
                      <span className="text-slate-400">Title</span>
                      <span className="text-white">{prospect.title}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-800 rounded">
                      <span className="text-slate-400">Email</span>
                      <span className="text-white truncate ml-2">{prospect.email}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};