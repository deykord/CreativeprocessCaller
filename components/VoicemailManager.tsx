import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, Square, Play, Pause, Trash2, Star, Phone, Plus, X, 
  Volume2, Clock, Check, AlertCircle, Download, Upload
} from 'lucide-react';
import { backendAPI } from '../services/BackendAPI';

interface Voicemail {
  id: string;
  name: string;
  description?: string;
  audioData: string;
  duration: number;
  isDefault: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface VoicemailManagerProps {
  onSelect?: (voicemail: Voicemail) => void;
  selectionMode?: boolean;
  compact?: boolean;
}

export const VoicemailManager: React.FC<VoicemailManagerProps> = ({ 
  onSelect, 
  selectionMode = false,
  compact = false 
}) => {
  const [voicemails, setVoicemails] = useState<Voicemail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [newVoicemailName, setNewVoicemailName] = useState('');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  
  // Playback state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState<Record<string, number>>({});
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    loadVoicemails();
    return () => {
      // Cleanup
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const loadVoicemails = async () => {
    try {
      setLoading(true);
      const data = await backendAPI.getVoicemails();
      setVoicemails(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load voicemails:', err);
      setError('Failed to load voicemails');
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(audioBlob);
        setRecordedUrl(URL.createObjectURL(audioBlob));
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to access microphone. Please grant permission.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const saveVoicemail = async () => {
    if (!recordedBlob || !newVoicemailName.trim()) {
      setError('Please enter a name for your voicemail');
      return;
    }

    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        
        await backendAPI.createVoicemail({
          name: newVoicemailName.trim(),
          audioData: base64Audio,
          duration: recordingTime
        });
        
        setSuccess('Voicemail saved successfully!');
        setShowRecordModal(false);
        resetRecording();
        loadVoicemails();
        
        setTimeout(() => setSuccess(null), 3000);
      };
      reader.readAsDataURL(recordedBlob);
    } catch (err) {
      console.error('Failed to save voicemail:', err);
      setError('Failed to save voicemail');
    }
  };

  const resetRecording = () => {
    setRecordedBlob(null);
    setRecordedUrl(null);
    setNewVoicemailName('');
    setRecordingTime(0);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
  };

  const deleteVoicemail = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this voicemail?')) return;
    
    try {
      await backendAPI.deleteVoicemail(id);
      setVoicemails(prev => prev.filter(v => v.id !== id));
      setSuccess('Voicemail deleted');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to delete voicemail:', err);
      setError('Failed to delete voicemail');
    }
  };

  const setAsDefault = async (id: string) => {
    try {
      await backendAPI.setDefaultVoicemail(id);
      setVoicemails(prev => prev.map(v => ({
        ...v,
        isDefault: v.id === id
      })));
      setSuccess('Default voicemail updated');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to set default:', err);
      setError('Failed to update default voicemail');
    }
  };

  const playVoicemail = async (voicemail: Voicemail) => {
    try {
      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      
      if (playingId === voicemail.id) {
        setPlayingId(null);
        return;
      }

      // Use audioData from voicemail
      const audioData = voicemail.audioData;
      
      if (!audioData) {
        setError('No audio data found');
        return;
      }

      const audio = new Audio(audioData);
      audioRef.current = audio;
      
      audio.onended = () => {
        setPlayingId(null);
        setPlaybackProgress(prev => ({ ...prev, [voicemail.id]: 0 }));
      };
      
      audio.ontimeupdate = () => {
        const progress = (audio.currentTime / audio.duration) * 100;
        setPlaybackProgress(prev => ({ ...prev, [voicemail.id]: progress }));
      };
      
      audio.play();
      setPlayingId(voicemail.id);
    } catch (err) {
      console.error('Failed to play voicemail:', err);
      setError('Failed to play voicemail');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Compact mode for PowerDialer sidebar
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Voicemail</span>
          <button
            onClick={() => setShowRecordModal(true)}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Plus size={12} />
            New
          </button>
        </div>
        
        <select 
          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
          onChange={(e) => {
            const selected = voicemails.find(v => v.id === e.target.value);
            if (selected && onSelect) onSelect(selected);
          }}
        >
          <option value="">No voicemail</option>
          {voicemails.map(vm => (
            <option key={vm.id} value={vm.id}>
              {vm.name} {vm.isDefault ? '(Default)' : ''} - {formatDuration(vm.duration)}
            </option>
          ))}
        </select>

        {/* Record Modal */}
        {showRecordModal && (
          <RecordModal 
            isOpen={showRecordModal}
            onClose={() => { setShowRecordModal(false); resetRecording(); }}
            isRecording={isRecording}
            recordingTime={recordingTime}
            recordedUrl={recordedUrl}
            newVoicemailName={newVoicemailName}
            setNewVoicemailName={setNewVoicemailName}
            startRecording={startRecording}
            stopRecording={stopRecording}
            saveVoicemail={saveVoicemail}
            resetRecording={resetRecording}
          />
        )}
      </div>
    );
  }

  // Full management view
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Voicemail Messages</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Record and manage voicemails for drop during calls</p>
        </div>
        <button
          onClick={() => setShowRecordModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
        >
          <Mic size={16} />
          Record New
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={14} />
          </button>
        </div>
      )}
      
      {success && (
        <div className="mx-4 mt-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg flex items-center gap-2">
          <Check size={16} />
          {success}
        </div>
      )}

      {/* Voicemail List */}
      <div className="p-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-gray-500">Loading voicemails...</p>
          </div>
        ) : voicemails.length === 0 ? (
          <div className="text-center py-12">
            <Volume2 size={48} className="mx-auto text-gray-400 mb-4" />
            <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No voicemails yet</h4>
            <p className="text-gray-500 dark:text-gray-400 mb-4">Record your first voicemail message to drop during calls</p>
            <button
              onClick={() => setShowRecordModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
            >
              Record Your First Voicemail
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {voicemails.map(voicemail => (
              <div 
                key={voicemail.id}
                className={`p-4 rounded-lg border ${
                  voicemail.isDefault 
                    ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20' 
                    : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50'
                } ${selectionMode ? 'cursor-pointer hover:border-blue-400' : ''}`}
                onClick={() => selectionMode && onSelect && onSelect(voicemail)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Play/Pause button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); playVoicemail(voicemail); }}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
                        playingId === voicemail.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-500'
                      }`}
                    >
                      {playingId === voicemail.id ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">{voicemail.name}</h4>
                        {voicemail.isDefault && (
                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs rounded-full flex items-center gap-1">
                            <Star size={10} fill="currentColor" />
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {formatDuration(voicemail.duration)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone size={12} />
                          Used {voicemail.usageCount} times
                        </span>
                        <span>{formatDate(voicemail.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {!voicemail.isDefault && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setAsDefault(voicemail.id); }}
                        className="p-2 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-lg transition"
                        title="Set as default"
                      >
                        <Star size={18} />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteVoicemail(voicemail.id); }}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                {/* Playback progress bar */}
                {playingId === voicemail.id && (
                  <div className="mt-3 h-1 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 transition-all duration-100"
                      style={{ width: `${playbackProgress[voicemail.id] || 0}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Record Modal */}
      {showRecordModal && (
        <RecordModal 
          isOpen={showRecordModal}
          onClose={() => { setShowRecordModal(false); resetRecording(); }}
          isRecording={isRecording}
          recordingTime={recordingTime}
          recordedUrl={recordedUrl}
          newVoicemailName={newVoicemailName}
          setNewVoicemailName={setNewVoicemailName}
          startRecording={startRecording}
          stopRecording={stopRecording}
          saveVoicemail={saveVoicemail}
          resetRecording={resetRecording}
        />
      )}
    </div>
  );
};

