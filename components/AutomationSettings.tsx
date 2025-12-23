import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings, MessageSquare, Phone, Clock, Zap, Save, Plus, Trash2, Star,
  CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp, Send, RefreshCw,
  VoicemailIcon, Mail, Calendar, BarChart2, Eye, HelpCircle, Mic, Shield,
  ArrowRight, Wifi, WifiOff, Activity, BookOpen, PlayCircle, Smartphone
} from 'lucide-react';
import { backendAPI } from '../services/BackendAPI';

interface SmsTemplate {
  id: string;
  name: string;
  content: string;
  is_default: boolean;
  is_active: boolean;
  use_count: number;
  created_at: string;
}

interface AutomationSettings {
  autoVoicemailDrop: boolean;
  defaultVoicemailId: string | null;
  autoSmsFollowup: boolean;
  defaultSmsTemplateId: string | null;
  smsDelaySeconds: number;
  autoScheduleCallback: boolean;
  callbackDelayHours: number;
}

interface AutomationStats {
  voicemailDrops: { total: number; withSms: number };
  sms: { total: number; auto: number; manual: number };
  callbacks: { total: number; pending: number; completed: number };
}

interface Voicemail {
  id: string;
  name: string;
  is_default: boolean;
}

interface SmsLog {
  id: string;
  to_number: string;
  content: string;
  status: string;
  trigger_type: string;
  sent_at: string;
  first_name?: string;
  last_name?: string;
  company?: string;
}

interface AutomationSettingsProps {
  currentUser?: { id: string; role?: string } | null;
}

const PLACEHOLDER_OPTIONS = [
  { label: 'First Name', value: '{{firstName}}' },
  { label: 'Last Name', value: '{{lastName}}' },
  { label: 'Full Name', value: '{{fullName}}' },
  { label: 'Company', value: '{{company}}' },
  { label: 'Email', value: '{{email}}' },
];

