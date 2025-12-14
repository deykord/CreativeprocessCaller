import React, { useState, useEffect, useCallback } from 'react';
import { 
  GraduationCap, Play, Pause, Settings, CheckCircle, XCircle, 
  AlertCircle, RefreshCw, DollarSign, Clock, Target, Users,
  Phone, MessageSquare, Shield, Zap, TrendingUp, Award,
  Mic, MicOff, Volume2, VolumeX, BarChart3, FileText,
  ChevronDown, ChevronUp, Star, ArrowRight, Loader2
} from 'lucide-react';
import { backendAPI } from '../services/BackendAPI';

// AI Provider types
interface AIProvider {
  id: string;
  name: string;
  description: string;
  costPerMinute: number;
  features: string[];
  logo: string;
  connected: boolean;
  checking: boolean;
  envKey: string;
}

// Training scenario types
interface TrainingScenario {
  id: string;
  name: string;
  description: string;
  category: 'cold-call' | 'gatekeeper' | 'objection' | 'custom';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // estimated minutes
  icon: React.ReactNode;
  aiPersonality: string;
}

// Training session types
interface TrainingSession {
  id: string;
  agentId: string;
  agentName: string;
  scenarioId: string;
  scenarioName: string;
  providerId: string;
  startTime: string;
  endTime?: string;
  duration: number;
  cost: number;
  score?: number;
  feedback?: SessionFeedback;
  recordingUrl?: string;
  status: 'active' | 'completed' | 'cancelled';
}

interface SessionFeedback {
  overallScore: number;
  categories: {
    openingStrength: number;
    objectionHandling: number;
    rapport: number;
    closingSkill: number;
    tone: number;
    pacing: number;
  };
  strengths: string[];
  improvements: string[];
  transcript?: string;
  annotations?: { timestamp: number; comment: string; type: 'positive' | 'negative' | 'suggestion' }[];
}

// Cost tracking
interface CostSummary {
  today: number;
  thisWeek: number;
  thisMonth: number;
  allTime: number;
  byProvider: { [key: string]: number };
  byAgent: { [key: string]: number };
}

// Default providers configuration
const DEFAULT_PROVIDERS: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI Realtime',
    description: 'GPT-4o powered realtime voice conversations with low latency',
    costPerMinute: 0.06,
    features: ['Low latency', 'Natural interruptions', 'Context-aware', 'Multiple voices'],
    logo: '🤖',
    connected: false,
    checking: false,
    envKey: 'OPENAI_API_KEY'
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    description: 'Best-in-class voice synthesis with ultra-realistic voices',
    costPerMinute: 0.10,
    features: ['Best voice quality', '30+ voices', 'Emotion control', 'Custom voices'],
    logo: '🎙️',
    connected: false,
    checking: false,
    envKey: 'ELEVENLABS_API_KEY'
  },
  {
    id: 'vapi',
    name: 'Vapi.ai',
    description: 'Purpose-built voice AI for sales and customer service',
    costPerMinute: 0.05,
    features: ['Sales-focused', 'Easy integration', 'Built-in analytics', 'Multi-model'],
    logo: '📞',
    connected: false,
    checking: false,
    envKey: 'VAPI_API_KEY'
  },
  {
    id: 'retell',
    name: 'Retell.ai',
    description: 'Enterprise-grade conversational AI with sales training focus',
    costPerMinute: 0.10,
    features: ['Sales training', 'Real-time coaching', 'Enterprise ready', 'Custom personas'],
    logo: '🎯',
    connected: false,
    checking: false,
    envKey: 'RETELL_API_KEY'
  },
  {
    id: 'bland',
    name: 'Bland.ai',
    description: 'Human-like AI phone agents with natural conversation flow',
    costPerMinute: 0.09,
    features: ['Very natural', 'Sales optimized', 'Fast response', 'Emotion detection'],
    logo: '💬',
    connected: false,
    checking: false,
    envKey: 'BLAND_API_KEY'
  },
  {
    id: 'deepgram',
    name: 'Deepgram + LLM',
    description: 'Budget-friendly option combining Deepgram STT with any LLM',
    costPerMinute: 0.02,
    features: ['Lowest cost', 'Flexible LLM', 'Fast transcription', 'Custom setup'],
    logo: '🔊',
    connected: false,
    checking: false,
    envKey: 'DEEPGRAM_API_KEY'
  }
];