// Record Modal Component
interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRecording: boolean;
  recordingTime: number;
  recordedUrl: string | null;
  newVoicemailName: string;
  setNewVoicemailName: (name: string) => void;
  startRecording: () => void;
  stopRecording: () => void;
  saveVoicemail: () => void;
  resetRecording: () => void;
}

const RecordModal: React.FC<RecordModalProps> = ({
  isOpen,
  onClose,
  isRecording,
  recordingTime,
  recordedUrl,
  newVoicemailName,
  setNewVoicemailName,
  startRecording,
  stopRecording,
  saveVoicemail,
  resetRecording
}) => {
  if (!isOpen) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Voicemail</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {/* Recording indicator or recorded audio */}
          {isRecording ? (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Mic size={32} className="text-red-600" />
              </div>
              <p className="text-2xl font-mono text-gray-900 dark:text-white mb-2">
                {formatTime(recordingTime)}
              </p>
              <p className="text-sm text-gray-500">Recording...</p>
            </div>
          ) : recordedUrl ? (
            <div className="mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Preview your recording:</p>
              <audio controls src={recordedUrl} className="w-full" />
              <p className="text-sm text-gray-500 mt-2">Duration: {formatTime(recordingTime)}</p>
            </div>
          ) : (
            <div className="text-center py-4 mb-4">
              <p className="text-gray-600 dark:text-gray-400">
                Record a new voicemail within the browser.
              </p>
              <p className="text-sm text-blue-600 mt-1 cursor-pointer hover:underline">
                Record with your phone instead.
              </p>
            </div>
          )}

          {/* Voicemail name input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Voicemail name
            </label>
            <input
              type="text"
              value={newVoicemailName}
              onChange={(e) => setNewVoicemailName(e.target.value)}
              placeholder="My voicemail"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 font-medium transition"
            >
              Cancel
            </button>
            
            {isRecording ? (
              <button
                onClick={stopRecording}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition"
              >
                <Square size={16} fill="currentColor" />
                Stop
              </button>
            ) : recordedUrl ? (
              <>
                <button
                  onClick={resetRecording}
                  className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 font-medium transition"
                >
                  Re-record
                </button>
                <button
                  onClick={saveVoicemail}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition"
                >
                  <Check size={16} />
                  Save
                </button>
              </>
            ) : (
              <button
                onClick={startRecording}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition"
              >
                <Mic size={16} />
                Record
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoicemailManager;
