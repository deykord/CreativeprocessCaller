import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Users, TrendingUp, Clock, Award, 
  BarChart2, Calendar, ChevronDown, RefreshCw,
  Phone, MessageSquare, Mic, Target, AlertTriangle,
  Brain, Sliders, ArrowLeft, ChevronRight, 
  PhoneCall, Settings, Globe, Wifi, WifiOff,
  CreditCard, Hash, Shield, Volume2, AlertCircle,
  CheckCircle, Radio, Loader2, Play, Search, ExternalLink
} from 'lucide-react';
import TrainingSettings from './TrainingSettings';
import { TeamManagement } from './TeamManagement';

interface TrainingCost {
  totalCostUsd: number;
  chatCost: number;
  ttsCost: number;
  totalSessions: number;
  totalMessages: number;
  totalAudioSeconds: number;
  inputTokens: number;
  outputTokens: number;
}

interface AgentStats {
  userId: string;
  userName: string;
  email: string;
  role: string;
  // Training metrics
  totalSessions: number;
  totalMessages: number;
  avgSessionDuration: number;
  avgScore: number;
  trainingScore: number;
  lastTrainingDate: string;
  scenariosCompleted: string[];
  // Call metrics
  totalCalls: number;
  connectedCalls: number;
  successRate: number;
  totalCallDuration: number;
  onlineHours: number;
  callsLast24h: number;
  lastCallDate: string;
  // Overall performance
  performanceScore: number;
  totalCostUsd: number;
}

interface DailyUsage {
  date: string;
  sessions: number;
  messages: number;
  costUsd: number;
}

interface ScenarioStats {
  scenarioId: string;
  scenarioName: string;
  totalSessions: number;
  avgScore: number;
  avgDuration: number;
}

interface TelnyxStatus {
  configured: boolean;
  balance?: { balance: string; currency: string };
  connectionId?: string;
  callerId?: string;
  connectionInfo?: any;
}

interface TelnyxPhoneNumber {
  id: string;
  phone_number: string;
  status: string;
  connection_id?: string;
  messaging_profile_id?: string;
  created_at: string;
  inbound_channel_limit?: number;
  outbound_channel_limit?: number;
}

interface TelnyxConnection {
  id: string;
  connection_name: string;
  active: boolean;
  webhook_url?: string;
  created_at: string;
  updated_at: string;
}

interface TelnyxRecording {
  id: string;
  call_leg_id: string;
  call_session_id: string;
  status: string;
  duration_millis: number;
  download_urls?: { mp3?: string; wav?: string };
  created_at: string;
}

interface TelnyxStats {
  phoneNumbers: { total: number; active: number };
  connections: { total: number; active: number };
  recordings: { total: number; totalDuration: number };
  messaging: { total: number };
}

