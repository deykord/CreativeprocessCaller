import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, Square, Play, Pause, Trash2, Star, Phone, Plus, X, 
  Volume2, Clock, Check, AlertCircle, Download, Upload, CheckSquare, Square as SquareIcon
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
  
  // Selection state for bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  
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

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === voicemails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(voicemails.map(v => v.id)));
    }
  };

  const deleteVoicemail = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this voicemail?')) return;
    
    try {
      await backendAPI.deleteVoicemail(id);
      setVoicemails(prev => prev.filter(v => v.id !== id));
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      setSuccess('Voicemail deleted');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to delete voicemail:', err);
      setError('Failed to delete voicemail');
    }
  };

  const deleteSelectedVoicemails = async () => {
    if (selectedIds.size === 0) return;
    
    const count = selectedIds.size;
    if (!window.confirm(`Are you sure you want to delete ${count} voicemail${count > 1 ? 's' : ''}?`)) return;
    
    setIsDeleting(true);
    try {
      const deletePromises = Array.from(selectedIds).map(id => 
        backendAPI.deleteVoicemail(id).catch(err => {
          console.error(`Failed to delete voicemail ${id}:`, err);
          return null;
        })
      );
      
      await Promise.all(deletePromises);
      
      setVoicemails(prev => prev.filter(v => !selectedIds.has(v.id)));
      setSelectedIds(new Set());
      setSuccess(`${count} voicemail${count > 1 ? 's' : ''} deleted`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to delete voicemails:', err);
      setError('Failed to delete some voicemails');
    } finally {
      setIsDeleting(false);
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
          <div>
            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {selectedIds.size} voicemail{selectedIds.size > 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={deleteSelectedVoicemails}
                  disabled={isDeleting}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg text-sm font-medium transition"
                >
                  {isDeleting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  Delete Selected
                </button>
              </div>
            )}
            
            {/* Voicemails Table */}
            <div className="overflow-x-auto border border-gray-200 dark:border-slate-700 rounded-lg">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left w-12">
                      <button
                        onClick={toggleSelectAll}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-600 transition"
                        title={selectedIds.size === voicemails.length ? 'Deselect all' : 'Select all'}
                      >
                        {selectedIds.size === voicemails.length ? (
                          <CheckSquare size={18} className="text-blue-600 dark:text-blue-400" />
                        ) : selectedIds.size > 0 ? (
                          <div className="w-[18px] h-[18px] border-2 border-blue-600 dark:border-blue-400 rounded bg-blue-600 dark:bg-blue-400 flex items-center justify-center">
                            <div className="w-2 h-0.5 bg-white"></div>
                          </div>
                        ) : (
                          <SquareIcon size={18} className="text-gray-400" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Play
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Usage
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                  {voicemails.map(voicemail => (
                    <tr 
                      key={voicemail.id}
                      className={`${
                        selectedIds.has(voicemail.id) 
                          ? 'bg-blue-50 dark:bg-blue-900/20' 
                          : voicemail.isDefault
                            ? 'bg-yellow-50/50 dark:bg-yellow-900/10'
                            : 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-750'
                      } ${selectionMode ? 'cursor-pointer' : ''}`}
                      onClick={() => selectionMode && onSelect && onSelect(voicemail)}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSelect(voicemail.id); }}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-600 transition"
                        >
                          {selectedIds.has(voicemail.id) ? (
                            <CheckSquare size={18} className="text-blue-600 dark:text-blue-400" />
                          ) : (
                            <SquareIcon size={18} className="text-gray-400" />
                          )}
                        </button>
                      </td>
                      
                      {/* Play Button */}
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); playVoicemail(voicemail); }}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
                            playingId === voicemail.id
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-500'
                          }`}
                        >
                          {playingId === voicemail.id ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                      </td>
                      
                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-white">{voicemail.name}</span>
                          {voicemail.isDefault && (
                            <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 text-xs rounded-full flex items-center gap-1">
                              <Star size={10} fill="currentColor" />
                              Default
                            </span>
                          )}
                        </div>
                        {/* Playback progress */}
                        {playingId === voicemail.id && (
                          <div className="mt-1 h-1 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden w-32">
                            <div 
                              className="h-full bg-blue-600 transition-all duration-100"
                              style={{ width: `${playbackProgress[voicemail.id] || 0}%` }}
                            />
                          </div>
                        )}
                      </td>
                      
                      {/* Duration */}
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                          <Clock size={14} />
                          {formatDuration(voicemail.duration)}
                        </span>
                      </td>
                      
                      {/* Usage */}
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                          <Phone size={14} />
                          {voicemail.usageCount} times
                        </span>
                      </td>
                      
                      {/* Created */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(voicemail.createdAt)}
                        </span>
                      </td>
                      
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {!voicemail.isDefault && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setAsDefault(voicemail.id); }}
                              className="p-2 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-lg transition"
                              title="Set as default"
                            >
                              <Star size={16} />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteVoicemail(voicemail.id); }}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