// Training scenarios
const TRAINING_SCENARIOS: TrainingScenario[] = [
  // Cold Call - Prospect Types
  {
    id: 'cold-interested',
    name: 'Interested Prospect',
    description: 'A warm prospect who is open to hearing your pitch and asks questions',
    category: 'cold-call',
    difficulty: 'beginner',
    duration: 5,
    icon: <Target className="text-green-500" />,
    aiPersonality: 'friendly, curious, asks clarifying questions, open to scheduling'
  },
  {
    id: 'cold-skeptical',
    name: 'Skeptical Prospect',
    description: 'Someone who needs convincing and challenges your value proposition',
    category: 'cold-call',
    difficulty: 'intermediate',
    duration: 8,
    icon: <Target className="text-amber-500" />,
    aiPersonality: 'doubtful, asks tough questions, needs proof points, price-sensitive'
  },
  {
    id: 'cold-busy',
    name: 'Busy Executive',
    description: 'Time-pressed decision maker who needs a quick, impactful pitch',
    category: 'cold-call',
    difficulty: 'advanced',
    duration: 3,
    icon: <Target className="text-red-500" />,
    aiPersonality: 'impatient, direct, only has 30 seconds, easily annoyed by fluff'
  },
  {
    id: 'cold-not-interested',
    name: 'Not Interested',
    description: 'Practice handling rejection and turning around a cold prospect',
    category: 'cold-call',
    difficulty: 'advanced',
    duration: 5,
    icon: <XCircle className="text-red-500" />,
    aiPersonality: 'dismissive, says no quickly, needs compelling reason to stay on call'
  },
  
  // Gatekeeper Scenarios
  {
    id: 'gk-helpful',
    name: 'Helpful Gatekeeper',
    description: 'Friendly assistant who can connect you if you ask correctly',
    category: 'gatekeeper',
    difficulty: 'beginner',
    duration: 3,
    icon: <Shield className="text-green-500" />,
    aiPersonality: 'helpful, asks who you are, will transfer if given good reason'
  },
  {
    id: 'gk-blocking',
    name: 'Blocking Gatekeeper',
    description: 'Protective assistant who screens all calls strictly',
    category: 'gatekeeper',
    difficulty: 'advanced',
    duration: 5,
    icon: <Shield className="text-red-500" />,
    aiPersonality: 'protective, asks many questions, skeptical of sales calls, follows strict protocols'
  },
  {
    id: 'gk-voicemail',
    name: 'Voicemail Only',
    description: 'Practice leaving compelling voicemails that get callbacks',
    category: 'gatekeeper',
    difficulty: 'intermediate',
    duration: 2,
    icon: <MessageSquare className="text-amber-500" />,
    aiPersonality: 'voicemail system, will record message, evaluate for callback-worthiness'
  },
  
  // Objection Handling
  {
    id: 'obj-price',
    name: 'Price Objection',
    description: '"It\'s too expensive" - practice value-based selling',
    category: 'objection',
    difficulty: 'intermediate',
    duration: 5,
    icon: <DollarSign className="text-amber-500" />,
    aiPersonality: 'budget-conscious, needs ROI justification, compares to competitors'
  },
  {
    id: 'obj-timing',
    name: 'Timing Objection',
    description: '"Not the right time" - create urgency and find commitment',
    category: 'objection',
    difficulty: 'intermediate',
    duration: 5,
    icon: <Clock className="text-amber-500" />,
    aiPersonality: 'busy, other priorities, might be interested later'
  },
  {
    id: 'obj-competitor',
    name: 'Already Have Solution',
    description: '"We already use X" - differentiate and find gaps',
    category: 'objection',
    difficulty: 'advanced',
    duration: 7,
    icon: <Users className="text-red-500" />,
    aiPersonality: 'satisfied with current vendor, needs strong reason to switch'
  },
  {
    id: 'obj-authority',
    name: 'No Decision Authority',
    description: '"I need to talk to my boss" - navigate to decision maker',
    category: 'objection',
    difficulty: 'intermediate',
    duration: 5,
    icon: <TrendingUp className="text-amber-500" />,
    aiPersonality: 'interested but not empowered, needs to involve others'
  },
  {
    id: 'obj-stall',
    name: 'Send Me Info',
    description: '"Just send me an email" - keep them engaged now',
    category: 'objection',
    difficulty: 'intermediate',
    duration: 4,
    icon: <FileText className="text-amber-500" />,
    aiPersonality: 'trying to end call politely, might be interested if you persist'
  }
];