export const AutomationSettings: React.FC<AutomationSettingsProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'guide' | 'settings' | 'templates' | 'logs' | 'stats'>('guide');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [webhookHealth, setWebhookHealth] = useState<any>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<AutomationSettings>({
    autoVoicemailDrop: false,
    defaultVoicemailId: null,
    autoSmsFollowup: false,
    defaultSmsTemplateId: null,
    smsDelaySeconds: 10,
    autoScheduleCallback: false,
    callbackDelayHours: 24,
  });

  // Templates state
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateContent, setNewTemplateContent] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null);

  // Voicemails
  const [voicemails, setVoicemails] = useState<Voicemail[]>([]);

  // Stats & Logs
  const [stats, setStats] = useState<AutomationStats | null>(null);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [statsPeriod, setStatsPeriod] = useState<'today' | 'week' | 'month' | 'all'>('week');

  // Clear messages after timeout
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  // Fetch initial data
  useEffect(() => {
    fetchData();
  }, []);

  // Fetch stats when period changes
  useEffect(() => {
    if (activeTab === 'stats') {
      fetchStats();
    }
  }, [activeTab, statsPeriod]);

  // Fetch logs when tab changes
  useEffect(() => {
    if (activeTab === 'logs') {
      fetchSmsLogs();
    }
  }, [activeTab]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, templatesRes, voicemailsRes] = await Promise.all([
        backendAPI.get('/automation/settings'),
        backendAPI.get('/automation/sms-templates'),
        backendAPI.get('/voicemails'),
      ]);

      if (settingsRes) setSettings(settingsRes);
      if (templatesRes?.templates) setTemplates(templatesRes.templates);
      if (voicemailsRes?.voicemails) setVoicemails(voicemailsRes.voicemails);
    } catch (err: any) {
      console.error('Error fetching automation data:', err);
      setError(err.message || 'Failed to load automation settings');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = async () => {
    try {
      const res = await backendAPI.get(`/automation/stats?period=${statsPeriod}`);
      if (res) setStats(res);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchSmsLogs = async () => {
    try {
      const res = await backendAPI.get('/automation/sms/logs');
      if (res?.logs) setSmsLogs(res.logs);
    } catch (err) {
      console.error('Error fetching SMS logs:', err);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await backendAPI.put('/automation/settings', settings);
      setSuccess('Automation settings saved!');
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const createTemplate = async () => {
    if (!newTemplateName.trim() || !newTemplateContent.trim()) {
      setError('Template name and content are required');
      return;
    }

    try {
      const res = await backendAPI.post('/automation/sms-templates', {
        name: newTemplateName,
        content: newTemplateContent,
      });
      if (res?.template) {
        setTemplates(prev => [res.template, ...prev]);
        setNewTemplateName('');
        setNewTemplateContent('');
        setShowNewTemplate(false);
        setSuccess('Template created!');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create template');
    }
  };

  const updateTemplate = async (template: SmsTemplate) => {
    try {
      await backendAPI.put(`/automation/sms-templates/${template.id}`, {
        name: template.name,
        content: template.content,
      });
      setTemplates(prev => prev.map(t => t.id === template.id ? template : t));
      setEditingTemplate(null);
      setSuccess('Template updated!');
    } catch (err: any) {
      setError(err.message || 'Failed to update template');
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;

    try {
      await backendAPI.delete(`/automation/sms-templates/${id}`);
      setTemplates(prev => prev.filter(t => t.id !== id));
      setSuccess('Template deleted');
    } catch (err: any) {
      setError(err.message || 'Failed to delete template');
    }
  };

  const setDefaultTemplate = async (id: string) => {
    try {
      await backendAPI.post(`/automation/sms-templates/${id}/default`);
      setTemplates(prev => prev.map(t => ({
        ...t,
        is_default: t.id === id,
      })));
      setSettings(prev => ({ ...prev, defaultSmsTemplateId: id }));
      setSuccess('Default template set');
    } catch (err: any) {
      setError(err.message || 'Failed to set default template');
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    if (editingTemplate) {
      setEditingTemplate({
        ...editingTemplate,
        content: editingTemplate.content + placeholder,
      });
    } else {
      setNewTemplateContent(prev => prev + placeholder);
    }
  };

  // Fetch webhook health status
  const fetchWebhookHealth = async () => {
    setWebhookLoading(true);
    try {
      const res = await fetch('/api/telnyx/voice/health');
      if (res.ok) {
        const data = await res.json();
        setWebhookHealth(data);
      }
    } catch (err) {
      console.error('Failed to fetch webhook health:', err);
    } finally {
      setWebhookLoading(false);
    }
  };

  // Fetch webhook health when guide tab is active
  useEffect(() => {
    if (activeTab === 'guide') {
      fetchWebhookHealth();
    }
  }, [activeTab]);

  const renderGuideTab = () => (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 rounded-xl p-6 border border-purple-500/30">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-600/30 rounded-xl">
            <Zap className="w-8 h-8 text-purple-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white mb-2">Welcome to Sales Automation</h2>
            <p className="text-gray-300 leading-relaxed">
              Automate your sales workflow with intelligent voicemail drops, SMS follow-ups, and callback scheduling.
              This guide will walk you through setting up each feature step by step.
            </p>
          </div>
        </div>
      </div>

      {/* System Health Status */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="p-4 bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-teal-500 dark:text-teal-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">System Status</h3>
          </div>
          <button
            onClick={fetchWebhookHealth}
            disabled={webhookLoading}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${webhookLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center gap-2 mb-2">
              {webhookHealth?.status === 'healthy' ? (
                <Wifi className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-600 dark:text-red-400" />
              )}
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Webhook Status</span>
            </div>
            <p className={`text-lg font-bold ${webhookHealth?.status === 'healthy' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
              {webhookHealth?.status === 'healthy' ? 'Connected' : 'Checking...'}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Failover Status</span>
            </div>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">
              {webhookHealth?.failover?.enabled !== false ? 'Protected' : 'Inactive'}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="w-5 h-5 text-purple-500 dark:text-purple-400" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Calls</span>
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{webhookHealth?.activeCalls || 0}</p>
          </div>
        </div>
      </div>

      {/* Step-by-Step Setup Guides */}
      <div className="space-y-6">
        {/* Voicemail Setup Guide */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          <div className="p-4 bg-purple-50 dark:bg-purple-900/30 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600/30 rounded-lg">
                <Mic className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">🎙️ Voicemail Drop Setup</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Leave professional voicemails automatically when calls go to voicemail</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-6">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                1
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Record Your Voicemail Messages</h4>
                <p className="text-gray-700 dark:text-gray-400 text-sm mb-3">
                  Create pre-recorded voicemail messages that sound natural and professional. 
                  Record multiple versions for different scenarios (first contact, follow-up, etc.).
                </p>
                <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 mb-2">
                    <PlayCircle className="w-4 h-4" />
                    <span className="font-medium">Pro Tips:</span>
                  </div>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <li>• Keep messages under 30 seconds</li>
                    <li>• Include your name and company clearly</li>
                    <li>• End with a clear call-to-action</li>
                    <li>• Record in a quiet environment</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                2
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Upload or Record in App</h4>
                <p className="text-gray-700 dark:text-gray-400 text-sm mb-3">
                  Use the built-in recorder or upload pre-recorded audio files. 
                  We support MP3, WAV, and WebM formats.
                </p>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
                >
                  Go to Settings <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                3
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Enable Auto Voicemail Drop</h4>
                <p className="text-gray-700 dark:text-gray-400 text-sm mb-3">
                  Turn on automatic voicemail detection. When a call goes to voicemail, 
                  your pre-recorded message will be dropped automatically.
                </p>
                <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3 border border-green-200 dark:border-green-600/30">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    <span>Current Status: {settings.autoVoicemailDrop ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SMS Follow-up Setup Guide */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/30 rounded-lg">
                <MessageSquare className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">📱 SMS Follow-up Setup</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Automatically send SMS after voicemail drops to increase response rates</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-6">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                1
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Create SMS Templates</h4>
                <p className="text-gray-700 dark:text-gray-400 text-sm mb-3">
                  Write personalized SMS templates using dynamic placeholders. 
                  Messages are automatically personalized with the prospect's name and company.
                </p>
                <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <p className="text-sm text-gray-700 dark:text-gray-400 mb-2 font-medium">Example Template:</p>
                  <div className="bg-white dark:bg-gray-800 rounded p-3 font-mono text-sm text-blue-600 dark:text-blue-300">
                    Hi {'{{firstName}}'}, I just left you a voicemail regarding {'{{company}}'}. 
                    Would love to connect - what time works for a quick call? - Sarah
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs text-gray-500">Available placeholders:</span>
                    {PLACEHOLDER_OPTIONS.map(p => (
                      <span key={p.value} className="px-2 py-0.5 bg-blue-900/30 text-blue-400 text-xs rounded">
                        {p.value}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                2
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Configure Timing</h4>
                <p className="text-gray-700 dark:text-gray-400 text-sm mb-3">
                  Set how long to wait after the voicemail before sending the SMS. 
                  This makes your outreach feel more natural and less automated.
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-400">Current delay:</span>
                    <span className="text-gray-900 dark:text-white font-medium">{settings.smsDelaySeconds} seconds</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                3
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Set Default Template</h4>
                <p className="text-gray-700 dark:text-gray-400 text-sm mb-3">
                  Choose which template to use by default for automatic follow-ups. 
                  You can always change templates on a per-call basis.
                </p>
                <button
                  onClick={() => setActiveTab('templates')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
                >
                  Manage Templates <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                4
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Enable Auto SMS Follow-up</h4>
                <p className="text-gray-700 dark:text-gray-400 text-sm mb-3">
                  Turn on automatic SMS sending. Every time a voicemail is dropped, 
                  an SMS will be sent automatically.
                </p>
                <div className={`rounded-lg p-3 border ${settings.autoSmsFollowup ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-600/30' : 'bg-gray-100 dark:bg-gray-750 border-gray-300 dark:border-gray-600'}`}>
                  <div className={`flex items-center gap-2 text-sm ${settings.autoSmsFollowup ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-400'}`}>
                    {settings.autoSmsFollowup ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    <span>Current Status: {settings.autoSmsFollowup ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Callback Scheduling Guide */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          <div className="p-4 bg-green-50 dark:bg-green-900/30 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-600/30 rounded-lg">
                <Calendar className="w-5 h-5 text-green-700 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">📅 Auto Callback Scheduling</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Automatically schedule follow-up calls after voicemail drops</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <p className="text-gray-700 dark:text-gray-400 text-sm mb-4">
                  When enabled, the system will automatically create a callback reminder 
                  for each prospect who received a voicemail. This ensures no lead falls through the cracks.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Callback Delay</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{settings.callbackDelayHours} hours</p>
                    <p className="text-xs text-gray-600 dark:text-gray-500 mt-1">After voicemail drop</p>
                  </div>
                  <div className={`rounded-lg p-4 border ${settings.autoScheduleCallback ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-600/30' : 'bg-gray-50 dark:bg-gray-750 border-gray-200 dark:border-gray-600'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {settings.autoScheduleCallback ? <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" /> : <XCircle className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto-Schedule</span>
                    </div>
                    <p className={`text-lg font-bold ${settings.autoScheduleCallback ? 'text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                      {settings.autoScheduleCallback ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => setActiveTab('settings')}
              className="p-4 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-600/30 rounded-lg transition text-left"
            >
              <Settings className="w-6 h-6 text-purple-600 dark:text-purple-400 mb-2" />
              <p className="font-medium text-gray-900 dark:text-white">Configure Settings</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Enable/disable features</p>
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className="p-4 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-600/30 rounded-lg transition text-left"
            >
              <MessageSquare className="w-6 h-6 text-blue-400 mb-2" />
              <p className="font-medium text-white">SMS Templates</p>
              <p className="text-sm text-gray-400">Create & manage templates</p>
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className="p-4 bg-green-900/30 hover:bg-green-900/50 border border-green-600/30 rounded-lg transition text-left"
            >
              <BarChart2 className="w-6 h-6 text-green-400 mb-2" />
              <p className="font-medium text-white">View Statistics</p>
              <p className="text-sm text-gray-400">Track performance</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSettingsTab = () => (
    <div className="space-y-6">
      {/* Auto Voicemail Drop */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-600/20 rounded-lg">
              <VoicemailIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Auto Voicemail Drop</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Automatically drop voicemail when answering machine is detected</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoVoicemailDrop}
              onChange={(e) => setSettings(prev => ({ ...prev, autoVoicemailDrop: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        {settings.autoVoicemailDrop && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Default Voicemail</label>
            <select
              value={settings.defaultVoicemailId || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, defaultVoicemailId: e.target.value || null }))}
              className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Select a voicemail...</option>
              {voicemails.map(vm => (
                <option key={vm.id} value={vm.id}>
                  {vm.name} {vm.is_default ? '(Default)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Auto SMS Follow-up */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-600/20 rounded-lg">
              <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Auto SMS Follow-up</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Send SMS after voicemail drop</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoSmsFollowup}
              onChange={(e) => setSettings(prev => ({ ...prev, autoSmsFollowup: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {settings.autoSmsFollowup && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Default SMS Template</label>
              <select
                value={settings.defaultSmsTemplateId || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, defaultSmsTemplateId: e.target.value || null }))}
                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a template...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.is_default ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Delay Before Sending (seconds)
              </label>
              <input
                type="number"
                value={settings.smsDelaySeconds}
                onChange={(e) => setSettings(prev => ({ ...prev, smsDelaySeconds: parseInt(e.target.value) || 10 }))}
                min={0}
                max={300}
                className="w-32 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        )}
      </div>

      {/* Auto Schedule Callback */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-600/20 rounded-lg">
              <Calendar className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Auto Schedule Callback</h3>
              <p className="text-sm text-gray-400">Automatically schedule follow-up call after voicemail</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoScheduleCallback}
              onChange={(e) => setSettings(prev => ({ ...prev, autoScheduleCallback: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>

        {settings.autoScheduleCallback && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Callback Delay (hours)
            </label>
            <input
              type="number"
              value={settings.callbackDelayHours}
              onChange={(e) => setSettings(prev => ({ ...prev, callbackDelayHours: parseInt(e.target.value) || 24 }))}
              min={1}
              max={168}
              className="w-32 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-2">Recommended: 24-48 hours</p>
          </div>
        )}
      </div>

      {/* Save Button */}
      <button
        onClick={saveSettings}
        disabled={saving}
        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {saving ? (
          <RefreshCw className="w-5 h-5 animate-spin" />
        ) : (
          <Save className="w-5 h-5" />
        )}
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );

  const renderTemplatesTab = () => (
    <div className="space-y-4">
      {/* New Template Button */}
      <button
        onClick={() => setShowNewTemplate(true)}
        className="w-full bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg p-4 text-gray-400 hover:text-white hover:border-purple-500 transition-all flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        Create New SMS Template
      </button>

      {/* New Template Form */}
      {showNewTemplate && (
        <div className="bg-gray-800 rounded-lg p-6 border border-purple-500">
          <h3 className="font-semibold text-white mb-4">New SMS Template</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Template Name</label>
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., Voicemail Follow-up"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Message Content</label>
              <textarea
                value={newTemplateContent}
                onChange={(e) => setNewTemplateContent(e.target.value)}
                placeholder="Hi {{firstName}}, I just left you a voicemail regarding..."
                rows={4}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {PLACEHOLDER_OPTIONS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => insertPlaceholder(p.value)}
                    className="px-2 py-1 bg-gray-700 text-xs text-gray-300 rounded hover:bg-gray-600 transition-colors"
                  >
                    + {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={createTemplate}
                className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors"
              >
                Create Template
              </button>
              <button
                onClick={() => {
                  setShowNewTemplate(false);
                  setNewTemplateName('');
                  setNewTemplateContent('');
                }}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template List */}
      {templates.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No SMS templates yet</p>
          <p className="text-sm">Create your first template to get started</p>
        </div>
      ) : (
        templates.map(template => (
          <div key={template.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            {editingTemplate?.id === template.id ? (
              <div className="space-y-4">
                <input
                  type="text"
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                />
                <textarea
                  value={editingTemplate.content}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                  rows={4}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white resize-none"
                />
                <div className="flex flex-wrap gap-2">
                  {PLACEHOLDER_OPTIONS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => insertPlaceholder(p.value)}
                      className="px-2 py-1 bg-gray-700 text-xs text-gray-300 rounded hover:bg-gray-600"
                    >
                      + {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateTemplate(editingTemplate)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingTemplate(null)}
                    className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-white">{template.name}</h4>
                    {template.is_default && (
                      <span className="px-2 py-0.5 bg-purple-600/30 text-purple-300 text-xs rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3" /> Default
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!template.is_default && (
                      <button
                        onClick={() => setDefaultTemplate(template.id)}
                        className="p-2 text-gray-400 hover:text-yellow-400 transition-colors"
                        title="Set as default"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setEditingTemplate(template)}
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                      title="Edit"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteTemplate(template.id)}
                      className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-gray-300 text-sm whitespace-pre-wrap">{template.content}</p>
                <div className="mt-2 text-xs text-gray-500">
                  Used {template.use_count} times
                </div>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );

  const renderLogsTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">SMS Logs</h3>
        <button
          onClick={fetchSmsLogs}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {smsLogs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No SMS logs yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {smsLogs.map(log => (
            <div key={log.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-white font-medium">
                    {log.first_name ? `${log.first_name} ${log.last_name || ''}` : log.to_number}
                  </span>
                  {log.company && (
                    <span className="text-gray-400 text-sm ml-2">({log.company})</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    log.status === 'sent' || log.status === 'delivered' 
                      ? 'bg-green-600/20 text-green-400' 
                      : log.status === 'failed' 
                      ? 'bg-red-600/20 text-red-400'
                      : 'bg-yellow-600/20 text-yellow-400'
                  }`}>
                    {log.status}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    log.trigger_type === 'voicemail_followup' 
                      ? 'bg-purple-600/20 text-purple-400' 
                      : 'bg-blue-600/20 text-blue-400'
                  }`}>
                    {log.trigger_type === 'voicemail_followup' ? 'Auto' : 'Manual'}
                  </span>
                </div>
              </div>
              <p className="text-gray-300 text-sm">{log.content}</p>
              <p className="text-gray-500 text-xs mt-2">
                {new Date(log.sent_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderStatsTab = () => (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex gap-2">
        {(['today', 'week', 'month', 'all'] as const).map(period => (
          <button
            key={period}
            onClick={() => setStatsPeriod(period)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statsPeriod === period
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {period === 'all' ? 'All Time' : period.charAt(0).toUpperCase() + period.slice(1)}
          </button>
        ))}
      </div>

      {stats ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Voicemail Drops */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-600/20 rounded-lg">
                <VoicemailIcon className="w-5 h-5 text-purple-400" />
              </div>
              <h4 className="font-semibold text-white">Voicemail Drops</h4>
            </div>
            <p className="text-3xl font-bold text-white">{stats.voicemailDrops.total}</p>
            <p className="text-sm text-gray-400 mt-1">
              {stats.voicemailDrops.withSms} with SMS follow-up
            </p>
          </div>

          {/* SMS Sent */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-600/20 rounded-lg">
                <MessageSquare className="w-5 h-5 text-blue-400" />
              </div>
              <h4 className="font-semibold text-white">SMS Sent</h4>
            </div>
            <p className="text-3xl font-bold text-white">{stats.sms.total}</p>
            <div className="flex gap-4 mt-1 text-sm">
              <span className="text-purple-400">{stats.sms.auto} auto</span>
              <span className="text-blue-400">{stats.sms.manual} manual</span>
            </div>
          </div>

          {/* Callbacks */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-600/20 rounded-lg">
                <Calendar className="w-5 h-5 text-green-400" />
              </div>
              <h4 className="font-semibold text-white">Callbacks</h4>
            </div>
            <p className="text-3xl font-bold text-white">{stats.callbacks.total}</p>
            <div className="flex gap-4 mt-1 text-sm">
              <span className="text-yellow-400">{stats.callbacks.pending} pending</span>
              <span className="text-green-400">{stats.callbacks.completed} completed</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <BarChart2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Loading stats...</p>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Zap className="w-7 h-7 text-purple-500" />
          Automation Settings
        </h1>
        <p className="text-gray-400 mt-2">
          Configure voicemail drops, SMS follow-ups, and callback scheduling
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-4 p-4 bg-red-600/20 border border-red-500 rounded-lg flex items-center gap-3 text-red-400">
          <XCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-600/20 border border-green-500 rounded-lg flex items-center gap-3 text-green-400">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-800 rounded-lg p-1 overflow-x-auto">
        {[
          { id: 'guide', label: 'Setup Guide', icon: BookOpen },
          { id: 'settings', label: 'Settings', icon: Settings },
          { id: 'templates', label: 'SMS Templates', icon: MessageSquare },
          { id: 'logs', label: 'SMS Logs', icon: Eye },
          { id: 'stats', label: 'Statistics', icon: BarChart2 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'guide' && renderGuideTab()}
      {activeTab === 'settings' && renderSettingsTab()}
      {activeTab === 'templates' && renderTemplatesTab()}
      {activeTab === 'logs' && renderLogsTab()}
      {activeTab === 'stats' && renderStatsTab()}
    </div>
  );
};

export default AutomationSettings;
