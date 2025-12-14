import React, { useState, useEffect } from 'react';
import { GraduationCap, CheckCircle, XCircle, AlertCircle, Save, Loader2, Key } from 'lucide-react';
import { backendAPI } from '../services/BackendAPI';

const Training: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [currentKey, setCurrentKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Load current API key status on mount
  useEffect(() => {
    loadApiKeyStatus();
  }, []);

  const loadApiKeyStatus = async () => {
    setLoading(true);
    try {
      const response = await backendAPI.request('/api/training/providers/status');
      if (response && response.openai) {
        setCurrentKey('Configured (hidden for security)');
        setTestStatus('success');
      } else {
        setCurrentKey('Not configured');
      }
    } catch (error) {
      console.error('Failed to load API key status:', error);
      setCurrentKey('Unable to check status');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    if (!apiKey || !apiKey.startsWith('sk-')) {
      setMessage('Please enter a valid OpenAI API key (starts with sk-)');
      setTestStatus('error');
      return;
    }

    setTestStatus('testing');
    setMessage('Testing connection...');
    
    try {
      const response = await backendAPI.request('/api/training/test-key', {
        method: 'POST',
        body: JSON.stringify({ apiKey })
      });

      if (response && response.success) {
        setTestStatus('success');
        setMessage('Connection successful! You can now save the key.');
      } else {
        setTestStatus('error');
        setMessage(response?.error || 'Connection test failed');
      }
    } catch (error: any) {
      setTestStatus('error');
      setMessage(error.message || 'Failed to test connection');
    }
  };

  const saveApiKey = async () => {
    if (!apiKey || !apiKey.startsWith('sk-')) {
      setMessage('Please enter a valid OpenAI API key');
      setTestStatus('error');
      return;
    }

    setSaving(true);
    setMessage('Saving API key...');
    
    try {
      const response = await backendAPI.request('/api/training/save-key', {
        method: 'POST',
        body: JSON.stringify({ apiKey })
      });

      if (response && response.success) {
        setMessage('API key saved successfully!');
        setTestStatus('success');
        setCurrentKey('Configured (hidden for security)');
        setApiKey('');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(response?.error || 'Failed to save API key');
        setTestStatus('error');
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to save API key');
      setTestStatus('error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl">
            <GraduationCap size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AI Training Setup</h1>
            <p className="text-gray-500 dark:text-gray-400">Configure OpenAI API for AI-powered training</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Current Status Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Current Configuration</h3>
          
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <div className="flex items-center gap-3">
              <Key size={24} className="text-gray-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">OpenAI API Key</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{loading ? 'Checking...' : currentKey}</p>
              </div>
            </div>
            {testStatus === 'success' && !loading && (
              <CheckCircle size={24} className="text-green-500" />
            )}
            {testStatus === 'error' && !loading && (
              <XCircle size={24} className="text-red-500" />
            )}
          </div>
        </div>

        {/* API Key Configuration Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Configure OpenAI API Key</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                OpenAI API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestStatus('idle');
                  setMessage('');
                }}
                placeholder="sk-proj-..."
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-700 underline">OpenAI Platform</a>
              </p>
            </div>

            {/* Status Message */}
            {message && (
              <div className={`flex items-start gap-3 p-4 rounded-xl ${
                testStatus === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' :
                testStatus === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' :
                'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
              }`}>
                {testStatus === 'success' && <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />}
                {testStatus === 'error' && <XCircle size={20} className="flex-shrink-0 mt-0.5" />}
                {testStatus === 'testing' && <Loader2 size={20} className="flex-shrink-0 mt-0.5 animate-spin" />}
                {testStatus === 'idle' && <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />}
                <p className="text-sm">{message}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={testConnection}
                disabled={!apiKey || testStatus === 'testing' || saving}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testStatus === 'testing' ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <CheckCircle size={20} />
                    Test Connection
                  </>
                )}
              </button>

              <button
                onClick={saveApiKey}
                disabled={!apiKey || saving || testStatus === 'testing'}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    Save API Key
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl shadow-sm border border-purple-200 dark:border-purple-700 p-6">
          <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100 mb-3">About AI Training</h3>
          <div className="space-y-2 text-sm text-purple-700 dark:text-purple-300">
            <p>
              This feature uses OpenAI's GPT-4 Realtime API to provide AI-powered voice training for your sales team.
            </p>
            <p className="font-medium">Features (Coming Soon):</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Practice cold calls with AI prospects</li>
              <li>Handle objections with realistic scenarios</li>
              <li>Get instant feedback on your performance</li>
              <li>Track improvement over time</li>
            </ul>
            <p className="text-xs mt-3 pt-3 border-t border-purple-200 dark:border-purple-700">
              Your API key is stored securely in the server environment and never exposed to the client.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Training;
