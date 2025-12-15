import React, { useState, useEffect, useRef } from 'react';
import { 
  GraduationCap, CheckCircle, XCircle, Loader2, Key, RefreshCw, 
  Target, Shield, DollarSign, Clock, Users, MessageSquare, Play,
  Award, TrendingUp, FileText, Phone
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

// Available training scenarios - Professional & Realistic
const SCENARIOS: TrainingScenario[] = [
  // Cold Calls - Various Decision Maker Types
  { id: 'cold-cfo', name: 'CFO - Numbers Focused', description: 'CFO who only cares about ROI, cost savings, and hard data', category: 'cold-call', difficulty: 'advanced', duration: 8 },
  { id: 'cold-ceo', name: 'CEO - Strategic Thinker', description: 'CEO focused on big picture, competitive advantage, and growth', category: 'cold-call', difficulty: 'advanced', duration: 10 },
  { id: 'cold-it-director', name: 'IT Director - Technical', description: 'Technical decision maker asking about integrations and security', category: 'cold-call', difficulty: 'intermediate', duration: 8 },
  { id: 'cold-ops-manager', name: 'Operations Manager', description: 'Process-focused manager concerned about implementation and disruption', category: 'cold-call', difficulty: 'intermediate', duration: 7 },
  { id: 'cold-small-biz', name: 'Small Business Owner', description: 'Busy owner wearing many hats, skeptical of salespeople', category: 'cold-call', difficulty: 'beginner', duration: 5 },
  
  // Gatekeepers - Various Personalities
  { id: 'gk-executive-asst', name: 'Executive Assistant', description: 'Professional EA who protects boss\'s calendar fiercely', category: 'gatekeeper', difficulty: 'advanced', duration: 5 },
  { id: 'gk-receptionist', name: 'Front Desk Receptionist', description: 'Friendly but follows strict call screening protocol', category: 'gatekeeper', difficulty: 'intermediate', duration: 4 },
  { id: 'gk-voicemail', name: 'Voicemail Challenge', description: 'Practice leaving compelling voicemails that get callbacks', category: 'gatekeeper', difficulty: 'beginner', duration: 2 },
  
  // Objection Handling - Real World Scenarios
  { id: 'obj-budget-freeze', name: 'Budget Freeze', description: '"We\'ve frozen all new spending until next quarter"', category: 'objection', difficulty: 'advanced', duration: 6 },
  { id: 'obj-bad-experience', name: 'Bad Past Experience', description: '"We tried something similar and it was a disaster"', category: 'objection', difficulty: 'advanced', duration: 7 },
  { id: 'obj-committee', name: 'Committee Decision', description: '"I need to run this by my team/board first"', category: 'objection', difficulty: 'intermediate', duration: 5 },
  { id: 'obj-contract-locked', name: 'Locked In Contract', description: '"We\'re locked into a 2-year contract with our current vendor"', category: 'objection', difficulty: 'advanced', duration: 6 },
  { id: 'obj-no-need', name: 'No Perceived Need', description: '"Honestly, we\'re doing fine without this"', category: 'objection', difficulty: 'intermediate', duration: 5 },
  { id: 'obj-send-info', name: 'Send Me Info Brush-off', description: '"Just send me some information and I\'ll look at it"', category: 'objection', difficulty: 'beginner', duration: 4 },
];

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
  const [selectedVoice, setSelectedVoice] = useState<string>('alloy');
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
      // Fallback voices
      setAvailableVoices([
        { id: 'alloy', name: 'Alloy', description: 'Neutral, balanced', gender: 'neutral' },
        { id: 'echo', name: 'Echo', description: 'Warm, male', gender: 'male' },
        { id: 'fable', name: 'Fable', description: 'British, male', gender: 'male' },
        { id: 'onyx', name: 'Onyx', description: 'Deep, authoritative', gender: 'male' },
        { id: 'nova', name: 'Nova', description: 'Friendly, female', gender: 'female' },
        { id: 'shimmer', name: 'Shimmer', description: 'Soft, female', gender: 'female' }
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
    setTestStatus('testing');
    setStatusMessage('Checking OpenAI connection...');
    
    try {
      const response = await backendAPI.getTrainingProviderStatus();
      if (response && response.openai) {
        setTestStatus('success');
        setStatusMessage('OpenAI API is configured and ready');
      } else {
        setTestStatus('error');
        setStatusMessage('OpenAI API key is not configured. Please contact your administrator.');
      }
    } catch (error: any) {
      console.error('Failed to check API key status:', error);
      setTestStatus('error');
      setStatusMessage(error.message || 'Unable to verify connection. Please try again.');
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
    const greetings: Record<string, string> = {
      // Decision Makers - more natural, casual greetings
      'cold-cfo': "Yeah, this is David. I've got like 3 minutes, what's up?",
      'cold-ceo': "Michael Torres. I don't know this number... who's this?",
      'cold-it-director': "IT, James speaking. How'd you get this line?",
      'cold-ops-manager': "Hey, Sandra here. Is this a sales thing? I'm kinda swamped.",
      'cold-small-biz': "Yeah hello? Thompson Auto, this is Mike. Hang on... YEAH GIMME A SEC! Okay, what do you need?",
      
      // Gatekeepers
      'gk-executive-asst': "Mr. Harrison's office, this is Patricia. How can I help you?",
      'gk-receptionist': "Hi, thanks for calling Apex Industries! This is Jennifer. Who are you trying to reach?",
      'gk-voicemail': "Hey, you've reached Rob Martinez. Leave me a message and I'll get back to you. BEEP.",
      
      // Objection Scenarios - more conversational
      'obj-budget-freeze': "Oh yeah, I got your email. Look, I gotta be upfront, we froze all spending til Q2. CFO's orders.",
      'obj-bad-experience': "Oh, you're selling that? Yeah... we tried something like that about a year and a half ago. Total disaster honestly.",
      'obj-committee': "Okay so here's the thing. I might see value but, I can't decide this alone. Anything over 5K needs like three approvals.",
      'obj-contract-locked': "I appreciate you reaching out, but, we just renewed with Salesforce. Locked in for like 22 more months.",
      'obj-no-need': "Hmm, I'm not really sure why you're calling us? We've been fine for 15 years without this kind of thing.",
      'obj-send-info': "Yeah sure, just uh, send me something to my email? I'll look at it when I get a chance."
    };
    return greetings[scenario.id] || "Hello, how can I help you?";
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

    // Professional, realistic AI personas - DYNAMIC conversation, never repeat
    const systemPrompts: { [key: string]: string } = {
      // Decision Makers
      'cold-cfo': `You are David Chen, CFO. REAL phone call - sound completely human.

SPEECH PATTERN - USE THESE NATURALLY:
- Start some sentences with: "Look," "Honestly," "Well," "Okay," "I mean," "Here's the thing,"
- Occasionally: "Hmm," "Uh," "Let me think..." 
- React naturally: "Interesting..." "Okay, that's fair," "Alright," "Right, right"
- When skeptical: "Yeah, but..." "That sounds nice, but..." "Sure, in theory..."

CRITICAL RULES:
- NEVER repeat questions already answered
- Acknowledge what they said: "Okay, so you're saying..." before your point
- Progress: ROI → cost → timeline → risk → references
- Sound like you're actually thinking, not reading a script

PERSONALITY: Analytical, direct, busy. Been burned by vendors before.

Responses: 12-20 words. Conversational, not formal.`,
      
      'cold-ceo': `You are Michael Torres, CEO. REAL phone call - sound completely human.

SPEECH PATTERN - USE THESE:
- "Look," "Here's what I'm thinking," "Honestly," "The thing is,"
- When interested: "Okay, tell me more about that," "That's interesting, but..."
- When skeptical: "Yeah I've heard that before," "Everyone says that though"
- Thinking out loud: "Hmm, so if we did this..." "I'm wondering if..."

CRITICAL RULES:
- Never ask the same thing twice
- Acknowledge points: "Fair enough," "Okay I hear you," "Right,"
- Progress: strategy → differentiation → timing → who else is using it
- If bored: "Listen, I've got a meeting in 5..."

PERSONALITY: Visionary but skeptical of pitches.

Responses: 12-20 words. Sound like real CEO, not corporate script.`,
      
      'cold-it-director': `You are James, IT Director. REAL phone call.

SPEECH PATTERN:
- "So basically..." "From a technical standpoint..." "My concern is..."
- Curious: "Wait, how does that work exactly?" "That's interesting..."
- Skeptical: "Yeah but what about..." "Have you tested that with..."
- Technical pauses: "Hmm, let me think..." "So you're saying..."

CRITICAL RULES:
- Don't repeat security/integration questions if answered
- Progress: tech fit → security → integration → resources → timeline
- Show genuine interest if tech is good

PERSONALITY: Technical, careful, genuinely curious about good solutions.

Responses: 12-20 words.`,
      
      'cold-ops-manager': `You are Sandra, Operations Manager. REAL phone call.

SPEECH PATTERN:
- "The thing is..." "My worry is..." "Here's my concern,"
- Distracted: "Sorry, one sec... okay, where were we?"
- Practical: "Okay but in practice..." "How does that actually work?"
- Warming up: "Hmm, that could work..." "Okay, I'm listening..."

CRITICAL RULES:
- Don't repeat implementation questions if addressed
- Progress: disruption → training → team bandwidth → timeline → support
- Think out loud if solution sounds good

PERSONALITY: Practical, protective of team, open to real improvements.

Responses: 12-20 words. Sound busy but fair.`,
      
      'cold-small-biz': `You are Mike, owns an auto repair shop. On phone at work.

SPEECH PATTERN:
- "Yeah look," "Here's the deal," "I don't have time for..."
- Interruptions: "Hang on... YEAH I'LL BE RIGHT THERE... sorry, go ahead"
- Skeptical: "Yeah I've heard this before," "Sounds expensive"
- Direct: "Just tell me the price," "What's the catch?"

CRITICAL RULES:
- Don't ask about price twice if they told you
- Progress: cost → time → proof → how to start
- No BS - if they're wasting time, say so

PERSONALITY: Busy, practical, been ripped off before.

Responses: 8-15 words. Short, no corporate speak.`,
      
      // Gatekeepers
      'gk-executive-asst': `You are Patricia, Executive Assistant. REAL phone call.

SPEECH PATTERN:
- Professional but human: "I see," "Mm-hmm," "Okay..."
- Polite deflection: "I appreciate that, but..." "I understand, however..."
- Slight warming: "Well... let me see what I can do"
- Firm: "He really doesn't take unsolicited calls"

CRITICAL RULES:
- Don't ask who they're with twice
- Progress: company → purpose → relationship → why interrupt him → alternative
- If genuinely respectful, soften a tiny bit

PERSONALITY: Professional, protective, efficient. Heard every trick.

Responses: 10-18 words. Polished but human.`,
      
      'gk-receptionist': `You are Jennifer, front desk. REAL phone call.

SPEECH PATTERN:
- Friendly: "Hi there!" "Sure, one moment," "Let me check..."
- Helpful: "Hmm, let me see if..." "I can take a message if you'd like"
- Brief holds: "Can you hold on just one sec?... Okay I'm back"

CRITICAL RULES:
- Natural: who → company → what about → check/message
- Nice callers get more help
- You're doing your job, not gatekeeping

PERSONALITY: Pleasant, helpful, professional.

Responses: 8-15 words. Sound like a friendly receptionist.`,
      
      'gk-voicemail': `You are a voicemail system. After their message, give quick feedback:
- Score: X/10
- What worked
- What to improve
Keep under 30 words.`,
      
      // Objection Scenarios
      'obj-budget-freeze': `You are a dept head with REAL budget freeze. Phone call.

SPEECH PATTERN:
- Sympathetic: "I hear you," "Look, I get it," "Honestly..."
- Constrained: "My hands are really tied here," "It's not up to me"
- Considering: "Hmm, that's interesting..." "Well, if we could..."

CRITICAL RULES:
- Don't keep saying "budget freeze" - move forward
- Progress: constraints → creative solutions → timing
- If they offer pilots/deferred, genuinely think about it

PERSONALITY: Interested but stuck. Not making excuses.

Responses: 12-20 words.`,
      
      'obj-bad-experience': `You are someone BURNED by similar solution 18 months ago.

SPEECH PATTERN:
- Emotional: "Look, last time was a nightmare," "I still remember..."
- Skeptical: "Yeah, they said that too," "How is this different exactly?"
- Softening: "Okay... I'm listening," "That's... actually interesting"

CRITICAL RULES:
- Don't repeat the disaster story - you said it
- Progress: pain → how different → proof → maybe references
- If they genuinely address concerns, slowly soften

PERSONALITY: Scarred but not closed off. Want to believe.

Responses: 12-20 words.`,
      
      'obj-committee': `You need committee approval. REAL phone call.

SPEECH PATTERN:
- Collaborative: "Here's the thing..." "So the challenge is..."
- Thinking: "Hmm, if you could... that might help"
- Explaining: "So basically, procurement has to..." 

CRITICAL RULES:
- Don't repeat "need approval" - explain once, move on
- Progress: process → who's involved → how to help
- If they offer to help navigate, engage

PERSONALITY: Interested, constrained by process, collaborative.

Responses: 12-20 words.`,
      
      'obj-contract-locked': `You're locked in a contract. 22 months left. REAL call.

SPEECH PATTERN:
- Matter-of-fact: "Yeah, we just renewed" "It is what it is"
- Open to future: "I mean, down the road..." "Stay in touch though"
- Practical: "Doesn't make sense right now but..."

CRITICAL RULES:
- Don't repeat contract situation
- Progress: situation → future timing → stay connected
- Open to relationship building

PERSONALITY: Not hostile, practical, open to future.

Responses: 10-18 words.`,
      
      'obj-no-need': `You genuinely don't see why you need this. REAL call.

SPEECH PATTERN:
- Confused: "I mean... we're fine?" "What problem exactly?"
- Realizing: "Huh, I never thought about that..." "Wait, really?"
- Opening up: "Okay that's interesting..." "Tell me more about that"

CRITICAL RULES:
- If they uncover real pain, acknowledge it
- Progress: confusion → discovery → maybe they're right
- Good salespeople make you see hidden problems

PERSONALITY: Puzzled, not hostile, genuinely curious if they make sense.

Responses: 10-18 words.`,
      
      'obj-send-info': `You're trying to end the call politely. REAL call.

SPEECH PATTERN:
- Brushing off: "Yeah just... email me something" "I'll take a look"
- Accidentally engaged: "Wait, what do you mean by..." "Hmm, that's..."
- Surprised interest: "Actually... hold on" "Okay now I'm curious"

CRITICAL RULES:
- If good question, you engage despite yourself
- Progress: brush off → question hooks you → maybe interested
- "Send info" is escape route, but curiosity beats it

PERSONALITY: Distracted, half-listening, but can be drawn in.

Responses: 8-15 words.`
    };

    const systemPrompt = systemPrompts[scenario.id] || "You are a neutral business contact in a phone conversation. Keep responses under 20 words.";

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
      
      // Fallback responses based on scenario
      const fallbackResponses: { [key: string]: string[] } = {
        'cold-cfo': ["What's the ROI? Give me actual numbers.", "How does this impact our bottom line?", "What's the payback period?"],
        'cold-ceo': ["How does this differentiate us in the market?", "What's the strategic advantage here?", "I need to see the big picture."],
        'cold-it-director': ["What about security compliance?", "How does this integrate with our stack?", "What's the implementation timeline?"],
        'cold-ops-manager': ["How will this affect my team's workflow?", "What's the learning curve look like?", "We can't afford disruption right now."],
        'cold-small-biz': ["How much is this gonna cost me?", "I've got a customer waiting. Make it quick.", "I've heard this pitch before."],
        'gk-executive-asst': ["Mr. Harrison doesn't take unsolicited calls.", "Is this regarding an existing account?", "I'd suggest sending an email first."],
        'gk-receptionist': ["Let me take a message for you.", "They're in meetings all day.", "What company are you calling from?"],
        'gk-voicemail': ["Good message structure. Remember to create urgency.", "Try leaving a more specific reason to call back."],
        'obj-budget-freeze': ["I hear you, but my hands are really tied here.", "Maybe reach out again next quarter."],
        'obj-bad-experience': ["Last time was a disaster. Why would this be different?", "My team is still traumatized from that rollout."],
        'obj-committee': ["I need to run this by procurement first.", "Can't make this decision alone."],
        'obj-contract-locked': ["We literally just renewed two months ago.", "Breaking this contract would cost us 50K."],
        'obj-no-need': ["I'm honestly not sure what problem you're solving.", "We've done it this way for years."],
        'obj-send-info': ["Yeah, just email me something.", "I'll take a look when I get a chance."]
      };
      
      const responses = fallbackResponses[scenario.id] || ["I see. Tell me more."];
      aiResponse = responses[Math.floor(Math.random() * responses.length)];
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
        {/* Connection Status Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Connection Status</h3>
            <button
              onClick={checkConnection}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
          
          <div className={`flex items-center justify-between p-6 rounded-xl ${
            testStatus === 'success' ? 'bg-green-50 dark:bg-green-900/20' :
            testStatus === 'error' ? 'bg-red-50 dark:bg-red-900/20' :
            'bg-gray-50 dark:bg-gray-700/50'
          }`}>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${
                testStatus === 'success' ? 'bg-green-100 dark:bg-green-900/40' :
                testStatus === 'error' ? 'bg-red-100 dark:bg-red-900/40' :
                'bg-gray-200 dark:bg-gray-600'
              }`}>
                <Key size={28} className={
                  testStatus === 'success' ? 'text-green-600 dark:text-green-400' :
                  testStatus === 'error' ? 'text-red-600 dark:text-red-400' :
                  'text-gray-500'
                } />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white mb-1">OpenAI API</p>
                <p className={`text-sm ${
                  testStatus === 'success' ? 'text-green-700 dark:text-green-300' :
                  testStatus === 'error' ? 'text-red-700 dark:text-red-300' :
                  'text-gray-600 dark:text-gray-400'
                }`}>
                  {loading ? 'Checking...' : statusMessage}
                </p>
              </div>
            </div>
            {testStatus === 'testing' && (
              <Loader2 size={32} className="text-blue-500 animate-spin" />
            )}
            {testStatus === 'success' && !loading && (
              <CheckCircle size={32} className="text-green-500" />
            )}
            {testStatus === 'error' && !loading && (
              <XCircle size={32} className="text-red-500" />
            )}
          </div>

          {testStatus === 'success' && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                ✓ Your OpenAI API key is configured correctly and the connection is working.
              </p>
            </div>
          )}
        </div>

        {/* Training Scenarios */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Training Scenarios</h3>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Categories</option>
              <option value="cold-call">Cold Calls</option>
              <option value="gatekeeper">Gatekeepers</option>
              <option value="objection">Objections</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredScenarios.map((scenario) => (
              <div
                key={scenario.id}
                onClick={() => setSelectedScenario(scenario)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition ${
                  selectedScenario?.id === scenario.id
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(scenario.category)}
                    <h4 className="font-semibold text-gray-900 dark:text-white">{scenario.name}</h4>
                  </div>
                  {selectedScenario?.id === scenario.id && (
                    <CheckCircle size={20} className="text-purple-600 dark:text-purple-400" />
                  )}
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {scenario.description}
                </p>
                
                <div className="flex items-center justify-between text-xs">
                  <span className={`px-2 py-1 rounded-full font-medium ${getDifficultyColor(scenario.difficulty)}`}>
                    {scenario.difficulty}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    ~{scenario.duration} min
                  </span>
                </div>
              </div>
            ))}
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
                ⚠️ OpenAI connection required to start training sessions. Please check the connection status above.
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
