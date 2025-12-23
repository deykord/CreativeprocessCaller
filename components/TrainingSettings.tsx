import React, { useState, useEffect } from 'react';
import {
  Settings, Save, RotateCcw, Mic, Brain, MessageSquare, 
  Sliders, User, Volume2, AlertCircle, CheckCircle, 
  ChevronDown, ChevronUp, Edit2, Eye, EyeOff, Copy,
  Zap, Shield, Clock, Target, TrendingUp, Loader2,
  Plus, Trash2, Play, X, Pause, RefreshCw, Search,
  Music, Headphones, Waveform, AudioLines, Globe, Sparkles
} from 'lucide-react';

// ElevenLabs Types
interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  preview_url?: string;
  labels: Record<string, string>;
  settings: VoiceSettings;
}

interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  speed: number;
}

interface ElevenLabsModel {
  model_id: string;
  name: string;
  description?: string;
  can_use_style: boolean;
  can_use_speaker_boost: boolean;
  languages: { language_id: string; name: string }[];
}

interface ElevenLabsConfig {
  default_voice_id: string | null;
  default_model_id: string;
  voice_settings: VoiceSettings;
}

interface ElevenLabsStatus {
  configured: boolean;
  error?: string;
  subscription?: {
    tier: string;
    characterCount: number;
    characterLimit: number;
    nextCharacterCountResetUnix?: number;
  };
  user?: {
    email: string;
    firstName?: string;
  };
}

interface BehaviorSettings {
  fillerFrequency: number;
  pauseFrequency: number;
  interruptFrequency: number;
  baseResistance: number;
  resistanceDecayRate: number;
  maxExchanges: number;
  bookingProbability: number;
  responseLength: 'short' | 'medium' | 'long';
  useHumanPatterns: boolean;
  maintainContext: boolean;
}

interface Scenario {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  voiceSettings: {
    speed: number;
    pitch: number;
    stability: number;
  };
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  ttsProvider?: 'elevenlabs' | 'openai';
  ttsVoiceId?: string;
  ttsModelId?: string;
}

interface TrainingSettingsProps {
  onClose?: () => void;
  currentUser?: { id: string; role?: string } | null;
}

