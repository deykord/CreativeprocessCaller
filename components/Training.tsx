import React, { useState, useEffect, useRef } from 'react';
import { 
  GraduationCap, CheckCircle, XCircle, Loader2, Key, RefreshCw, 
  Target, Shield, DollarSign, Clock, Users, MessageSquare, Play,
  Award, TrendingUp, FileText, Phone, AlertCircle
} from 'lucide-react';
import { backendAPI } from '../services/BackendAPI';

// Declare Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Training scenario types
interface TrainingScenario {
  id: string;
  name: string;
  description: string;
  category: 'cold-call' | 'gatekeeper' | 'objection';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number;
}

// Training scenarios will be loaded from admin settings
// Pre-built scenarios have been removed - admins can create custom scenarios
const SCENARIOS: TrainingScenario[] = [];

// Voice option type
interface VoiceOption {
  id: string;
  name: string;
  description: string;
  gender: string;
}

// Training session history type
interface TrainingSession {
  id: string;
  scenario_id: string;
  scenario_name: string;
  voice_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  message_count: number;
  score: number | null;
}

const Training: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  
  // Separate status for each provider
  const [openaiStatus, setOpenaiStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
  const [elevenLabsStatus, setElevenLabsStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
  const [openaiMessage, setOpenaiMessage] = useState('Not checked');
  const [elevenLabsMessage, setElevenLabsMessage] = useState('Not checked');
  
  const [selectedScenario, setSelectedScenario] = useState<TrainingScenario | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'cold-call' | 'gatekeeper' | 'objection'>('all');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [callInProgress, setCallInProgress] = useState(false);
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [userTranscript, setUserTranscript] = useState('');
  const [shouldListen, setShouldListen] = useState(false);
  const [conversationSessionId, setConversationSessionId] = useState<string | null>(null);
  
  // Ref to always have latest session ID in closures
  const sessionIdRef = useRef<string | null>(null);
  
  // Voice and history state
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('pNInz6obpgDQGcFmaJgB'); // Adam voice (ElevenLabs)
  const [trainingHistory, setTrainingHistory] = useState<TrainingSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const isPlayingRef = useRef(false);

  // Keep sessionIdRef in sync with state
  useEffect(() => {
    sessionIdRef.current = conversationSessionId;
    console.log('🔄 Session ID ref updated:', conversationSessionId);
  }, [conversationSessionId]);

  // Load current API key status and voices on mount
  useEffect(() => {
    checkConnection();
    loadVoices();
    loadHistory();
  }, []);

  const loadVoices = async () => {
    try {
      const apiUrl = window.location.origin.replace(':5173', ':3001') + '/api/training/voices';
      const response = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableVoices(data.voices);
        console.log('🔊 Loaded voices:', data.voices.length);
      }
    } catch (error) {
      console.error('Failed to load voices:', error);
      // Fallback ElevenLabs voices
      setAvailableVoices([
        { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', description: 'Deep, authoritative male', gender: 'male' },
        { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', description: 'Soft, warm female', gender: 'female' },
        { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'Well-rounded male', gender: 'male' },
        { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', description: 'Young, energetic female', gender: 'female' },
        { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', description: 'Professional male', gender: 'male' },
        { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', description: 'Crisp, confident male', gender: 'male' },
        { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy', description: 'Pleasant female', gender: 'female' },
        { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill', description: 'Trustworthy male', gender: 'male' }
      ]);
    }
  };

  const loadHistory = async () => {
    try {
      const apiUrl = window.location.origin.replace(':5173', ':3001') + '/api/training/ai-sessions/history';
      const response = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTrainingHistory(data.sessions || []);
        console.log('📜 Loaded training history:', data.sessions?.length || 0);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const checkConnection = async () => {
    setLoading(true);
    setOpenaiStatus('checking');
    setElevenLabsStatus('checking');
    setOpenaiMessage('Checking...');
    setElevenLabsMessage('Checking...');
    
    try {
      const response = await backendAPI.getTrainingProviderStatus();
      const hasElevenLabs = response && response.elevenlabs;
      const hasOpenAI = response && response.openai;
      
      // Set OpenAI status
      if (hasOpenAI) {
        setOpenaiStatus('connected');
        setOpenaiMessage('Connected - AI conversation logic ready');
      } else {
        setOpenaiStatus('error');
        setOpenaiMessage('Not configured - needed for AI responses');
      }
      
      // Set ElevenLabs status
      if (hasElevenLabs) {
        setElevenLabsStatus('connected');
        setElevenLabsMessage('Connected - Voice synthesis ready');
      } else {
        setElevenLabsStatus('error');
        setElevenLabsMessage('Not configured - needed for realistic voices');
      }
      
      // Set overall status
      if (hasElevenLabs && hasOpenAI) {
        setTestStatus('success');
        setStatusMessage('Both providers ready');
      } else if (hasElevenLabs || hasOpenAI) {
        setTestStatus('error');
        setStatusMessage('Partial configuration - both providers needed');
      } else {
        setTestStatus('error');
        setStatusMessage('No providers configured');
      }
    } catch (error: any) {
      console.error('Failed to check API key status:', error);
      setOpenaiStatus('error');
      setElevenLabsStatus('error');
      setOpenaiMessage('Connection check failed');
      setElevenLabsMessage('Connection check failed');
      setTestStatus('error');
      setStatusMessage(error.message || 'Unable to verify connection');
    } finally {
      setLoading(false);
    }
  };

  const filteredScenarios = categoryFilter === 'all' 
    ? SCENARIOS 
    : SCENARIOS.filter(s => s.category === categoryFilter);

  const getCategoryIcon = (category: string) => {
    switch(category) {
      case 'cold-call': return <Phone size={18} />;
      case 'gatekeeper': return <Shield size={18} />;
      case 'objection': return <Target size={18} />;
      default: return <GraduationCap size={18} />;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch(difficulty) {
      case 'beginner': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
      case 'intermediate': return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20';
      case 'advanced': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  // Timer effect for active sessions
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSessionActive && sessionStartTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - sessionStartTime.getTime()) / 1000);
        setSessionDuration(elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isSessionActive, sessionStartTime]);

  const startTrainingSession = async (scenario: TrainingScenario) => {
    if (!scenario) return;
    
    setLoading(true);
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      setMicPermission('granted');
      mediaStreamRef.current = stream;
      
      // Set the selected scenario
      setSelectedScenario(scenario);
      console.log('✅ Scenario set:', scenario.name);
      
      // Clear any previous session ID first - ensures fresh start
      setConversationSessionId(null);
      sessionIdRef.current = null; // Clear ref too
      console.log('🔄 Cleared previous session, starting fresh...');
      
      // Create DB session for history tracking
      let newSessionId: string | null = null;
      try {
        const apiUrl = window.location.origin.replace(':5173', ':3001') + '/api/training/ai-sessions/start';
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({
            scenarioId: scenario.id,
            scenarioName: scenario.name,
            voiceId: selectedVoice
          })
        });
        if (response.ok) {
          const data = await response.json();
          newSessionId = data.sessionId;
          setConversationSessionId(data.sessionId);
          sessionIdRef.current = data.sessionId; // Update ref immediately for closures
          console.log('📝 Created NEW fresh session:', data.sessionId);
        }
      } catch (dbError) {
        console.error('Failed to create DB session (continuing):', dbError);
      }
      
      // Start the training session
      setIsSessionActive(true);
      setSessionStartTime(new Date());
      setSessionDuration(0);
      setCallInProgress(true);
      
      // Start real-time session (uses the newSessionId we just created)
      await startRealtimeSession(scenario, stream);
      
    } catch (error: any) {
      console.error('Failed to start training session:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setMicPermission('denied');
        alert('Microphone permission is required for training sessions. Please allow microphone access and try again.');
      } else {
        alert('Failed to start training session. Please try again.');
      }
      setIsSessionActive(false);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = (scenario: TrainingScenario): string => {
    // Default greeting - custom scenarios can be configured via admin settings
    return "Hello, how can I help you?";
  };

  // Audio player reference for OpenAI TTS
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const speakAIResponse = async (text: string, scenario: TrainingScenario) => {
    if (!text || text.trim().length === 0) return;
    
    console.log('🤖 AI speaking:', text);
    setIsAISpeaking(true);
    
    // Stop any current listening
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }

    // Stop any currently playing audio
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    
    try {
      // Call OpenAI TTS API through backend
      const apiUrl = window.location.origin.replace(':5173', ':3001') + '/api/training/text-to-speech';
      console.log('🔊 Calling OpenAI TTS with voice:', selectedVoice);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          text: text,
          scenario: scenario.id,
          voice: selectedVoice,  // Use user-selected voice
          sessionId: sessionIdRef.current  // Use ref for latest session ID
        })
      });

      if (!response.ok) {
        throw new Error('TTS API failed');
      }

      // Get audio blob and play it
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      
      audio.onplay = () => {
        console.log('🔊 AI started speaking (OpenAI TTS)');
        setIsAISpeaking(true);
      };
      
      audio.onended = () => {
        console.log('✅ AI finished speaking - YOUR TURN!');
        setIsAISpeaking(false);
        URL.revokeObjectURL(audioUrl);
        
        // Start listening after AI finishes
        console.log('🎤 Starting microphone...');
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
            console.log('✅ Microphone is now listening!');
          } catch(e) {
            console.error('Failed to start mic:', e);
          }
        }
      };
      
      audio.onerror = (error) => {
        console.error('❌ Audio playback error:', error);
        setIsAISpeaking(false);
        URL.revokeObjectURL(audioUrl);
        // Fallback to browser TTS
        fallbackToWebSpeech(text, scenario);
      };
      
      await audio.play();
      
    } catch (error) {
      console.error('❌ OpenAI TTS failed, falling back to browser TTS:', error);
      fallbackToWebSpeech(text, scenario);
    }
  };

  // Fallback to browser's Web Speech API if OpenAI TTS fails
  const fallbackToWebSpeech = (text: string, scenario: TrainingScenario) => {
    const utterance = new SpeechSynthesisUtterance(text);
    
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.lang.startsWith('en-US') && (v.name.includes('Google') || v.name.includes('Microsoft'))
    ) || voices.find(v => v.lang.startsWith('en-US')) || voices[0];
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    utterance.onend = () => {
      setIsAISpeaking(false);
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch(e) {}
      }
    };
    
    utterance.onerror = () => {
      setIsAISpeaking(false);
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch(e) {}
      }
    };
    
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const startRealtimeSession = async (scenario: TrainingScenario, stream: MediaStream) => {
    try {
      console.log('🎙️ Starting real-time voice training session...');
      console.log('📋 Scenario:', scenario.name);
      console.log('📝 Using session ID:', conversationSessionId);
      
      // DON'T clear the session ID - it was already set by startTrainingSession
      
      // Initialize speech recognition
      startSpeechRecognition(scenario);
      
      // AI speaks first with greeting (uses OpenAI TTS now)
      setTimeout(() => {
        speakAIResponse(getGreeting(scenario), scenario);
      }, 800);
      
    } catch (error: any) {
      console.error('❌ Failed to start session:', error);
      alert(`Failed to start training: ${error.message}`);
      setIsSessionActive(false);
      throw error;
    }
  };

  const OLD_startRealtimeSession_WEBSOCKET = async (scenario: TrainingScenario, stream: MediaStream) => {
    try {
      console.log('🌐 Connecting to OpenAI Realtime API via WebSocket...');
      
      // Get temporary token from backend
      console.log('📡 Fetching realtime token from backend...');
      const tokenResponse = await fetch(window.location.origin.replace(':5173', ':3001') + '/api/training/realtime-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ scenario: scenario.id })
      });
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('❌ Token fetch failed:', tokenResponse.status, errorText);
        throw new Error(`Failed to get realtime token: ${tokenResponse.status} - ${errorText}`);
      }
      
      console.log('✅ Token received from backend');
      
      const { token, sessionConfig } = await tokenResponse.json();
      
      // Connect to OpenAI Realtime API with authorization
      const ws = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`,
        ['realtime', `openai-insecure-api-key.${token}`, 'openai-beta.realtime-v1']
      );
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('✅ WebSocket connected to OpenAI Realtime API');
        
        // Configure the session
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: sessionConfig.instructions,
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1'
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500
            },
            temperature: 0.8
          }
        }));
        
        console.log('📤 Session configuration sent');
        
        // Trigger AI to speak first (greeting)
        setTimeout(() => {
          console.log('📣 Requesting AI greeting...');
          ws.send(JSON.stringify({
            type: 'response.create',
            response: {
              modalities: ['audio', 'text'],
              instructions: 'Greet the user briefly as if answering their phone call. Be natural and stay in character.'
            }
          }));
        }, 500);
        
        // Start streaming audio from microphone
        setupAudioStreaming(stream, ws);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleRealtimeEvent(data);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        alert('WebSocket connection error. Check console for details.');
      };
      
      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        if (!event.wasClean) {
          alert(`Connection closed unexpectedly: ${event.reason || 'Unknown reason'}`);
        }
      };
      
    } catch (error: any) {
      console.error('❌ Failed to start realtime session:', error);
      const errorMsg = error.message || error.toString();
      alert(`Failed to connect to AI: ${errorMsg}\n\nCheck browser console for details.`);
      setIsSessionActive(false);
      throw error; // Re-throw so parent catch can handle it
    }
  };

  const setupAudioStreaming = (stream: MediaStream, ws: WebSocket) => {
    const audioContext = new AudioContext({ sampleRate: 24000 });
    audioContextRef.current = audioContext;
    
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (e) => {
      // Send microphone data continuously - server VAD handles turn detection
      if (ws.readyState === WebSocket.OPEN && !isMuted) {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
        
        ws.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: base64Audio
        }));
      }
    };
    
    source.connect(processor);
    // DO NOT connect processor to destination - this creates feedback loop!
    // processor.connect(audioContext.destination);
    
    console.log('🎤 Audio streaming setup complete (no feedback loop)');
  };

  const handleRealtimeEvent = (event: any) => {
    console.log('📩 Realtime event:', event.type, event);
    
    switch (event.type) {
      case 'session.created':
        console.log('✅ Session created:', event.session);
        break;
        
      case 'session.updated':
        console.log('✅ Session updated:', event.session);
        break;
        
      case 'response.audio.delta':
        // Play audio chunk from AI
        console.log('🔊 Received audio delta, length:', event.delta?.length);
        playAudioChunk(event.delta);
        setIsAISpeaking(true);
        break;
        
      case 'response.audio.done':
        setIsAISpeaking(false);
        console.log('✅ AI finished speaking');
        break;
        
      case 'response.audio_transcript.delta':
        console.log('🤖 AI saying:', event.delta);
        break;
        
      case 'response.text.delta':
        // Update transcript if needed
        console.log('📝 Text delta:', event.delta);
        setUserTranscript(prev => prev + event.delta);
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        console.log('👤 You said:', event.transcript);
        setUserTranscript(event.transcript);
        break;
        
      case 'input_audio_buffer.speech_started':
        console.log('🎤 User started speaking');
        setIsAISpeaking(false); // Stop any AI speech when user talks
        break;
        
      case 'input_audio_buffer.speech_stopped':
        console.log('🎤 User stopped speaking - committing audio');
        // Commit the audio buffer so AI can process and respond
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'input_audio_buffer.commit'
          }));
          // Request AI response
          wsRef.current.send(JSON.stringify({
            type: 'response.create'
          }));
        }
        break;
        
      case 'error':
        console.error('❌ Realtime API error:', event.error);
        alert(`Error: ${event.error?.message || 'Unknown error'}`);
        break;
    }
  };

  const playAudioChunk = (base64Audio: string) => {
    if (!audioContextRef.current) {
      console.warn('⚠️ No audio context available');
      return;
    }
    
    if (!base64Audio) {
      console.warn('⚠️ No audio data to play');
      return;
    }
    
    try {
      // Decode base64 to PCM16
      const audioData = atob(base64Audio);
      const arrayBuffer = new ArrayBuffer(audioData.length);
      const view = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < audioData.length; i++) {
        view[i] = audioData.charCodeAt(i);
      }
      
      // Convert PCM16 to Float32
      const int16Array = new Int16Array(arrayBuffer);
      const float32Array = new Float32Array(int16Array.length);
      
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7FFF);
      }
      
      // Create audio buffer (mono, 24kHz sample rate)
      const audioBuffer = audioContextRef.current.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);
      
      // Create and play source
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      // Track when audio finishes
      source.onended = () => {
        const index = audioQueueRef.current.indexOf(source);
        if (index > -1) {
          audioQueueRef.current.splice(index, 1);
        }
        if (audioQueueRef.current.length === 0) {
          isPlayingRef.current = false;
          console.log('✅ All audio finished playing');
        }
      };
      
      audioQueueRef.current.push(source);
      source.start();
      isPlayingRef.current = true;
      
    } catch (error) {
      console.error('❌ Error playing audio:', error);
    }
  };

  const startSpeechRecognition = (scenario: TrainingScenario) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;  // Keep listening continuously
    recognition.interimResults = true;  // Get results as user speaks
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('✅ Speech recognition started - speak now!');
    };

    recognition.onresult = async (event: any) => {
      // Get the latest result
      const resultIndex = event.resultIndex;
      const result = event.results[resultIndex];
      const transcript = result[0].transcript.trim();
      
      console.log('🎤 Speech captured:', transcript, 'isFinal:', result.isFinal);
      
      // Only process final results (when user stops speaking)
      if (!result.isFinal) {
        console.log('📝 Interim result, waiting for final...');
        return;
      }
      
      if (transcript.length < 3) {
        console.log('⚠️ Speech too short, continuing to listen...');
        return;
      }
      
      console.log('👤 User said (final):', transcript);
      console.log('🎯 Current scenario:', scenario.name);
      setUserTranscript(transcript);
      
      // Stop listening while processing
      stopListening();
      
      // Generate AI response immediately
      console.log('📝 Generating AI response...');
      try {
        const aiResponse = await generateAIResponse(transcript, scenario);
        
        // Speak the response
        if (aiResponse) {
          console.log('🔊 Speaking AI response:', aiResponse);
          speakAIResponse(aiResponse, scenario);
        } else {
          console.error('❌ No AI response received');
          if (isSessionActive) {
            setTimeout(() => startListening(), 1000);
          }
        }
      } catch (error) {
        console.error('❌ Error in speech handling:', error);
        if (isSessionActive) {
          setTimeout(() => startListening(), 1000);
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('❌ Speech recognition error:', event.error);
      
      // If error is 'no-speech', just restart listening
      if (event.error === 'no-speech') {
        console.log('⚠️ No speech detected, restarting...');
        if (isSessionActive && !isAISpeaking) {
          setTimeout(() => startListening(), 500);
        }
      } else {
        console.error('Speech recognition failed:', event.error);
        setShouldListen(false);
      }
    };

    recognition.onend = () => {
      console.log('🔇 Recognition ended');
      // Only restart if explicitly told to
      if (shouldListen && !isAISpeaking && isSessionActive && !isMuted) {
        console.log('🔄 Restarting recognition because shouldListen is true');
        setTimeout(() => {
          try {
            recognitionRef.current?.start();
          } catch (e) {
            console.log('Could not restart:', e);
          }
        }, 300);
      }
    };

    recognitionRef.current = recognition;
  };

  const startListening = () => {
    if (!recognitionRef.current) return;
    
    setShouldListen(true);
    try {
      recognitionRef.current.start();
      console.log('🎤 Microphone is listening...');
    } catch (e) {
      console.error('Failed to start recognition:', e);
    }
  };

  const stopListening = () => {
    setShouldListen(false);
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        console.log('🛑 Stopped listening');
      }
    } catch (e) {}
  };

  const generateAIResponse = async (userText: string, scenario: TrainingScenario) => {
    console.log('🤖 generateAIResponse called with:', userText, scenario.name);
    
    if (isAISpeaking) {
      console.log('⚠️ AI is already speaking, skipping...');
      return;
    }

    // Stop listening while AI talks
    stopListening();

    // Cancel any ongoing speech to avoid repetition
    window.speechSynthesis.cancel();

    // Default system prompt - custom scenarios should define their own prompts via admin settings
    const systemPrompt = scenario.description 
      ? `You are a prospect in a training scenario. Scenario: ${scenario.name}. ${scenario.description}. Keep responses realistic, brief (under 20 words), and conversational.`
      : "You are a neutral business contact in a phone conversation. Keep responses under 20 words.";

    let aiResponse = '';
    
    try {
      // Call OpenAI API for real-time response
      console.log('🌐 Calling backend API at: /api/training/generate-response');
      const apiUrl = window.location.origin.replace(':5173', ':3001') + '/api/training/generate-response';
      console.log('🌐 Full URL:', apiUrl);
      
      // Use ref for latest session ID value (closures capture stale state)
      const currentSessionId = sessionIdRef.current;
      console.log('📝 Using session ID from ref:', currentSessionId);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          userMessage: userText,
          systemPrompt: systemPrompt,
          scenario: scenario.id,
          sessionId: currentSessionId // Use ref value for latest session ID
        })
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API error response:', errorText);
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      aiResponse = data.response;
      
      // Save session ID for conversation continuity
      if (data.sessionId && !sessionIdRef.current) {
        setConversationSessionId(data.sessionId);
        sessionIdRef.current = data.sessionId; // Update ref immediately
        console.log('📝 New conversation session:', data.sessionId);
      }
      console.log('✅ Got AI response (message #' + (data.messageCount || '?') + '):', aiResponse);

    } catch (error) {
      console.error('❌ Failed to generate AI response:', error);
      
      // Simple fallback responses when AI is unavailable
      const fallbackResponses = [
        "I see. Tell me more about that.",
        "Interesting. Can you elaborate?",
        "Hmm, what else can you tell me?",
        "I understand. Go on.",
        "That's something to consider."
      ];
      
      aiResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
      console.log('⚠️ Using fallback response:', aiResponse);
    }
    
    // Return the response so caller can speak it
    return aiResponse;
  };



  const toggleMute = () => {
    if (!isMuted) {
      stopListening();
      setIsMuted(true);
    } else {
      setIsMuted(false);
      if (isSessionActive && !isAISpeaking) {
        startListening();
      }
    }
  };

  const endTrainingSession = async () => {
    // Stop speech synthesis and recognition
    window.speechSynthesis.cancel();
    stopListening();
    
    // Stop audio player
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    
    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    // Save session to DB
    if (conversationSessionId) {
      try {
        const apiUrl = window.location.origin.replace(':5173', ':3001') + '/api/training/ai-sessions/end';
        await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({
            sessionId: conversationSessionId,
            score: null,  // Could add a rating prompt
            feedback: null
          })
        });
        console.log('✅ Session saved to DB');
        // Reload history
        loadHistory();
      } catch (error) {
        console.error('Failed to save session:', error);
      }
    }
    
    setIsSessionActive(false);
    setCallInProgress(false);
    setIsAISpeaking(false);
    setSessionStartTime(null);
    setSessionDuration(0);
    setIsMuted(false);
    setUserTranscript('');
    setConversationSessionId(null);
    sessionIdRef.current = null; // Clear ref on end
    
    const minutes = Math.floor(sessionDuration / 60);
    const seconds = sessionDuration % 60;
    alert(`Training session completed!\n\nDuration: ${minutes}:${seconds.toString().padStart(2, '0')}\n\nYour performance has been recorded.`);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl">
            <GraduationCap size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {isSessionActive ? 'Training Session Active' : 'AI Training'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              {isSessionActive 
                ? `Training: ${selectedScenario?.name} • Duration: ${formatDuration(sessionDuration)}`
                : 'Practice your sales skills with AI-powered scenarios'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Active Session Interface */}
      {isSessionActive && selectedScenario && (
        <div className="mb-6 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl shadow-lg p-8 text-white">
          <div className="text-center mb-6">
            <div className="inline-block p-4 bg-white/20 rounded-full mb-4">
              <Phone size={48} />
            </div>
            <h2 className="text-2xl font-bold mb-2">{selectedScenario.name}</h2>
            <p className="text-purple-100 mb-4">{selectedScenario.description}</p>
            <div className="text-3xl font-mono font-bold mb-6">
              {formatDuration(sessionDuration)}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">📞 Call In Progress</h3>
              <div className="flex items-center gap-2">
                {isAISpeaking && (
                  <div className="flex items-center gap-2 bg-green-500/20 px-3 py-1 rounded-full">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-xs">AI Speaking</span>
                  </div>
                )}
                {callInProgress && !isAISpeaking && (
                  <div className="flex items-center gap-2 bg-blue-500/20 px-3 py-1 rounded-full">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    <span className="text-xs">Listening...</span>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2 text-sm text-purple-100">
              <p>✓ Your microphone is {isMuted ? 'muted' : 'active'}</p>
              <p>✓ AI prospect is listening and will respond</p>
              <p>✓ Speak naturally - practice your pitch and techniques</p>
              <p>✓ The AI will interact based on the scenario</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white/10 rounded-lg p-4 text-center">
              <div className="text-2xl mb-1">🎯</div>
              <div className="text-xs text-purple-100">Difficulty</div>
              <div className="font-semibold capitalize">{selectedScenario.difficulty}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4 text-center">
              <div className="text-2xl mb-1">⏱️</div>
              <div className="text-xs text-purple-100">Target Duration</div>
              <div className="font-semibold">~{selectedScenario.duration} min</div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={toggleMute}
              className={`px-6 py-4 rounded-xl font-semibold transition shadow-lg ${
                isMuted 
                  ? 'bg-red-500 text-white hover:bg-red-600' 
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {isMuted ? '🔇 Unmute' : '🎤 Mute'}
            </button>
            <button
              onClick={endTrainingSession}
              className="flex-1 px-6 py-4 bg-white text-purple-600 rounded-xl font-semibold hover:bg-purple-50 transition shadow-lg text-lg"
            >
              End Session & Get Feedback
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!isSessionActive && (
        <div className="space-y-6">
        {/* AI Providers Status Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">AI Providers Status</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Both services required for training</p>
            </div>
            <button
              onClick={checkConnection}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Check Status
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* OpenAI Status */}
            <div className={`relative overflow-hidden rounded-xl border-2 transition-all ${
              openaiStatus === 'connected' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' :
              openaiStatus === 'error' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
              openaiStatus === 'checking' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' :
              'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50'
            }`}>
              {/* Animated background for checking state */}
              {openaiStatus === 'checking' && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
              )}
              
              <div className="relative p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      openaiStatus === 'connected' ? 'bg-green-100 dark:bg-green-900/40' :
                      openaiStatus === 'error' ? 'bg-red-100 dark:bg-red-900/40' :
                      openaiStatus === 'checking' ? 'bg-blue-100 dark:bg-blue-900/40' :
                      'bg-gray-200 dark:bg-gray-600'
                    }`}>
                      <svg className={`w-6 h-6 ${
                        openaiStatus === 'connected' ? 'text-green-600 dark:text-green-400' :
                        openaiStatus === 'error' ? 'text-red-600 dark:text-red-400' :
                        openaiStatus === 'checking' ? 'text-blue-600 dark:text-blue-400' :
                        'text-gray-500'
                      }`} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white">OpenAI</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Conversation AI</p>
                    </div>
                  </div>
                  {openaiStatus === 'checking' && <Loader2 size={20} className="text-blue-500 animate-spin" />}
                  {openaiStatus === 'connected' && <CheckCircle size={24} className="text-green-500" />}
                  {openaiStatus === 'error' && <XCircle size={24} className="text-red-500" />}
                </div>
                <p className={`text-sm ${
                  openaiStatus === 'connected' ? 'text-green-700 dark:text-green-300' :
                  openaiStatus === 'error' ? 'text-red-700 dark:text-red-300' :
                  openaiStatus === 'checking' ? 'text-blue-700 dark:text-blue-300' :
                  'text-gray-600 dark:text-gray-400'
                }`}>
                  {openaiMessage}
                </p>
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Powers realistic prospect responses and objections</p>
                </div>
              </div>
            </div>

            {/* ElevenLabs Status */}
            <div className={`relative overflow-hidden rounded-xl border-2 transition-all ${
              elevenLabsStatus === 'connected' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' :
              elevenLabsStatus === 'error' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
              elevenLabsStatus === 'checking' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' :
              'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50'
            }`}>
              {/* Animated background for checking state */}
              {elevenLabsStatus === 'checking' && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
              )}
              
              <div className="relative p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      elevenLabsStatus === 'connected' ? 'bg-green-100 dark:bg-green-900/40' :
                      elevenLabsStatus === 'error' ? 'bg-red-100 dark:bg-red-900/40' :
                      elevenLabsStatus === 'checking' ? 'bg-blue-100 dark:bg-blue-900/40' :
                      'bg-gray-200 dark:bg-gray-600'
                    }`}>
                      <svg className={`w-6 h-6 ${
                        elevenLabsStatus === 'connected' ? 'text-green-600 dark:text-green-400' :
                        elevenLabsStatus === 'error' ? 'text-red-600 dark:text-red-400' :
                        elevenLabsStatus === 'checking' ? 'text-blue-600 dark:text-blue-400' :
                        'text-gray-500'
                      }`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" y1="19" x2="12" y2="23"/>
                        <line x1="8" y1="23" x2="16" y2="23"/>
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white">ElevenLabs</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Voice Synthesis</p>
                    </div>
                  </div>
                  {elevenLabsStatus === 'checking' && <Loader2 size={20} className="text-blue-500 animate-spin" />}
                  {elevenLabsStatus === 'connected' && <CheckCircle size={24} className="text-green-500" />}
                  {elevenLabsStatus === 'error' && <XCircle size={24} className="text-red-500" />}
                </div>
                <p className={`text-sm ${
                  elevenLabsStatus === 'connected' ? 'text-green-700 dark:text-green-300' :
                  elevenLabsStatus === 'error' ? 'text-red-700 dark:text-red-300' :
                  elevenLabsStatus === 'checking' ? 'text-blue-700 dark:text-blue-300' :
                  'text-gray-600 dark:text-gray-400'
                }`}>
                  {elevenLabsMessage}
                </p>
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Generates ultra-realistic prospect voices</p>
                </div>
              </div>
            </div>
          </div>

          {/* Overall Status Message */}
          {testStatus === 'success' && (
            <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500 rounded-full">
                  <CheckCircle size={20} className="text-white" />
                </div>
                <div>
                  <p className="font-semibold text-green-900 dark:text-green-100">All Systems Operational</p>
                  <p className="text-sm text-green-700 dark:text-green-300">Training sessions are ready to start with full AI capabilities</p>
                </div>
              </div>
            </div>
          )}
          
          {testStatus === 'error' && (openaiStatus === 'error' || elevenLabsStatus === 'error') && (
            <div className="mt-4 p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-orange-500 rounded-full">
                  <AlertCircle size={20} className="text-white" />
                </div>
                <div>
                  <p className="font-semibold text-orange-900 dark:text-orange-100">Configuration Required</p>
                  <p className="text-sm text-orange-700 dark:text-orange-300 mb-2">One or more AI providers need to be configured before starting training sessions.</p>
                  <a href="#" className="text-sm font-medium text-orange-600 dark:text-orange-400 hover:underline">Go to Training Setup →</a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Training Scenarios */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
          {/* Enhanced Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <GraduationCap size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Training Scenarios</h3>
                  <p className="text-purple-200 text-sm">Practice with AI-powered roleplay</p>
                </div>
              </div>
              {filteredScenarios.length > 0 && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as any)}
                  className="px-4 py-2 text-sm rounded-lg bg-white/10 backdrop-blur border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                >
                  <option value="all" className="text-gray-900">All Categories</option>
                  <option value="cold-call" className="text-gray-900">Cold Calls</option>
                  <option value="gatekeeper" className="text-gray-900">Gatekeepers</option>
                  <option value="objection" className="text-gray-900">Objections</option>
                </select>
              )}
            </div>
          </div>

          <div className="p-6">
            {/* Empty State */}
            {filteredScenarios.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-2xl mb-4">
                  <GraduationCap size={32} className="text-purple-600 dark:text-purple-400" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Training Scenarios</h4>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
                  Training scenarios can be configured by administrators in the Training Settings section of the Admin Dashboard.
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg text-sm">
                  <Shield size={16} />
                  <span>Admin access required to create scenarios</span>
                </div>
              </div>
            ) : (
              <>
                {/* Scenario Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredScenarios.map((scenario) => (
                    <div
                      key={scenario.id}
                      onClick={() => setSelectedScenario(scenario)}
                      className={`group relative p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                        selectedScenario?.id === scenario.id
                          ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 shadow-md'
                          : 'border-gray-200 dark:border-slate-600 hover:border-purple-300 dark:hover:border-purple-600 bg-white dark:bg-slate-700/50'
                      }`}
                    >
                      {/* Selection indicator */}
                      {selectedScenario?.id === scenario.id && (
                        <div className="absolute -top-2 -right-2 p-1 bg-purple-500 rounded-full shadow-lg">
                          <CheckCircle size={16} className="text-white" />
                        </div>
                      )}
                      
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`p-2 rounded-lg ${
                          selectedScenario?.id === scenario.id 
                            ? 'bg-purple-500 text-white' 
                            : 'bg-gray-100 dark:bg-slate-600 text-gray-600 dark:text-gray-300 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 group-hover:text-purple-600 dark:group-hover:text-purple-400'
                        } transition-colors`}>
                          {getCategoryIcon(scenario.category)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 dark:text-white truncate">{scenario.name}</h4>
                          <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium mt-1 ${getDifficultyColor(scenario.difficulty)}`}>
                            {scenario.difficulty}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                        {scenario.description}
                      </p>
                      
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          ~{scenario.duration} min
                        </span>
                        {selectedScenario?.id === scenario.id && (
                          <span className="text-purple-600 dark:text-purple-400 font-medium">Selected</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {selectedScenario && testStatus === 'success' && (
            <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-200 dark:border-purple-700">
              <div className="flex flex-col gap-4">
                {/* Voice Selection */}
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    AI Voice:
                  </label>
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="flex-1 max-w-xs px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {availableVoices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name} - {voice.description} ({voice.gender})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white mb-1">
                      Ready to start: {selectedScenario.name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Estimated duration: {selectedScenario.duration} minutes
                    </p>
                  </div>
                  <button
                    onClick={() => startTrainingSession(selectedScenario)}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl font-medium transition shadow-lg hover:shadow-xl"
                  >
                    <Play size={20} />
                    Start Session
                  </button>
                </div>
              </div>
            </div>
          )}

          {testStatus !== 'success' && (
            <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-700">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                ⚠️ AI providers required to start training sessions. Please check the connection status above.
              </p>
            </div>
          )}
        </div>

        {/* Info Card */}
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl shadow-sm border border-purple-200 dark:border-purple-700 p-6">
          <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100 mb-3">About AI Training</h3>
          <div className="space-y-2 text-sm text-purple-700 dark:text-purple-300">
            <p>
              AI-powered voice training using OpenAI's GPT-4 Realtime API to help your sales team improve their skills.
            </p>
            <p className="font-medium">What you'll get:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Practice calls with realistic AI prospects</li>
              <li>Multiple difficulty levels and scenarios</li>
              <li>Instant performance feedback</li>
              <li>Track improvement over time</li>
            </ul>
            <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-700">
              <p className="font-medium mb-2">Available Scenarios:</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <Phone size={14} /> Cold Calls
                </div>
                <div className="flex items-center gap-1">
                  <Shield size={14} /> Gatekeepers
                </div>
                <div className="flex items-center gap-1">
                  <Target size={14} /> Objections
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Training History Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText size={20} />
              Training History
            </h3>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-sm text-purple-600 hover:text-purple-800 dark:text-purple-400"
            >
              {showHistory ? 'Hide' : 'Show All'}
            </button>
          </div>
          
          {trainingHistory.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No training sessions yet. Start your first session above!
            </p>
          ) : (
            <div className={`space-y-2 ${showHistory ? '' : 'max-h-48 overflow-hidden'}`}>
              {trainingHistory.slice(0, showHistory ? undefined : 3).map((session) => (
                <div 
                  key={session.id}
                  className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                      {session.scenario_name || session.scenario_id}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(session.started_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                    <span>🔊 {session.voice_id}</span>
                    <span>💬 {session.message_count} msgs</span>
                    {session.duration_seconds && (
                      <span>⏱️ {Math.floor(session.duration_seconds / 60)}m {session.duration_seconds % 60}s</span>
                    )}
                    {session.score && (
                      <span className="text-yellow-600">⭐ {session.score}/10</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      )}
    </div>
  );
};

export default Training;