interface AdminDashboardProps {
  initialSection?: 'home' | 'costs' | 'performance' | 'training-settings' | 'team' | 'telnyx';
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ initialSection = 'home' }) => {
  const [activeSection, setActiveSection] = useState<'home' | 'costs' | 'performance' | 'training-settings' | 'team' | 'telnyx'>(initialSection);
  
  // Sync with prop changes from sidebar navigation
  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);
  const [costs, setCosts] = useState<TrainingCost | null>(null);
  const [callCosts, setCallCosts] = useState<{ totalCost: number; totalCalls: number; totalMinutes: number } | null>(null);
  const [agentStats, setAgentStats] = useState<AgentStats[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [scenarioStats, setScenarioStats] = useState<ScenarioStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [error, setError] = useState<string | null>(null);
  
  // Telnyx state
  const [telnyxStatus, setTelnyxStatus] = useState<TelnyxStatus | null>(null);
  const [telnyxPhoneNumbers, setTelnyxPhoneNumbers] = useState<TelnyxPhoneNumber[]>([]);
  const [telnyxConnections, setTelnyxConnections] = useState<TelnyxConnection[]>([]);
  const [telnyxRecordings, setTelnyxRecordings] = useState<TelnyxRecording[]>([]);
  const [telnyxStats, setTelnyxStats] = useState<TelnyxStats | null>(null);
  const [telnyxLoading, setTelnyxLoading] = useState(false);
  const [telnyxError, setTelnyxError] = useState<string | null>(null);
  const [telnyxTab, setTelnyxTab] = useState<'overview' | 'numbers' | 'connections' | 'recordings' | 'messaging'>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  // Get current admin user
  const currentUser = (() => {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  })();

  const getApiUrl = () => {
    return window.location.origin.replace(':5173', ':3001');
  };

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('authToken');
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      // Fetch all admin data in parallel
      const [costsRes, agentsRes, dailyRes, scenariosRes, callCostsRes] = await Promise.all([
        fetch(`${getApiUrl()}/api/admin/training/costs?range=${dateRange}`, { headers }),
        fetch(`${getApiUrl()}/api/admin/training/agents?range=${dateRange}`, { headers }),
        fetch(`${getApiUrl()}/api/admin/training/daily-usage?range=${dateRange}`, { headers }),
        fetch(`${getApiUrl()}/api/admin/training/scenarios?range=${dateRange}`, { headers }),
        fetch(`${getApiUrl()}/api/admin/call-costs?range=${dateRange}`, { headers }).catch(() => null)
      ]);

      if (!costsRes.ok || !agentsRes.ok) {
        if (costsRes.status === 403 || agentsRes.status === 403) {
          throw new Error('Access denied. Admin privileges required.');
        }
        throw new Error('Failed to fetch admin data');
      }

      const [costsData, agentsData, dailyData, scenariosData] = await Promise.all([
        costsRes.json(),
        agentsRes.json(),
        dailyRes.json(),
        scenariosRes.json()
      ]);

      // Fetch call costs if endpoint exists
      let callCostsData = null;
      if (callCostsRes && callCostsRes.ok) {
        callCostsData = await callCostsRes.json();
      }

      console.log('📊 Admin data fetched:', {
        costs: costsData,
        callCosts: callCostsData,
        agentsCount: agentsData.agents?.length || 0,
        agents: agentsData.agents,
        dailyUsage: dailyData.usage?.length || 0,
        scenarios: scenariosData.scenarios?.length || 0
      });

      setCosts(costsData);
      setCallCosts(callCostsData);
      // Include ALL users including admin
      setAgentStats(agentsData.agents || []);
      setDailyUsage(dailyData.usage || []);
      setScenarioStats(scenariosData.scenarios || []);
    } catch (err: any) {
      console.error('Failed to fetch admin data:', err);
      setError(err.message || 'Failed to load admin dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchTelnyxData = async () => {
    setTelnyxLoading(true);
    setTelnyxError(null);
    
    try {
      const token = localStorage.getItem('authToken');
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      // Fetch all Telnyx data in parallel
      const [statusRes, numbersRes, connectionsRes, recordingsRes, statsRes] = await Promise.all([
        fetch(`${getApiUrl()}/api/telnyx-admin/status`, { headers }),
        fetch(`${getApiUrl()}/api/telnyx-admin/phone-numbers`, { headers }),
        fetch(`${getApiUrl()}/api/telnyx-admin/connections`, { headers }),
        fetch(`${getApiUrl()}/api/telnyx-admin/recordings?limit=50`, { headers }),
        fetch(`${getApiUrl()}/api/telnyx-admin/stats`, { headers })
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setTelnyxStatus(statusData);
      }

      if (numbersRes.ok) {
        const numbersData = await numbersRes.json();
        setTelnyxPhoneNumbers(numbersData.phoneNumbers || []);
      }

      if (connectionsRes.ok) {
        const connectionsData = await connectionsRes.json();
        setTelnyxConnections(connectionsData.connections || []);
      }

      if (recordingsRes.ok) {
        const recordingsData = await recordingsRes.json();
        setTelnyxRecordings(recordingsData.recordings || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setTelnyxStats(statsData);
      }

    } catch (err: any) {
      console.error('Failed to fetch Telnyx data:', err);
      setTelnyxError(err.message || 'Failed to load Telnyx data');
    } finally {
      setTelnyxLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [dateRange]);

  useEffect(() => {
    if (activeSection === 'telnyx') {
      fetchTelnyxData();
    }
  }, [activeSection]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(num));
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h3>
        <p className="text-gray-500 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  // Show message if no agent data
  const hasNoData = agentStats.length === 0;
  if (hasNoData) {
    console.warn('⚠️ No agent data found. This could mean: 1) No training sessions, 2) No call logs, or 3) Query issue');
  }

  // Calculate totals
  const totalCost = (costs?.totalCostUsd || 0) + (callCosts?.totalCost || 0);

  // Section Cards Configuration
  const sectionCards = [
    {
      id: 'costs' as const,
      title: 'Costs & Billing',
      description: 'View all platform costs: Telnyx calls, OpenAI, ElevenLabs TTS',
      icon: DollarSign,
      gradient: 'from-green-500 to-emerald-600',
      stat: formatCurrency(totalCost),
      subtext: 'Total spend'
    },
    {
      id: 'performance' as const,
      title: 'Performance',
      description: 'Team agent metrics, call stats, and training scores',
      icon: TrendingUp,
      gradient: 'from-blue-500 to-indigo-600',
      stat: agentStats.length.toString(),
      subtext: 'Active agents'
    },
    {
      id: 'training-settings' as const,
      title: 'Training Settings',
      description: 'AI behavior, scenarios, and voice configuration',
      icon: Brain,
      gradient: 'from-purple-500 to-pink-600',
      stat: scenarioStats.length.toString(),
      subtext: 'Scenarios'
    },
    {
      id: 'team' as const,
      title: 'Team Management',
      description: 'Manage team members, roles, and permissions',
      icon: Users,
      gradient: 'from-orange-500 to-red-600',
      stat: agentStats.length.toString(),
      subtext: 'Team members'
    },
    {
      id: 'telnyx' as const,
      title: 'Telnyx Settings',
      description: 'Phone numbers, connections, recordings, and voice settings',
      icon: PhoneCall,
      gradient: 'from-teal-500 to-cyan-600',
      stat: telnyxStats?.phoneNumbers?.total?.toString() || '—',
      subtext: 'Phone numbers'
    }
  ];

  // Render Section Header with Back Button
  const renderSectionHeader = (title: string) => (
    <div className="flex items-center gap-4 mb-6">
      <button
        onClick={() => setActiveSection('home')}
        className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition text-gray-700 dark:text-gray-300"
      >
        <ArrowLeft size={18} />
        Back to Dashboard
      </button>
      <div className="flex-1">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
      </div>
      {activeSection !== 'team' && activeSection !== 'training-settings' && (
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="appearance-none bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-2 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <button
            onClick={fetchAdminData}
            className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Home View - Card Navigation */}
      {activeSection === 'home' && (
        <>
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your platform, view costs, and monitor performance</p>
            </div>
          </div>

          {/* Section Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {sectionCards.map((card) => (
              <button
                key={card.id}
                onClick={() => setActiveSection(card.id)}
                className="group text-left bg-white dark:bg-slate-800 rounded-xl shadow-md hover:shadow-xl border border-gray-200 dark:border-slate-700 overflow-hidden transition-all duration-300 hover:scale-[1.03]"
              >
                <div className={`bg-gradient-to-br ${card.gradient} p-4 text-white flex flex-col items-center`}>
                  <card.icon className="w-14 h-14 opacity-95" />
                  <div className="mt-2 text-center">
                    <div className="text-2xl font-bold">{card.stat}</div>
                    <div className="text-xs opacity-80">{card.subtext}</div>
                  </div>
                </div>
                <div className="p-3 text-center">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">{card.title}</h3>
                </div>
              </button>
            ))}
          </div>

          {/* Quick Stats Summary */}
          <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-700 rounded-2xl p-6 border border-blue-100 dark:border-slate-600">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Quick Overview</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalCost)}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Total Cost</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{callCosts?.totalCalls || 0}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Total Calls</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{costs?.totalSessions || 0}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Training Sessions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{agentStats.length}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Team Members</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Costs Section */}
      {activeSection === 'costs' && (
        <>
          {renderSectionHeader('Costs & Billing')}
          
          {/* Cost Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <DollarSign className="w-8 h-8 opacity-80" />
                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Total Platform</span>
              </div>
              <div className="text-3xl font-bold mb-1">{formatCurrency(totalCost)}</div>
              <p className="text-green-100 text-sm">All services combined</p>
            </div>

            <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl p-5 text-white shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <Phone className="w-8 h-8 opacity-80" />
                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Telnyx Calls</span>
              </div>
              <div className="text-3xl font-bold mb-1">{formatCurrency(callCosts?.totalCost || 0)}</div>
              <p className="text-cyan-100 text-sm">{callCosts?.totalCalls || 0} calls • {Math.round((callCosts?.totalMinutes || 0))} mins</p>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <MessageSquare className="w-8 h-8 opacity-80" />
                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">OpenAI Chat</span>
              </div>
              <div className="text-3xl font-bold mb-1">{formatCurrency(costs?.chatCost || 0)}</div>
              <p className="text-blue-100 text-sm">{formatNumber(costs?.inputTokens || 0)} in / {formatNumber(costs?.outputTokens || 0)} out</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-5 text-white shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <Mic className="w-8 h-8 opacity-80" />
                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">ElevenLabs TTS</span>
              </div>
              <div className="text-3xl font-bold mb-1">{formatCurrency(costs?.ttsCost || 0)}</div>
              <p className="text-purple-100 text-sm">{formatDuration(costs?.totalAudioSeconds || 0)} of audio</p>
            </div>
          </div>

          {/* Detailed Cost Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Telnyx Pricing Info */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Phone className="w-5 h-5 text-cyan-500" />
                Telnyx Call Pricing
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">Outbound/Inbound Calls</span>
                  <span className="font-bold text-gray-900 dark:text-white">$0.002/min</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">Call Recording</span>
                  <span className="font-bold text-gray-900 dark:text-white">$0.002/min</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">Recording Storage</span>
                  <span className="font-bold text-green-600 dark:text-green-400">FREE</span>
                </div>
                <div className="mt-4 p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-800">
                  <div className="text-sm text-cyan-700 dark:text-cyan-300">
                    <strong>Total for recorded calls:</strong> $0.004/min
                  </div>
                </div>
              </div>
            </div>

            {/* AI Pricing Info */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-500" />
                AI Training Pricing
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">GPT-4o-mini Input</span>
                  <span className="font-bold text-gray-900 dark:text-white">$0.15/1M tokens</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">GPT-4o-mini Output</span>
                  <span className="font-bold text-gray-900 dark:text-white">$0.60/1M tokens</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">ElevenLabs TTS</span>
                  <span className="font-bold text-gray-900 dark:text-white">$15/1M chars</span>
                </div>
                <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="text-sm text-purple-700 dark:text-purple-300">
                    <strong>Estimated:</strong> ~$30-50/month for 10 agents, 5 sessions/day
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Usage Chart */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 mt-6">
            <div className="p-5 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-green-500" />
                Daily Cost Trend
              </h3>
            </div>
            <div className="p-5">
              {dailyUsage.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No usage data available</p>
              ) : (
                <div className="space-y-3">
                  {dailyUsage.slice(-10).map((day) => (
                    <div key={day.date} className="flex items-center gap-3">
                      <div className="w-20 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="flex-1 h-6 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (day.costUsd / Math.max(...dailyUsage.map(d => d.costUsd || 0.01))) * 100)}%` }}
                        />
                      </div>
                      <div className="w-16 text-right text-sm font-medium">{day.sessions} sess</div>
                      <div className="w-24 text-right text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(day.costUsd)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Performance Section */}
      {activeSection === 'performance' && (
        <>
          {renderSectionHeader('Performance')}
          
          {/* Agent Comparison Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="p-5 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                Agent Performance Comparison
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-700/50">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Agent</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sessions</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Messages</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Duration</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Score</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cost</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Training</th>
                  </tr>
                </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {agentStats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                      <p className="text-gray-600 dark:text-gray-400 font-medium">No agent performance data yet</p>
                      <p className="text-sm text-gray-500 dark:text-gray-500">Data will appear after agents complete training sessions or make calls</p>
                    </div>
                  </td>
                </tr>
              ) : (
                agentStats.map((agent, idx) => (
                  <tr key={agent.userId} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                          idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-600' : 'bg-blue-500'
                        }`}>
                          {idx < 3 ? (
                            <Award className="w-5 h-5" />
                          ) : (
                            agent.userName?.charAt(0)?.toUpperCase() || 'A'
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">{agent.userName || 'Unknown'}</div>
                          <div className="text-xs text-gray-500">{agent.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center font-medium">{agent.totalSessions}</td>
                    <td className="px-5 py-4 text-center">{agent.totalMessages}</td>
                    <td className="px-5 py-4 text-center">{formatDuration(agent.avgSessionDuration || 0)}</td>
                    <td className="px-5 py-4 text-center">
                      {agent.avgScore ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          agent.avgScore >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          agent.avgScore >= 60 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {Math.round(agent.avgScore)}%
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center font-mono text-sm">{formatCurrency(agent.totalCostUsd || 0)}</td>
                    <td className="px-5 py-4 text-center text-sm text-gray-500">
                      {agent.lastTrainingDate ? new Date(agent.lastTrainingDate).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agent Call Performance & Analytics */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="p-5 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Phone className="w-5 h-5 text-green-500" />
            Agent Call Performance & Activity
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Real calls, training sessions, and online time tracking</p>
        </div>
        <div className="p-5">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 dark:border-slate-700">
                <tr>
                  <th className="text-left pb-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Agent</th>
                  <th className="text-center pb-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Real Calls</th>
                  <th className="text-center pb-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Connected</th>
                  <th className="text-center pb-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Success Rate</th>
                  <th className="text-center pb-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Training</th>
                  <th className="text-center pb-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Online Time</th>
                  <th className="text-center pb-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Performance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {agentStats.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500 dark:text-gray-400">
                      No agent activity data available
                    </td>
                  </tr>
                ) : (
                  agentStats.map((agent) => {
                    // Use real data from API
                    const totalCalls = agent.totalCalls || 0;
                    const connectedCalls = agent.connectedCalls || 0;
                    const successRate = agent.successRate || 0;
                    const onlineHours = agent.onlineHours || 0;
                    const trainingScore = agent.trainingScore || 0;
                    const performanceScore = agent.performanceScore || 0;
                    
                    return (
                      <tr key={agent.userId} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
                              {agent.userName?.charAt(0)?.toUpperCase() || 'A'}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white text-sm">{agent.userName}</div>
                              <div className="text-xs text-gray-500">{agent.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 text-center font-semibold text-gray-900 dark:text-white">{totalCalls}</td>
                        <td className="py-4 text-center">
                          <span className="text-green-600 dark:text-green-400 font-medium">{connectedCalls}</span>
                        </td>
                        <td className="py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-sm font-bold ${
                              successRate >= 50 ? 'text-green-600 dark:text-green-400' :
                              successRate >= 30 ? 'text-yellow-600 dark:text-yellow-400' :
                              'text-red-600 dark:text-red-400'
                            }`}>
                              {successRate.toFixed(1)}%
                            </span>
                            <div className="w-16 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${
                                  successRate >= 50 ? 'bg-green-500' :
                                  successRate >= 30 ? 'bg-yellow-500' :
                                  'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(successRate, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                              {agent.totalSessions} sessions
                            </span>
                            {trainingScore > 0 && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                trainingScore >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                trainingScore >= 60 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              }`}>
                                {Math.round(trainingScore)}%
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">{onlineHours}h</span>
                            <span className="text-xs text-gray-500">this period</span>
                          </div>
                        </td>
                        <td className="py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-2xl font-bold ${
                              performanceScore >= 75 ? 'text-green-600 dark:text-green-400' :
                              performanceScore >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                              'text-red-600 dark:text-red-400'
                            }`}>
                              {Math.round(performanceScore)}
                            </span>
                            <span className="text-xs text-gray-500">overall</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Scenario Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scenario Stats */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
          <div className="p-5 border-b border-gray-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-500" />
              Scenario Performance
            </h3>
          </div>
          <div className="p-5 space-y-4">
            {scenarioStats.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">No scenario data available</p>
            ) : (
              scenarioStats.map((scenario) => (
                <div key={scenario.scenarioId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{scenario.scenarioName}</div>
                    <div className="text-xs text-gray-500">{scenario.totalSessions} sessions • Avg {formatDuration(scenario.avgDuration)}</div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                    scenario.avgScore >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    scenario.avgScore >= 60 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    scenario.avgScore > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-gray-100 text-gray-500 dark:bg-slate-600 dark:text-gray-400'
                  }`}>
                    {scenario.avgScore > 0 ? `${Math.round(scenario.avgScore)}%` : 'N/A'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Daily Usage Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
          <div className="p-5 border-b border-gray-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-green-500" />
              Daily Usage Trend
            </h3>
          </div>
          <div className="p-5">
            {dailyUsage.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">No usage data available</p>
            ) : (
              <div className="space-y-3">
                {dailyUsage.slice(-10).map((day) => (
                  <div key={day.date} className="flex items-center gap-3">
                    <div className="w-20 text-xs text-gray-500 dark:text-gray-400">
                      {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="flex-1 h-6 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (day.sessions / Math.max(...dailyUsage.map(d => d.sessions || 1))) * 100)}%` }}
                      />
                    </div>
                    <div className="w-16 text-right text-sm font-medium">{day.sessions} sess</div>
                    <div className="w-20 text-right text-xs text-gray-500">{formatCurrency(day.costUsd)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cost Breakdown Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 OpenAI API Pricing Reference</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-800 dark:text-blue-200">
          <div>
            <strong>GPT-4o-mini:</strong>
            <ul className="list-disc list-inside mt-1 text-blue-700 dark:text-blue-300">
              <li>Input: $0.15 / 1M tokens</li>
              <li>Output: $0.60 / 1M tokens</li>
            </ul>
          </div>
          <div>
            <strong>TTS (Text-to-Speech):</strong>
            <ul className="list-disc list-inside mt-1 text-blue-700 dark:text-blue-300">
              <li>$15.00 / 1M characters</li>
              <li>~$0.015 per 1000 chars</li>
            </ul>
          </div>
          <div>
            <strong>Estimated Monthly:</strong>
            <ul className="list-disc list-inside mt-1 text-blue-700 dark:text-blue-300">
              <li>10 agents, 5 sessions/day</li>
              <li>≈ $30-50/month</li>
            </ul>
          </div>
        </div>
      </div>
        </>
      )}

      {/* Training Settings Section */}
      {activeSection === 'training-settings' && (
        <>
          {renderSectionHeader('Training Settings')}
          <TrainingSettings currentUser={currentUser} />
        </>
      )}

      {/* Team Management Section */}
      {activeSection === 'team' && (
        <>
          {renderSectionHeader('Team Management')}
          <TeamManagement currentUser={currentUser} />
        </>
      )}

      {/* Telnyx Management Section */}
      {activeSection === 'telnyx' && (
        <>
          {renderSectionHeader('Telnyx Settings')}
          
          {telnyxLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading Telnyx data...</span>
            </div>
          ) : telnyxError ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
              <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">Failed to Load Telnyx Data</h3>
              <p className="text-red-600 dark:text-red-300 mb-4">{telnyxError}</p>
              <button 
                onClick={fetchTelnyxData}
                className="px-4 py-2 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 rounded-lg hover:bg-red-200 dark:hover:bg-red-700 transition"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Connection Status */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-100 dark:border-slate-700 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Connection Status</span>
                    {telnyxStatus?.configured ? (
                      <span className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold rounded-full">
                        <Wifi className="w-3 h-3" /> Connected
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-semibold rounded-full">
                        <WifiOff className="w-3 h-3" /> Disconnected
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {telnyxStatus?.connectionId ? `#${telnyxStatus.connectionId.slice(-6)}` : '—'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Connection ID</p>
                </div>

                {/* Account Balance */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-100 dark:border-slate-700 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Account Balance</span>
                    <CreditCard className="w-5 h-5 text-teal-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    ${parseFloat(telnyxStatus?.balance?.balance || '0').toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{telnyxStatus?.balance?.currency || 'USD'}</p>
                </div>

                {/* Phone Numbers */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-100 dark:border-slate-700 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone Numbers</span>
                    <Hash className="w-5 h-5 text-blue-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {telnyxStats?.phoneNumbers?.total || telnyxPhoneNumbers.length || 0}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {telnyxStats?.phoneNumbers?.active || 0} active
                  </p>
                </div>

                {/* Recordings */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-100 dark:border-slate-700 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Recordings</span>
                    <Volume2 className="w-5 h-5 text-purple-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {telnyxStats?.recordings?.total || telnyxRecordings.length || 0}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {telnyxStats?.recordings?.totalDuration ? formatDuration(telnyxStats.recordings.totalDuration / 1000) : '0s'} total
                  </p>
                </div>
              </div>

              {/* Caller ID Info */}
              {telnyxStatus?.callerId && (
                <div className="bg-gradient-to-r from-teal-500 to-cyan-600 rounded-xl p-5 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90 mb-1">Configured Caller ID</p>
                      <p className="text-2xl font-bold">{telnyxStatus.callerId}</p>
                    </div>
                    <PhoneCall className="w-10 h-10 opacity-50" />
                  </div>
                </div>
              )}

              {/* Tab Navigation */}
              <div className="flex gap-2 border-b border-gray-200 dark:border-slate-700 pb-2">
                {[
                  { id: 'overview' as const, label: 'Overview', icon: Globe },
                  { id: 'numbers' as const, label: 'Phone Numbers', icon: Hash },
                  { id: 'connections' as const, label: 'Connections', icon: Radio },
                  { id: 'recordings' as const, label: 'Recordings', icon: Volume2 },
                  { id: 'messaging' as const, label: 'Messaging', icon: MessageSquare }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setTelnyxTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                      telnyxTab === tab.id
                        ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
                {/* Overview Tab */}
                {telnyxTab === 'overview' && (
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Connection Details</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex justify-between py-3 border-b border-gray-100 dark:border-slate-700">
                          <span className="text-gray-500 dark:text-gray-400">API Configuration</span>
                          <span className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            {telnyxStatus?.configured ? (
                              <><CheckCircle className="w-4 h-4 text-green-500" /> Configured</>
                            ) : (
                              <><AlertCircle className="w-4 h-4 text-red-500" /> Not Configured</>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between py-3 border-b border-gray-100 dark:border-slate-700">
                          <span className="text-gray-500 dark:text-gray-400">Connection ID</span>
                          <span className="font-mono text-sm text-gray-900 dark:text-white">{telnyxStatus?.connectionId || '—'}</span>
                        </div>
                        <div className="flex justify-between py-3 border-b border-gray-100 dark:border-slate-700">
                          <span className="text-gray-500 dark:text-gray-400">Caller ID</span>
                          <span className="font-medium text-gray-900 dark:text-white">{telnyxStatus?.callerId || '—'}</span>
                        </div>
                        <div className="flex justify-between py-3 border-b border-gray-100 dark:border-slate-700">
                          <span className="text-gray-500 dark:text-gray-400">Balance</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            ${parseFloat(telnyxStatus?.balance?.balance || '0').toFixed(2)} {telnyxStatus?.balance?.currency}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between py-3 border-b border-gray-100 dark:border-slate-700">
                          <span className="text-gray-500 dark:text-gray-400">Total Phone Numbers</span>
                          <span className="font-medium text-gray-900 dark:text-white">{telnyxPhoneNumbers.length}</span>
                        </div>
                        <div className="flex justify-between py-3 border-b border-gray-100 dark:border-slate-700">
                          <span className="text-gray-500 dark:text-gray-400">Voice Connections</span>
                          <span className="font-medium text-gray-900 dark:text-white">{telnyxConnections.length}</span>
                        </div>
                        <div className="flex justify-between py-3 border-b border-gray-100 dark:border-slate-700">
                          <span className="text-gray-500 dark:text-gray-400">Recordings Available</span>
                          <span className="font-medium text-gray-900 dark:text-white">{telnyxRecordings.length}</span>
                        </div>
                        <div className="flex justify-between py-3 border-b border-gray-100 dark:border-slate-700">
                          <span className="text-gray-500 dark:text-gray-400">API Status</span>
                          <span className="font-medium text-green-600 dark:text-green-400">Operational</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        <strong>Note:</strong> Telnyx is your voice provider for making and receiving calls. 
                        All call control operations are handled through their APIs.
                      </p>
                    </div>
                  </div>
                )}

                {/* Phone Numbers Tab */}
                {telnyxTab === 'numbers' && (
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Phone Numbers</h3>
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search numbers..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 pr-4 py-2 bg-gray-100 dark:bg-slate-700 border-0 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    </div>

                    {telnyxPhoneNumbers.length === 0 ? (
                      <div className="text-center py-12">
                        <Hash className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">No phone numbers found</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              <th className="pb-3">Phone Number</th>
                              <th className="pb-3">Status</th>
                              <th className="pb-3">Connection ID</th>
                              <th className="pb-3">Inbound Limit</th>
                              <th className="pb-3">Outbound Limit</th>
                              <th className="pb-3">Created</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                            {telnyxPhoneNumbers
                              .filter(n => !searchQuery || n.phone_number.includes(searchQuery))
                              .map((number) => (
                              <tr key={number.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                                <td className="py-4">
                                  <span className="font-mono font-medium text-gray-900 dark:text-white">{number.phone_number}</span>
                                </td>
                                <td className="py-4">
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                    number.status === 'active' 
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                  }`}>
                                    {number.status === 'active' && <CheckCircle className="w-3 h-3" />}
                                    {number.status}
                                  </span>
                                </td>
                                <td className="py-4 text-sm text-gray-500 dark:text-gray-400 font-mono">
                                  {number.connection_id ? `...${number.connection_id.slice(-8)}` : '—'}
                                </td>
                                <td className="py-4 text-sm text-gray-900 dark:text-white">
                                  {number.inbound_channel_limit || '∞'}
                                </td>
                                <td className="py-4 text-sm text-gray-900 dark:text-white">
                                  {number.outbound_channel_limit || '∞'}
                                </td>
                                <td className="py-4 text-sm text-gray-500 dark:text-gray-400">
                                  {new Date(number.created_at).toLocaleDateString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Connections Tab */}
                {telnyxTab === 'connections' && (
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Voice Connections</h3>

                    {telnyxConnections.length === 0 ? (
                      <div className="text-center py-12">
                        <Radio className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">No connections found</p>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {telnyxConnections.map((conn) => (
                          <div key={conn.id} className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-5">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white">{conn.connection_name}</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">ID: {conn.id}</p>
                              </div>
                              <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                conn.active 
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                              }`}>
                                {conn.active ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                                {conn.active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            {conn.webhook_url && (
                              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                <ExternalLink className="w-4 h-4" />
                                <span className="truncate">{conn.webhook_url}</span>
                              </div>
                            )}
                            <div className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                              Created: {new Date(conn.created_at).toLocaleDateString()} • 
                              Updated: {new Date(conn.updated_at).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Recordings Tab */}
                {telnyxTab === 'recordings' && (
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Call Recordings</h3>

                    {telnyxRecordings.length === 0 ? (
                      <div className="text-center py-12">
                        <Volume2 className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">No recordings available</p>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Call recordings will appear here after calls are completed</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {telnyxRecordings.map((rec) => (
                          <div key={rec.id} className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                                <Volume2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">
                                  Recording #{rec.id.slice(-8)}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {formatDuration(rec.duration_millis / 1000)} • {new Date(rec.created_at).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                rec.status === 'completed' 
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                              }`}>
                                {rec.status}
                              </span>
                              {rec.download_urls?.mp3 && (
                                <a
                                  href={rec.download_urls.mp3}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-lg hover:bg-teal-200 dark:hover:bg-teal-800 transition"
                                >
                                  <Play className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Messaging Tab */}
                {telnyxTab === 'messaging' && (
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Messaging Configuration</h3>
                    
                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-6 text-center">
                      <MessageSquare className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">SMS/MMS Messaging</h4>
                      <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                        Configure messaging profiles and phone number settings for SMS/MMS capabilities.
                        Messaging features can be enabled on your phone numbers through the Telnyx portal.
                      </p>
                      <a
                        href="https://portal.telnyx.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open Telnyx Portal
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Refresh Button */}
              <div className="flex justify-end">
                <button
                  onClick={fetchTelnyxData}
                  disabled={telnyxLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition"
                >
                  <Loader2 className={`w-4 h-4 ${telnyxLoading ? 'animate-spin' : ''}`} />
                  Refresh Data
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