const Training: React.FC = () => {
  // Provider state
  const [providers, setProviders] = useState<AIProvider[]>(DEFAULT_PROVIDERS);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  
  // Scenario state
  const [selectedScenario, setSelectedScenario] = useState<TrainingScenario | null>(null);
  const [scenarioFilter, setScenarioFilter] = useState<'all' | 'cold-call' | 'gatekeeper' | 'objection'>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');
  
  // Session state
  const [activeSession, setActiveSession] = useState<TrainingSession | null>(null);
  const [sessionHistory, setSessionHistory] = useState<TrainingSession[]>([]);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionTimer, setSessionTimer] = useState(0);
  
  // Feedback options
  const [feedbackOptions, setFeedbackOptions] = useState({
    realTimeCoaching: true,
    postCallScorecard: true,
    recordingWithAnnotations: true
  });
  
  // Audio state
  const [isMuted, setIsMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  
  // Cost tracking
  const [costs, setCosts] = useState<CostSummary>({
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    allTime: 0,
    byProvider: {},
    byAgent: {}
  });
  
  // UI state
  const [showProviderSettings, setShowProviderSettings] = useState(false);
  const [showCostDetails, setShowCostDetails] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check provider connections
  const checkProviderConnections = useCallback(async () => {
    setProviders(prev => prev.map(p => ({ ...p, checking: true })));
    
    try {
      const response = await fetch('/api/training/providers/status');
      if (response.ok) {
        const statuses = await response.json();
        setProviders(prev => prev.map(p => ({
          ...p,
          connected: statuses[p.id] || false,
          checking: false
        })));
      }
    } catch (error) {
      console.error('Failed to check provider connections:', error);
      setProviders(prev => prev.map(p => ({ ...p, checking: false })));
    }
  }, []);

  // Load session history and costs
  const loadData = useCallback(async () => {
    try {
      const [sessionsRes, costsRes] = await Promise.all([
        fetch('/api/training/sessions'),
        fetch('/api/training/costs')
      ]);
      
      if (sessionsRes.ok) {
        const sessions = await sessionsRes.json();
        setSessionHistory(sessions);
      }
      
      if (costsRes.ok) {
        const costData = await costsRes.json();
        setCosts(costData);
      }
    } catch (error) {
      console.error('Failed to load training data:', error);
    }
  }, []);

  useEffect(() => {
    checkProviderConnections();
    loadData();
  }, [checkProviderConnections, loadData]);

  // Session timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSessionActive) {
      interval = setInterval(() => {
        setSessionTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isSessionActive]);

  // Start training session
  const startSession = async () => {
    if (!selectedProvider || !selectedScenario) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/training/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: selectedProvider,
          scenarioId: selectedScenario.id,
          feedbackOptions
        })
      });
      
      if (response.ok) {
        const session = await response.json();
        setActiveSession(session);
        setIsSessionActive(true);
        setSessionTimer(0);
      }
    } catch (error) {
      console.error('Failed to start session:', error);
    } finally {
      setLoading(false);
    }
  };

  // End training session
  const endSession = async () => {
    if (!activeSession) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/training/sessions/${activeSession.id}/end`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const completedSession = await response.json();
        setSessionHistory(prev => [completedSession, ...prev]);
        setActiveSession(null);
        setIsSessionActive(false);
        loadData(); // Refresh costs
      }
    } catch (error) {
      console.error('Failed to end session:', error);
    } finally {
      setLoading(false);
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  // Get difficulty badge color
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'intermediate': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'advanced': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Filter scenarios
  const filteredScenarios = TRAINING_SCENARIOS.filter(s => {
    if (scenarioFilter !== 'all' && s.category !== scenarioFilter) return false;
    if (difficultyFilter !== 'all' && s.difficulty !== difficultyFilter) return false;
    return true;
  });

  // Render provider card
  const renderProviderCard = (provider: AIProvider) => (
    <div
      key={provider.id}
      onClick={() => provider.connected && setSelectedProvider(provider.id)}
      className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
        selectedProvider === provider.id
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : provider.connected
          ? 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
          : 'border-gray-200 dark:border-gray-700 opacity-60 cursor-not-allowed'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{provider.logo}</span>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">{provider.name}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatCurrency(provider.costPerMinute)}/min
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {provider.checking ? (
            <Loader2 size={18} className="animate-spin text-gray-400" />
          ) : provider.connected ? (
            <CheckCircle size={18} className="text-green-500" />
          ) : (
            <XCircle size={18} className="text-red-400" />
          )}
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{provider.description}</p>
      <div className="flex flex-wrap gap-1">
        {provider.features.slice(0, 3).map((f, i) => (
          <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300">
            {f}
          </span>
        ))}
      </div>
      {!provider.connected && (
        <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
          ⚠️ Add {provider.envKey} to .env to enable
        </p>
      )}
    </div>
  );

  // Render scenario card
  const renderScenarioCard = (scenario: TrainingScenario) => (
    <div
      key={scenario.id}
      onClick={() => setSelectedScenario(scenario)}
      className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
        selectedScenario?.id === scenario.id
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
          {scenario.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-900 dark:text-white">{scenario.name}</h4>
            <span className={`text-xs px-2 py-0.5 rounded-full ${getDifficultyColor(scenario.difficulty)}`}>
              {scenario.difficulty}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">{scenario.description}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              ~{scenario.duration} min
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl text-white">
              <GraduationCap size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Training Center</h1>
              <p className="text-gray-500 dark:text-gray-400">Train your sales skills with AI-powered roleplay</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCostDetails(!showCostDetails)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            >
              <DollarSign size={18} className="text-green-500" />
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {formatCurrency(costs.thisMonth)} this month
              </span>
            </button>
            <button
              onClick={checkProviderConnections}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              title="Refresh provider status"
            >
              <RefreshCw size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Cost Details Panel */}
      {showCostDetails && (
        <div className="mb-6 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 size={20} className="text-green-500" />
              Cost Breakdown
            </h3>
            <button onClick={() => setShowCostDetails(false)} className="text-gray-400 hover:text-gray-600">
              <ChevronUp size={20} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <p className="text-sm text-gray-500 dark:text-gray-400">Today</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(costs.today)}</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <p className="text-sm text-gray-500 dark:text-gray-400">This Week</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(costs.thisWeek)}</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <p className="text-sm text-gray-500 dark:text-gray-400">This Month</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(costs.thisMonth)}</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <p className="text-sm text-gray-500 dark:text-gray-400">All Time</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(costs.allTime)}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">By Provider</h4>
              <div className="space-y-2">
                {Object.entries(costs.byProvider).map(([provider, cost]) => (
                  <div key={provider} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{provider}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(cost)}</span>
                  </div>
                ))}
                {Object.keys(costs.byProvider).length === 0 && (
                  <p className="text-sm text-gray-500">No usage yet</p>
                )}
              </div>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">By Agent</h4>
              <div className="space-y-2">
                {Object.entries(costs.byAgent).map(([agent, cost]) => (
                  <div key={agent} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{agent}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(cost)}</span>
                  </div>
                ))}
                {Object.keys(costs.byAgent).length === 0 && (
                  <p className="text-sm text-gray-500">No usage yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Session Panel */}
      {isSessionActive && activeSession && (
        <div className="mb-6 p-6 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                <Phone size={28} className="animate-bounce" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Training Session Active</h3>
                <p className="text-white/80">{selectedScenario?.name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-mono font-bold">{formatTime(sessionTimer)}</p>
              <p className="text-sm text-white/70">
                Est. cost: {formatCurrency(sessionTimer / 60 * (providers.find(p => p.id === selectedProvider)?.costPerMinute || 0))}
              </p>
            </div>
          </div>
          
          {/* Real-time coaching indicator */}
          {feedbackOptions.realTimeCoaching && (
            <div className="p-3 bg-white/10 rounded-lg mb-4">
              <div className="flex items-center gap-2 text-sm">
                <Zap size={16} className="text-yellow-300" />
                <span>Real-time coaching active - AI will provide suggestions during the call</span>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-3 rounded-full ${isMuted ? 'bg-red-500' : 'bg-white/20'} transition`}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button
                onClick={() => setSpeakerOn(!speakerOn)}
                className={`p-3 rounded-full ${!speakerOn ? 'bg-red-500' : 'bg-white/20'} transition`}
              >
                {speakerOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>
            </div>
            <button
              onClick={endSession}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 rounded-full font-medium transition"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Phone size={18} className="rotate-[135deg]" />}
              End Session
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Provider Selection */}
        <div className="col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Voice AI Provider</h3>
              <button
                onClick={() => setShowProviderSettings(!showProviderSettings)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                <Settings size={18} className="text-gray-500" />
              </button>
            </div>
            
            <div className="space-y-3">
              {providers.map(renderProviderCard)}
            </div>
            
            {showProviderSettings && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">Provider Setup</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Add API keys to your <code className="text-xs bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded">.env</code> file:
                </p>
                <div className="space-y-2 text-xs font-mono bg-gray-900 text-gray-100 p-3 rounded-lg">
                  {providers.filter(p => !p.connected).map(p => (
                    <div key={p.id} className="text-amber-400">{p.envKey}=your_api_key_here</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Feedback Options */}
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Feedback Options</h3>
            
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={feedbackOptions.realTimeCoaching}
                  onChange={(e) => setFeedbackOptions(prev => ({ ...prev, realTimeCoaching: e.target.checked }))}
                  className="mt-1 w-5 h-5 rounded border-gray-300"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Real-time Coaching</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">AI provides live suggestions during the call</p>
                </div>
              </label>
              
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={feedbackOptions.postCallScorecard}
                  onChange={(e) => setFeedbackOptions(prev => ({ ...prev, postCallScorecard: e.target.checked }))}
                  className="mt-1 w-5 h-5 rounded border-gray-300"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Post-Call Scorecard</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Detailed scoring after each session</p>
                </div>
              </label>
              
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={feedbackOptions.recordingWithAnnotations}
                  onChange={(e) => setFeedbackOptions(prev => ({ ...prev, recordingWithAnnotations: e.target.checked }))}
                  className="mt-1 w-5 h-5 rounded border-gray-300"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Recording + AI Annotations</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Playback with timestamped AI comments</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Middle Column - Scenarios */}
        <div className="col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Training Scenarios</h3>
            
            {/* Filters */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <select
                value={scenarioFilter}
                onChange={(e) => setScenarioFilter(e.target.value as any)}
                className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Categories</option>
                <option value="cold-call">Cold Calls</option>
                <option value="gatekeeper">Gatekeepers</option>
                <option value="objection">Objections</option>
              </select>
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value as any)}
                className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Levels</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredScenarios.map(renderScenarioCard)}
            </div>
          </div>
        </div>

        {/* Right Column - Start Session & History */}
        <div className="col-span-1">
          {/* Start Session */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Start Training</h3>
            
            {selectedProvider && selectedScenario ? (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{providers.find(p => p.id === selectedProvider)?.logo}</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {providers.find(p => p.id === selectedProvider)?.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedScenario.icon}
                    <span className="text-gray-700 dark:text-gray-300">{selectedScenario.name}</span>
                  </div>
                </div>
                
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  <p>Estimated duration: ~{selectedScenario.duration} min</p>
                  <p>Estimated cost: {formatCurrency(selectedScenario.duration * (providers.find(p => p.id === selectedProvider)?.costPerMinute || 0))}</p>
                </div>
                
                <button
                  onClick={startSession}
                  disabled={loading || isSessionActive}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl font-medium transition disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      <Play size={20} />
                      Start Training Session
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  Select a provider and scenario to begin
                </p>
              </div>
            )}
          </div>

          {/* Session History */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Recent Sessions</h3>
            
            {sessionHistory.length > 0 ? (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {sessionHistory.slice(0, 10).map(session => (
                  <div
                    key={session.id}
                    className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 dark:text-white">{session.scenarioName}</span>
                      {session.score && (
                        <div className="flex items-center gap-1">
                          <Star size={14} className="text-yellow-500" />
                          <span className="text-sm font-medium">{session.score}%</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span>{new Date(session.startTime).toLocaleDateString()}</span>
                      <span>{formatTime(session.duration)}</span>
                      <span>{formatCurrency(session.cost)}</span>
                    </div>
                    {session.feedback && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500">Opening</span>
                            <div className="font-medium">{session.feedback.categories.openingStrength}%</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Objections</span>
                            <div className="font-medium">{session.feedback.categories.objectionHandling}%</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Closing</span>
                            <div className="font-medium">{session.feedback.categories.closingSkill}%</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Award size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  No training sessions yet
                </p>
                <p className="text-sm text-gray-400">Complete your first session to see your progress</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Training;