const TrainingSettings: React.FC<TrainingSettingsProps> = ({ onClose, currentUser }) => {
  const isAdmin = currentUser?.role === 'admin';
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'behavior' | 'personality' | 'scenarios' | 'voice'>('behavior');
  
  // Settings state
  const [behaviorSettings, setBehaviorSettings] = useState<BehaviorSettings>({
    fillerFrequency: 0.3,
    pauseFrequency: 0.2,
    interruptFrequency: 0.15,
    baseResistance: 0.5,
    resistanceDecayRate: 0.2,
    maxExchanges: 5,
    bookingProbability: 0.7,
    responseLength: 'short',
    useHumanPatterns: true,
    maintainContext: true
  });
  
  const [basePersonality, setBasePersonality] = useState<string>('');
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  const [isCreatingScenario, setIsCreatingScenario] = useState(false);
  const [newScenario, setNewScenario] = useState<Partial<Scenario>>({
    name: '',
    description: '',
    systemPrompt: '',
    voiceSettings: { speed: 1.0, pitch: 1.0, stability: 0.7 },
    difficulty: 'medium',
    tags: [],
    ttsProvider: 'elevenlabs',
    ttsVoiceId: '',
    ttsModelId: ''
  });
  
  // OpenAI TTS Voices
  const openAiVoices = [
    { id: 'alloy', name: 'Alloy', description: 'Neutral, balanced voice' },
    { id: 'ash', name: 'Ash', description: 'Warm and engaging' },
    { id: 'ballad', name: 'Ballad', description: 'Expressive and melodic' },
    { id: 'coral', name: 'Coral', description: 'Clear and professional' },
    { id: 'echo', name: 'Echo', description: 'Deep and resonant' },
    { id: 'fable', name: 'Fable', description: 'British accent, expressive' },
    { id: 'nova', name: 'Nova', description: 'Youthful and energetic' },
    { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
    { id: 'sage', name: 'Sage', description: 'Calm and thoughtful' },
    { id: 'shimmer', name: 'Shimmer', description: 'Bright and feminine' }
  ];
  
  // OpenAI TTS Models
  const openAiModels = [
    { id: 'gpt-4o-mini-tts', name: 'GPT-4o Mini TTS', description: 'Fast, cost-effective' },
    { id: 'tts-1', name: 'TTS-1', description: 'Standard quality' },
    { id: 'tts-1-hd', name: 'TTS-1 HD', description: 'High quality audio' }
  ];
  
  // Expanded sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    humanBehavior: true,
    resistance: true,
    conversation: true
  });

  // ElevenLabs State
  const [elevenLabsStatus, setElevenLabsStatus] = useState<ElevenLabsStatus | null>(null);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([]);
  const [elevenLabsModels, setElevenLabsModels] = useState<ElevenLabsModel[]>([]);
  const [elevenLabsConfig, setElevenLabsConfig] = useState<ElevenLabsConfig>({
    default_voice_id: null,
    default_model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0,
      use_speaker_boost: true,
      speed: 1.0
    }
  });
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceSearch, setVoiceSearch] = useState('');
  const [selectedVoiceCategory, setSelectedVoiceCategory] = useState<string>('all');
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [testText, setTestText] = useState("Hello! This is a test of the voice configuration. How does it sound?");

  const getApiUrl = () => {
    return window.location.origin.replace(':5173', ':3001');
  };

  const getHeaders = () => {
    const token = localStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [behaviorRes, personalityRes, scenariosRes] = await Promise.all([
        fetch(`${getApiUrl()}/api/ai-settings/behavior`, { headers: getHeaders() }),
        fetch(`${getApiUrl()}/api/ai-settings/personality`, { headers: getHeaders() }),
        fetch(`${getApiUrl()}/api/ai-settings/scenarios`, { headers: getHeaders() })
      ]);
      
      if (!behaviorRes.ok || !personalityRes.ok || !scenariosRes.ok) {
        throw new Error('Failed to fetch settings');
      }
      
      const [behaviorData, personalityData, scenariosData] = await Promise.all([
        behaviorRes.json(),
        personalityRes.json(),
        scenariosRes.json()
      ]);
      
      setBehaviorSettings(behaviorData.settings);
      setBasePersonality(personalityData.prompt);
      setScenarios(scenariosData.scenarios || []);
    } catch (err: any) {
      console.error('Error fetching settings:', err);
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  // Fetch ElevenLabs data when voice tab is active OR when creating a scenario
  useEffect(() => {
    if (activeTab === 'voice' || activeTab === 'scenarios') {
      fetchElevenLabsData();
    }
  }, [activeTab]);

  const fetchElevenLabsData = async () => {
    setVoiceLoading(true);
    try {
      const [statusRes, voicesRes, modelsRes, configRes] = await Promise.all([
        fetch(`${getApiUrl()}/api/elevenlabs/status`, { headers: getHeaders() }),
        fetch(`${getApiUrl()}/api/elevenlabs/voices`, { headers: getHeaders() }),
        fetch(`${getApiUrl()}/api/elevenlabs/models`, { headers: getHeaders() }),
        fetch(`${getApiUrl()}/api/elevenlabs/config`, { headers: getHeaders() })
      ]);

      const statusData = await statusRes.json();
      setElevenLabsStatus(statusData);

      if (statusData.configured) {
        if (voicesRes.ok) {
          const voicesData = await voicesRes.json();
          setElevenLabsVoices(voicesData.voices || []);
        }
        if (modelsRes.ok) {
          const modelsData = await modelsRes.json();
          setElevenLabsModels(modelsData.models || []);
        }
        if (configRes.ok) {
          const configData = await configRes.json();
          setElevenLabsConfig(configData);
        }
      }
    } catch (err) {
      console.error('Error fetching ElevenLabs data:', err);
    } finally {
      setVoiceLoading(false);
    }
  };

  const playVoicePreview = async (voiceId: string, previewUrl?: string) => {
    // Stop any currently playing audio
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }

    if (playingPreview === voiceId) {
      setPlayingPreview(null);
      return;
    }

    if (previewUrl) {
      const audio = new Audio(previewUrl);
      audio.onended = () => setPlayingPreview(null);
      audio.onerror = () => setPlayingPreview(null);
      setPreviewAudio(audio);
      setPlayingPreview(voiceId);
      await audio.play();
    }
  };

  const generateCustomPreview = async (voiceId: string) => {
    setGeneratingPreview(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/elevenlabs/preview`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          voice_id: voiceId,
          text: testText,
          model_id: elevenLabsConfig.default_model_id,
          voice_settings: elevenLabsConfig.voice_settings
        })
      });

      if (!res.ok) throw new Error('Failed to generate preview');

      const data = await res.json();
      const audio = new Audio(data.audio);
      audio.onended = () => setPlayingPreview(null);
      setPreviewAudio(audio);
      setPlayingPreview(voiceId);
      await audio.play();
    } catch (err: any) {
      setError(err.message || 'Failed to generate preview');
    } finally {
      setGeneratingPreview(false);
    }
  };

  const saveElevenLabsConfig = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/elevenlabs/config/save`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(elevenLabsConfig)
      });

      if (!res.ok) throw new Error('Failed to save configuration');

      setSuccess('Voice configuration saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Filter voices based on search and category
  const filteredVoices = elevenLabsVoices.filter(voice => {
    const matchesSearch = voice.name.toLowerCase().includes(voiceSearch.toLowerCase()) ||
      voice.description?.toLowerCase().includes(voiceSearch.toLowerCase()) ||
      Object.values(voice.labels || {}).some(v => v.toLowerCase().includes(voiceSearch.toLowerCase()));
    const matchesCategory = selectedVoiceCategory === 'all' || voice.category === selectedVoiceCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique voice categories
  const voiceCategories = ['all', ...new Set(elevenLabsVoices.map(v => v.category))];

  const saveBehaviorSettings = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const res = await fetch(`${getApiUrl()}/api/ai-settings/behavior`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ settings: behaviorSettings })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save settings');
      }
      
      setSuccess('Behavior settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const savePersonality = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const res = await fetch(`${getApiUrl()}/api/ai-settings/personality`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ prompt: basePersonality })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save personality');
      }
      
      setSuccess('Personality prompt saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveScenario = async (scenario: Scenario) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const res = await fetch(`${getApiUrl()}/api/ai-settings/scenarios/${scenario.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          name: scenario.name,
          description: scenario.description,
          systemPrompt: scenario.systemPrompt,
          voiceSettings: scenario.voiceSettings,
          difficulty: scenario.difficulty,
          tags: scenario.tags
        })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save scenario');
      }
      
      setEditingScenario(null);
      setSuccess(`Scenario "${scenario.name}" saved successfully!`);
      setTimeout(() => setSuccess(null), 3000);
      fetchSettings(); // Refresh
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const createScenario = async () => {
    if (!newScenario.name || !newScenario.systemPrompt) {
      setError('Name and System Prompt are required');
      return;
    }
    
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const res = await fetch(`${getApiUrl()}/api/ai-settings/scenarios`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newScenario)
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create scenario');
      }
      
      setIsCreatingScenario(false);
      setNewScenario({
        name: '',
        description: '',
        systemPrompt: '',
        voiceSettings: { speed: 1.0, pitch: 1.0, stability: 0.7 },
        difficulty: 'medium',
        tags: []
      });
      setSuccess('Scenario created successfully!');
      setTimeout(() => setSuccess(null), 3000);
      fetchSettings(); // Refresh
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteScenario = async (scenarioId: string, scenarioName: string) => {
    if (!confirm(`Are you sure you want to delete "${scenarioName}"? This cannot be undone.`)) {
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      const res = await fetch(`${getApiUrl()}/api/ai-settings/scenarios/${scenarioId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete scenario');
      }
      
      setSuccess(`Scenario "${scenarioName}" deleted!`);
      setTimeout(() => setSuccess(null), 3000);
      fetchSettings(); // Refresh
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const duplicateScenario = async (scenarioId: string) => {
    setSaving(true);
    setError(null);
    
    try {
      const res = await fetch(`${getApiUrl()}/api/ai-settings/scenarios/${scenarioId}/duplicate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({})
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to duplicate scenario');
      }
      
      setSuccess('Scenario duplicated!');
      setTimeout(() => setSuccess(null), 3000);
      fetchSettings(); // Refresh
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async (category?: string) => {
    if (!confirm('Are you sure you want to reset to default settings? This cannot be undone.')) {
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      const url = category 
        ? `${getApiUrl()}/api/ai-settings/reset?category=${category}`
        : `${getApiUrl()}/api/ai-settings/reset`;
        
      const res = await fetch(url, {
        method: 'POST',
        headers: getHeaders()
      });
      
      if (!res.ok) {
        throw new Error('Failed to reset settings');
      }
      
      setSuccess('Settings reset to defaults!');
      fetchSettings();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const SliderControl = ({ 
    label, 
    value, 
    onChange, 
    min = 0, 
    max = 1, 
    step = 0.05,
    description,
    icon: Icon
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    step?: number;
    description?: string;
    icon?: any;
  }) => (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={16} className="text-blue-500" />}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        </div>
        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
          {Math.round(value * 100)}%
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
      {description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Brain className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">AI Agent Configuration</h2>
              <p className="text-blue-100 text-sm">Control how training AI agents behave and respond</p>
            </div>
          </div>
          <button
            onClick={() => resetToDefaults()}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition"
          >
            <RotateCcw size={16} />
            Reset All
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400">
          <AlertCircle size={18} />
          <span className="text-sm">{error}</span>
        </div>
      )}
      
      {success && (
        <div className="mx-6 mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 text-green-700 dark:text-green-400">
          <CheckCircle size={18} />
          <span className="text-sm">{success}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex px-6 -mb-px">
          {[
            { id: 'behavior', label: 'Behavior', icon: Sliders },
            { id: 'personality', label: 'Personality', icon: User },
            { id: 'scenarios', label: 'Scenarios', icon: MessageSquare },
            { id: 'voice', label: 'Voice', icon: Volume2 }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6 max-h-[600px] overflow-y-auto">
        {/* Behavior Tab */}
        {activeTab === 'behavior' && (
          <div className="space-y-6">
            {/* Human Behavior Section */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
              <button
                onClick={() => toggleSection('humanBehavior')}
                className="w-full flex items-center justify-between mb-4"
              >
                <div className="flex items-center gap-2">
                  <Mic className="text-purple-500" size={20} />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Human-Like Speech</h3>
                </div>
                {expandedSections.humanBehavior ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
              
              {expandedSections.humanBehavior && (
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={behaviorSettings.useHumanPatterns}
                      onChange={(e) => setBehaviorSettings(prev => ({ ...prev, useHumanPatterns: e.target.checked }))}
                      className="w-5 h-5 rounded text-blue-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Enable human speech patterns (fillers, pauses, reactions)
                    </span>
                  </label>
                  
                  <SliderControl
                    label="Filler Words Frequency"
                    value={behaviorSettings.fillerFrequency}
                    onChange={(v) => setBehaviorSettings(prev => ({ ...prev, fillerFrequency: v }))}
                    description='How often to use "um", "uh", "well", "you know", etc.'
                    icon={MessageSquare}
                  />
                  
                  <SliderControl
                    label="Natural Pause Frequency"
                    value={behaviorSettings.pauseFrequency}
                    onChange={(v) => setBehaviorSettings(prev => ({ ...prev, pauseFrequency: v }))}
                    description="How often to pause mid-sentence with '...' or '—'"
                    icon={Clock}
                  />
                  
                  <SliderControl
                    label="Interrupt Frequency"
                    value={behaviorSettings.interruptFrequency}
                    onChange={(v) => setBehaviorSettings(prev => ({ ...prev, interruptFrequency: v }))}
                    description="How often to interrupt the caller naturally"
                    icon={Zap}
                  />
                </div>
              )}
            </div>

            {/* Resistance Section */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
              <button
                onClick={() => toggleSection('resistance')}
                className="w-full flex items-center justify-between mb-4"
              >
                <div className="flex items-center gap-2">
                  <Shield className="text-red-500" size={20} />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Objection & Resistance</h3>
                </div>
                {expandedSections.resistance ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
              
              {expandedSections.resistance && (
                <div className="space-y-4">
                  <SliderControl
                    label="Base Resistance Level"
                    value={behaviorSettings.baseResistance}
                    onChange={(v) => setBehaviorSettings(prev => ({ ...prev, baseResistance: v }))}
                    description="Initial skepticism/hostility level (0% = friendly, 100% = hostile)"
                    icon={Shield}
                  />
                  
                  <SliderControl
                    label="Resistance Decay Rate"
                    value={behaviorSettings.resistanceDecayRate}
                    onChange={(v) => setBehaviorSettings(prev => ({ ...prev, resistanceDecayRate: v }))}
                    description="How quickly resistance decreases with good responses"
                    icon={TrendingUp}
                  />
                  
                  <SliderControl
                    label="Booking Probability"
                    value={behaviorSettings.bookingProbability}
                    onChange={(v) => setBehaviorSettings(prev => ({ ...prev, bookingProbability: v }))}
                    description="Chance of booking if all objections are handled well"
                    icon={Target}
                  />
                </div>
              )}
            </div>

            {/* Conversation Flow Section */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
              <button
                onClick={() => toggleSection('conversation')}
                className="w-full flex items-center justify-between mb-4"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="text-blue-500" size={20} />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Conversation Flow</h3>
                </div>
                {expandedSections.conversation ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
              
              {expandedSections.conversation && (
                <div className="space-y-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Max Exchanges Before Decision
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={10}
                      value={behaviorSettings.maxExchanges}
                      onChange={(e) => setBehaviorSettings(prev => ({ ...prev, maxExchanges: parseInt(e.target.value) || 5 }))}
                      className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">AI must book or hang up after this many exchanges</p>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Response Length
                    </label>
                    <div className="flex gap-2">
                      {(['short', 'medium', 'long'] as const).map(length => (
                        <button
                          key={length}
                          onClick={() => setBehaviorSettings(prev => ({ ...prev, responseLength: length }))}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                            behaviorSettings.responseLength === length
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
                          }`}
                        >
                          {length.charAt(0).toUpperCase() + length.slice(1)}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Short = 1-2 sentences, Medium = 2-3, Long = 3-5</p>
                  </div>
                  
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={behaviorSettings.maintainContext}
                      onChange={(e) => setBehaviorSettings(prev => ({ ...prev, maintainContext: e.target.checked }))}
                      className="w-5 h-5 rounded text-blue-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Reference earlier conversation ("You mentioned earlier...")
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={saveBehaviorSettings}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Save Behavior Settings
              </button>
            </div>
          </div>
        )}

        {/* Personality Tab */}
        {activeTab === 'personality' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">Base Personality Prompt</h3>
              <button
                onClick={() => resetToDefaults('prompts')}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Reset to Default
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              This prompt is applied to ALL training scenarios. It defines how the AI should behave like a real human.
            </p>
            <textarea
              value={basePersonality}
              onChange={(e) => setBasePersonality(e.target.value)}
              rows={20}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter the base personality prompt..."
            />
            <div className="flex justify-end">
              <button
                onClick={savePersonality}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Save Personality
              </button>
            </div>
          </div>
        )}

        {/* Scenarios Tab */}
        {activeTab === 'scenarios' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Create and manage training scenarios. Each scenario simulates a different type of prospect.
              </p>
              <button
                onClick={() => setIsCreatingScenario(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition"
              >
                <Plus size={16} />
                New Scenario
              </button>
            </div>
            
            {scenarios.length === 0 ? (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-12 text-center border-2 border-dashed border-gray-300 dark:border-gray-600">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">No Scenarios Yet</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Create your first training scenario to start training your team.
                </p>
                <button
                  onClick={() => setIsCreatingScenario(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                >
                  <Plus size={16} />
                  Create First Scenario
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {scenarios.map(scenario => (
                  <div
                    key={scenario.id}
                    className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900 dark:text-white">{scenario.name}</h4>
                          {scenario.difficulty && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              scenario.difficulty === 'easy' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              scenario.difficulty === 'hard' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}>
                              {scenario.difficulty}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{scenario.description || 'No description'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => duplicateScenario(scenario.id)}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"
                          title="Duplicate"
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedScenario(scenario.id);
                            setEditingScenario({ ...scenario });
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm hover:bg-blue-200 transition"
                        >
                          <Edit2 size={14} />
                          Edit
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => deleteScenario(scenario.id, scenario.name)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Create Scenario Modal */}
            {isCreatingScenario && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
                  <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">Create New Scenario</h3>
                    <button onClick={() => setIsCreatingScenario(false)} className="text-white/80 hover:text-white">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="p-6 overflow-y-auto max-h-[60vh]">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Scenario Name *
                          </label>
                          <input
                            type="text"
                            value={newScenario.name || ''}
                            onChange={(e) => setNewScenario({ ...newScenario, name: e.target.value })}
                            placeholder="e.g., Hostile CEO"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Difficulty
                          </label>
                          <select
                            value={newScenario.difficulty || 'medium'}
                            onChange={(e) => setNewScenario({ ...newScenario, difficulty: e.target.value as any })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          >
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                          </select>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Description
                        </label>
                        <input
                          type="text"
                          value={newScenario.description || ''}
                          onChange={(e) => setNewScenario({ ...newScenario, description: e.target.value })}
                          placeholder="Brief description of this scenario"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          System Prompt * <span className="text-gray-400 font-normal">(AI persona instructions)</span>
                        </label>
                        <textarea
                          value={newScenario.systemPrompt || ''}
                          onChange={(e) => setNewScenario({ ...newScenario, systemPrompt: e.target.value })}
                          rows={15}
                          placeholder={`You are [Character Name], [Title] at [Company Type].

YOUR PERSONALITY:
- [Trait 1]
- [Trait 2]

YOUR SITUATION:
- [Context 1]
- [Context 2]

OPENING LINE: "[What you say when answering the call]"

BEHAVIOR:
- If impressed: "[Response]"
- If annoyed: "[Response]"`}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
                        />
                      </div>
                      
                      {/* TTS Provider Selection */}
                      <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-5 border border-purple-200 dark:border-gray-600">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <Volume2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                          Text-to-Speech Configuration
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Provider Selection */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              TTS Provider
                            </label>
                            <select
                              value={newScenario.ttsProvider || 'elevenlabs'}
                              onChange={(e) => setNewScenario({ 
                                ...newScenario, 
                                ttsProvider: e.target.value as 'elevenlabs' | 'openai',
                                ttsVoiceId: '',
                                ttsModelId: ''
                              })}
                              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            >
                              <option value="elevenlabs">🎙️ ElevenLabs</option>
                              <option value="openai">🤖 OpenAI</option>
                            </select>
                          </div>
                          
                          {/* Voice Selection */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Voice
                            </label>
                            <select
                              value={newScenario.ttsVoiceId || ''}
                              onChange={(e) => setNewScenario({ ...newScenario, ttsVoiceId: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            >
                              <option value="">Select Voice...</option>
                              {newScenario.ttsProvider === 'openai' ? (
                                openAiVoices.map(voice => (
                                  <option key={voice.id} value={voice.id}>
                                    {voice.name} - {voice.description}
                                  </option>
                                ))
                              ) : (
                                elevenLabsVoices.length > 0 ? (
                                  elevenLabsVoices.map(voice => (
                                    <option key={voice.voice_id} value={voice.voice_id}>
                                      {voice.name}
                                    </option>
                                  ))
                                ) : (
                                  <option value="" disabled>Loading voices...</option>
                                )
                              )}
                            </select>
                            {newScenario.ttsProvider === 'elevenlabs' && elevenLabsVoices.length === 0 && (
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                ⏳ Loading ElevenLabs voices...
                              </p>
                            )}
                          </div>
                          
                          {/* Model Selection */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Model
                            </label>
                            <select
                              value={newScenario.ttsModelId || ''}
                              onChange={(e) => setNewScenario({ ...newScenario, ttsModelId: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            >
                              <option value="">Select Model...</option>
                              {newScenario.ttsProvider === 'openai' ? (
                                openAiModels.map(model => (
                                  <option key={model.id} value={model.id}>
                                    {model.name} - {model.description}
                                  </option>
                                ))
                              ) : (
                                elevenLabsModels.length > 0 ? (
                                  elevenLabsModels.map(model => (
                                    <option key={model.model_id} value={model.model_id}>
                                      {model.name}
                                    </option>
                                  ))
                                ) : (
                                  <option value="" disabled>Loading models...</option>
                                )
                              )}
                            </select>
                            {newScenario.ttsProvider === 'elevenlabs' && elevenLabsModels.length === 0 && (
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                ⏳ Loading ElevenLabs models...
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {/* Provider Info */}
                        <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                          {newScenario.ttsProvider === 'openai' ? (
                            <span className="flex items-center gap-1">
                              <Sparkles className="w-4 h-4 text-blue-500" />
                              OpenAI provides fast, natural-sounding voices at lower cost
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Sparkles className="w-4 h-4 text-purple-500" />
                              ElevenLabs offers premium voice cloning and emotional expression
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Voice Fine-tuning (for ElevenLabs) */}
                      {newScenario.ttsProvider !== 'openai' && (
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Voice Speed
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.5"
                            max="2"
                            value={newScenario.voiceSettings?.speed || 1}
                            onChange={(e) => setNewScenario({
                              ...newScenario,
                              voiceSettings: { ...newScenario.voiceSettings!, speed: parseFloat(e.target.value) }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Voice Pitch
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.5"
                            max="2"
                            value={newScenario.voiceSettings?.pitch || 1}
                            onChange={(e) => setNewScenario({
                              ...newScenario,
                              voiceSettings: { ...newScenario.voiceSettings!, pitch: parseFloat(e.target.value) }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Voice Stability
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="1"
                            value={newScenario.voiceSettings?.stability || 0.7}
                            onChange={(e) => setNewScenario({
                              ...newScenario,
                              voiceSettings: { ...newScenario.voiceSettings!, stability: parseFloat(e.target.value) }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                      )}
                    </div>
                  </div>
                  <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 flex justify-end gap-3">
                    <button
                      onClick={() => setIsCreatingScenario(false)}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createScenario}
                      disabled={saving || !newScenario.name || !newScenario.systemPrompt}
                      className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                      Create Scenario
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Scenario Editor Modal */}
            {editingScenario && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">Edit Scenario: {editingScenario.name}</h3>
                    <button onClick={() => setEditingScenario(null)} className="text-white/80 hover:text-white">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="p-6 overflow-y-auto max-h-[60vh]">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Scenario Name
                          </label>
                          <input
                            type="text"
                            value={editingScenario.name}
                            onChange={(e) => setEditingScenario({ ...editingScenario, name: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Difficulty
                          </label>
                          <select
                            value={editingScenario.difficulty || 'medium'}
                            onChange={(e) => setEditingScenario({ ...editingScenario, difficulty: e.target.value as any })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          >
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                          </select>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Description
                        </label>
                        <input
                          type="text"
                          value={editingScenario.description || ''}
                          onChange={(e) => setEditingScenario({ ...editingScenario, description: e.target.value })}
                          placeholder="Brief description of this scenario"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          System Prompt
                        </label>
                        <textarea
                          value={editingScenario.systemPrompt || ''}
                          onChange={(e) => setEditingScenario({ ...editingScenario, systemPrompt: e.target.value })}
                          rows={12}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 font-mono text-sm"
                        />
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Voice Speed
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.5"
                            max="2"
                            value={editingScenario.voiceSettings?.speed || 1}
                            onChange={(e) => setEditingScenario({
                              ...editingScenario,
                              voiceSettings: { ...editingScenario.voiceSettings, speed: parseFloat(e.target.value) }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Voice Pitch
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.5"
                            max="2"
                            value={editingScenario.voiceSettings?.pitch || 1}
                            onChange={(e) => setEditingScenario({
                              ...editingScenario,
                              voiceSettings: { ...editingScenario.voiceSettings, pitch: parseFloat(e.target.value) }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Voice Stability
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="1"
                            value={editingScenario.voiceSettings?.stability || 0.7}
                            onChange={(e) => setEditingScenario({
                              ...editingScenario,
                              voiceSettings: { ...editingScenario.voiceSettings, stability: parseFloat(e.target.value) }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 flex justify-end gap-3">
                    <button
                      onClick={() => setEditingScenario(null)}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => saveScenario(editingScenario)}
                      disabled={saving}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                      Save Scenario
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Voice Tab */}
        {activeTab === 'voice' && (
          <div className="space-y-6">
            {voiceLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                <span className="ml-3 text-gray-600 dark:text-gray-400">Loading ElevenLabs...</span>
              </div>
            ) : !elevenLabsStatus?.configured ? (
              <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-xl p-6 border border-red-200 dark:border-red-800">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-red-500 rounded-xl">
                    <AlertCircle className="text-white" size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">ElevenLabs Not Configured</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Add your ElevenLabs API key to the server .env file to enable voice features.
                    </p>
                    <code className="block bg-gray-800 text-green-400 p-3 rounded-lg text-sm font-mono">
                      ELEVENLABS_API_KEY=sk_your_api_key_here
                    </code>
                    {elevenLabsStatus?.error && (
                      <p className="text-red-600 dark:text-red-400 text-sm mt-3">{elevenLabsStatus.error}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Status & Usage Card */}
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl p-5 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500 rounded-lg">
                        <Sparkles className="text-white" size={20} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">ElevenLabs Connected</h3>
                        <p className="text-sm text-purple-600 dark:text-purple-400">
                          {elevenLabsStatus?.subscription?.tier?.toUpperCase()} Plan
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={fetchElevenLabsData}
                      className="p-2 text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition"
                      title="Refresh"
                    >
                      <RefreshCw size={18} />
                    </button>
                  </div>
                  
                  {/* Usage Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">Character Usage</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {(elevenLabsStatus?.subscription?.characterCount || 0).toLocaleString()} / {(elevenLabsStatus?.subscription?.characterLimit || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all"
                        style={{ 
                          width: `${Math.min(100, ((elevenLabsStatus?.subscription?.characterCount || 0) / (elevenLabsStatus?.subscription?.characterLimit || 1)) * 100)}%` 
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {((elevenLabsStatus?.subscription?.characterLimit || 0) - (elevenLabsStatus?.subscription?.characterCount || 0)).toLocaleString()} characters remaining
                    </p>
                  </div>
                </div>

                {/* Model Selection */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Brain className="text-blue-500" size={20} />
                    <h3 className="font-semibold text-gray-900 dark:text-white">TTS Model</h3>
                  </div>
                  <select
                    value={elevenLabsConfig.default_model_id}
                    onChange={(e) => setElevenLabsConfig(prev => ({ ...prev, default_model_id: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {elevenLabsModels.map(model => (
                      <option key={model.model_id} value={model.model_id}>
                        {model.name} {model.can_use_style ? '(+Style)' : ''} {model.languages?.length > 1 ? `(${model.languages.length} languages)` : ''}
                      </option>
                    ))}
                  </select>
                  {elevenLabsModels.find(m => m.model_id === elevenLabsConfig.default_model_id)?.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      {elevenLabsModels.find(m => m.model_id === elevenLabsConfig.default_model_id)?.description}
                    </p>
                  )}
                </div>

                {/* Voice Settings */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Sliders className="text-green-500" size={20} />
                    <h3 className="font-semibold text-gray-900 dark:text-white">Voice Settings</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Stability */}
                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Stability</label>
                        <span className="text-sm font-bold text-green-600">{Math.round(elevenLabsConfig.voice_settings.stability * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={elevenLabsConfig.voice_settings.stability}
                        onChange={(e) => setElevenLabsConfig(prev => ({
                          ...prev,
                          voice_settings: { ...prev.voice_settings, stability: parseFloat(e.target.value) }
                        }))}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-600"
                      />
                      <p className="text-xs text-gray-500 mt-1">Lower = more expressive, Higher = more consistent</p>
                    </div>

                    {/* Similarity Boost */}
                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Clarity + Similarity</label>
                        <span className="text-sm font-bold text-blue-600">{Math.round(elevenLabsConfig.voice_settings.similarity_boost * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={elevenLabsConfig.voice_settings.similarity_boost}
                        onChange={(e) => setElevenLabsConfig(prev => ({
                          ...prev,
                          voice_settings: { ...prev.voice_settings, similarity_boost: parseFloat(e.target.value) }
                        }))}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <p className="text-xs text-gray-500 mt-1">How closely to match the original voice</p>
                    </div>

                    {/* Style */}
                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Style Exaggeration</label>
                        <span className="text-sm font-bold text-purple-600">{Math.round(elevenLabsConfig.voice_settings.style * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={elevenLabsConfig.voice_settings.style}
                        onChange={(e) => setElevenLabsConfig(prev => ({
                          ...prev,
                          voice_settings: { ...prev.voice_settings, style: parseFloat(e.target.value) }
                        }))}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />
                      <p className="text-xs text-gray-500 mt-1">Amplify the speaker's style (uses more compute)</p>
                    </div>

                    {/* Speed */}
                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Speed</label>
                        <span className="text-sm font-bold text-orange-600">{elevenLabsConfig.voice_settings.speed.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={2}
                        step={0.1}
                        value={elevenLabsConfig.voice_settings.speed}
                        onChange={(e) => setElevenLabsConfig(prev => ({
                          ...prev,
                          voice_settings: { ...prev.voice_settings, speed: parseFloat(e.target.value) }
                        }))}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-600"
                      />
                      <p className="text-xs text-gray-500 mt-1">0.5x (slow) to 2x (fast)</p>
                    </div>
                  </div>

                  {/* Speaker Boost Toggle */}
                  <div className="mt-4 flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="speakerBoost"
                      checked={elevenLabsConfig.voice_settings.use_speaker_boost}
                      onChange={(e) => setElevenLabsConfig(prev => ({
                        ...prev,
                        voice_settings: { ...prev.voice_settings, use_speaker_boost: e.target.checked }
                      }))}
                      className="w-5 h-5 rounded text-purple-600"
                    />
                    <label htmlFor="speakerBoost" className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Speaker Boost</span> - Enhances similarity to original speaker (slightly higher latency)
                    </label>
                  </div>
                </div>

                {/* Voice Selection */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Headphones className="text-purple-500" size={20} />
                      <h3 className="font-semibold text-gray-900 dark:text-white">Select Voice</h3>
                      <span className="text-sm text-gray-500">({elevenLabsVoices.length} available)</span>
                    </div>
                  </div>

                  {/* Search & Filter */}
                  <div className="flex flex-col md:flex-row gap-3 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="text"
                        value={voiceSearch}
                        onChange={(e) => setVoiceSearch(e.target.value)}
                        placeholder="Search voices..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <select
                      value={selectedVoiceCategory}
                      onChange={(e) => setSelectedVoiceCategory(e.target.value)}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {voiceCategories.map(cat => (
                        <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                      ))}
                    </select>
                  </div>

                  {/* Voice Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
                    {filteredVoices.map(voice => (
                      <div
                        key={voice.voice_id}
                        onClick={() => setElevenLabsConfig(prev => ({ ...prev, default_voice_id: voice.voice_id }))}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          elevenLabsConfig.default_voice_id === voice.voice_id
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 bg-white dark:bg-gray-900'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white">{voice.name}</h4>
                            <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">
                              {voice.category}
                            </span>
                          </div>
                          {elevenLabsConfig.default_voice_id === voice.voice_id && (
                            <CheckCircle className="text-purple-500" size={20} />
                          )}
                        </div>
                        
                        {/* Labels */}
                        {voice.labels && Object.keys(voice.labels).length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {Object.entries(voice.labels).slice(0, 3).map(([key, value]) => (
                              <span key={key} className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                                {value}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Preview Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            playVoicePreview(voice.voice_id, voice.preview_url);
                          }}
                          className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 transition"
                        >
                          {playingPreview === voice.voice_id ? (
                            <>
                              <Pause size={14} />
                              <span>Stop</span>
                            </>
                          ) : (
                            <>
                              <Play size={14} />
                              <span>Preview</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>

                  {filteredVoices.length === 0 && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No voices found matching your search
                    </div>
                  )}
                </div>

                {/* Test Voice */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Music className="text-orange-500" size={20} />
                    <h3 className="font-semibold text-gray-900 dark:text-white">Test Voice</h3>
                  </div>
                  
                  <textarea
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    rows={3}
                    placeholder="Enter text to test..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-3"
                  />
                  
                  <button
                    onClick={() => elevenLabsConfig.default_voice_id && generateCustomPreview(elevenLabsConfig.default_voice_id)}
                    disabled={!elevenLabsConfig.default_voice_id || generatingPreview}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                  >
                    {generatingPreview ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Play size={18} />
                        Test with Current Settings
                      </>
                    )}
                  </button>
                  
                  {!elevenLabsConfig.default_voice_id && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                      Select a voice above to test
                    </p>
                  )}
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <button
                    onClick={saveElevenLabsConfig}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Save Voice Configuration
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainingSettings;
