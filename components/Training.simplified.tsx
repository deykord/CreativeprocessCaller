import React, { useState } from 'react';
import { GraduationCap, PlayCircle, BookOpen, Target, TrendingUp, Zap, CheckCircle, AlertCircle, Clock, Phone, Users, MessageSquare } from 'lucide-react';

const Training: React.FC = () => {
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);

  const scenarios = [
    {
      id: 'cold-call',
      title: 'Cold Call Introduction',
      icon: Phone,
      difficulty: 'Beginner',
      duration: '3-5 min',
      description: 'Practice your opening pitch and initial rapport building with a new prospect.',
      objectives: [
        'Deliver a compelling 30-second pitch',
        'Ask qualifying questions',
        'Handle initial resistance',
        'Book a follow-up meeting'
      ],
      tips: [
        'Start with a friendly greeting and clear introduction',
        'Focus on the prospect\'s pain points, not your product',
        'Use open-ended questions to encourage conversation',
        'Listen actively and respond to objections calmly'
      ],
      color: 'blue'
    },
    {
      id: 'gatekeeper',
      title: 'Navigate Gatekeeper',
      icon: Users,
      difficulty: 'Intermediate',
      duration: '2-4 min',
      description: 'Learn to professionally bypass gatekeepers and reach decision-makers.',
      objectives: [
        'Build rapport with the gatekeeper',
        'Demonstrate value without over-explaining',
        'Get transferred to the decision-maker',
        'Leave a positive impression'
      ],
      tips: [
        'Be respectful and treat gatekeepers as allies',
        'Use the decision-maker\'s first name confidently',
        'Keep your value proposition brief and intriguing',
        'Ask for help rather than demanding access'
      ],
      color: 'purple'
    },
    {
      id: 'objections',
      title: 'Handle Objections',
      icon: MessageSquare,
      difficulty: 'Advanced',
      duration: '5-7 min',
      description: 'Master common objections and turn them into opportunities.',
      objectives: [
        'Acknowledge concerns without being defensive',
        'Use objections to uncover deeper needs',
        'Provide value-based responses',
        'Move the conversation forward'
      ],
      tips: [
        'Listen fully before responding to objections',
        'Validate their concerns: "I understand why you\'d say that"',
        'Ask clarifying questions to understand the real issue',
        'Share relevant success stories or data'
      ],
      color: 'orange'
    },
    {
      id: 'closing',
      title: 'Close the Deal',
      icon: Target,
      difficulty: 'Advanced',
      duration: '4-6 min',
      description: 'Practice different closing techniques and ask for the commitment.',
      objectives: [
        'Recognize buying signals',
        'Use trial closes throughout conversation',
        'Handle last-minute hesitations',
        'Secure next steps or commitment'
      ],
      tips: [
        'Assume the sale and speak with confidence',
        'Offer choices: "Would Tuesday or Thursday work better?"',
        'Address final concerns without reopening negotiations',
        'Confirm next steps clearly before ending the call'
      ],
      color: 'green'
    },
    {
      id: 'follow-up',
      title: 'Effective Follow-Up',
      icon: TrendingUp,
      difficulty: 'Intermediate',
      duration: '3-5 min',
      description: 'Re-engage prospects who didn\'t commit on the first call.',
      objectives: [
        'Reference previous conversation naturally',
        'Provide new value or information',
        'Overcome "I\'m busy" responses',
        'Schedule the next step'
      ],
      tips: [
        'Open with value, not just "checking in"',
        'Mention something specific from your last conversation',
        'Be persistent but respectful of their time',
        'Offer multiple contact options (call, email, meeting)'
      ],
      color: 'indigo'
    }
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string; hover: string }> = {
      blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-700', hover: 'hover:border-blue-400 dark:hover:border-blue-500' },
      purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-700', hover: 'hover:border-purple-400 dark:hover:border-purple-500' },
      orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-700', hover: 'hover:border-orange-400 dark:hover:border-orange-500' },
      green: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-700', hover: 'hover:border-green-400 dark:hover:border-green-500' },
      indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-700', hover: 'hover:border-indigo-400 dark:hover:border-indigo-500' }
    };
    return colors[color];
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl shadow-lg">
            <GraduationCap size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">AI Sales Training</h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">Master your cold calling skills with AI-powered role-play scenarios</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <Zap size={24} />
              <span className="text-sm font-medium opacity-90">Available Now</span>
            </div>
            <p className="text-3xl font-bold">{scenarios.length}</p>
            <p className="text-sm opacity-90">Training Scenarios</p>
          </div>
          
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <Target size={24} />
              <span className="text-sm font-medium opacity-90">Skills Covered</span>
            </div>
            <p className="text-3xl font-bold">15+</p>
            <p className="text-sm opacity-90">Learning Objectives</p>
          </div>
          
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <Clock size={24} />
              <span className="text-sm font-medium opacity-90">Total Duration</span>
            </div>
            <p className="text-3xl font-bold">20-30</p>
            <p className="text-sm opacity-90">Minutes Practice Time</p>
          </div>
        </div>
      </div>

      {/* How to Use Section */}
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl shadow-sm border border-purple-200 dark:border-purple-700 p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen size={24} className="text-purple-600 dark:text-purple-400" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">How to Use AI Training</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-purple-200 dark:border-purple-700">
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold mb-3">1</div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Choose Scenario</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Select a training scenario that matches your current skill level and goals</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-purple-200 dark:border-purple-700">
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold mb-3">2</div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Review Objectives</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Read the learning objectives and tips before starting the session</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-purple-200 dark:border-purple-700">
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold mb-3">3</div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Start Training</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Click "Start Training" to begin your AI-powered role-play session</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-purple-200 dark:border-purple-700">
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold mb-3">4</div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Get Feedback</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Receive instant feedback on your performance and areas to improve</p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-purple-200 dark:border-purple-700">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-purple-600 dark:text-purple-400 flex-shrink-0 mt-1" />
            <div className="text-sm text-purple-900 dark:text-purple-100">
              <p className="font-semibold mb-1">Before You Start:</p>
              <p>Make sure your administrator has configured the AI providers in the Admin Dashboard. Both OpenAI and ElevenLabs need to be set up for training sessions to work properly.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Training Scenarios */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Training Scenarios</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {scenarios.map((scenario) => {
            const colors = getColorClasses(scenario.color);
            const Icon = scenario.icon;
            const isSelected = selectedScenario === scenario.id;
            
            return (
              <div
                key={scenario.id}
                className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border-2 transition-all duration-200 ${colors.border} ${colors.hover} ${
                  isSelected ? 'ring-2 ring-offset-2 ring-purple-500 dark:ring-offset-gray-900' : ''
                }`}
              >
                {/* Scenario Header */}
                <div className={`${colors.bg} p-6 rounded-t-2xl border-b-2 ${colors.border}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 ${colors.bg} rounded-xl border ${colors.border}`}>
                        <Icon size={24} className={colors.text} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{scenario.title}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${colors.bg} ${colors.text}`}>
                            {scenario.difficulty}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Clock size={14} />
                            {scenario.duration}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">{scenario.description}</p>
                </div>

                {/* Scenario Content */}
                <div className="p-6">
                  {/* Objectives */}
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Target size={18} className={colors.text} />
                      Learning Objectives
                    </h4>
                    <ul className="space-y-2">
                      {scenario.objectives.map((objective, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <CheckCircle size={16} className={`${colors.text} flex-shrink-0 mt-0.5`} />
                          <span>{objective}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Tips (collapsible when selected) */}
                  {isSelected && (
                    <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <Zap size={18} className={colors.text} />
                        Pro Tips
                      </h4>
                      <ul className="space-y-2">
                        {scenario.tips.map((tip, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <span className={`${colors.text} flex-shrink-0 mt-0.5`}>•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setSelectedScenario(isSelected ? null : scenario.id)}
                      className={`flex-1 py-3 px-4 rounded-xl font-medium transition ${
                        isSelected
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          : `${colors.bg} ${colors.text} hover:opacity-80`
                      }`}
                    >
                      {isSelected ? 'Hide Details' : 'View Details'}
                    </button>
                    
                    <button
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl font-medium transition shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed`}
                      disabled
                      title="Training sessions coming soon! AI providers need to be configured by your admin."
                    >
                      <PlayCircle size={20} />
                      Start Training
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div className="mt-8 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-2xl border border-yellow-200 dark:border-yellow-700 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle size={24} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-yellow-900 dark:text-yellow-100 mb-2">Training Sessions Coming Soon</h3>
            <p className="text-yellow-800 dark:text-yellow-200 mb-3">
              Interactive AI-powered training sessions are currently in development. Once your administrator configures the AI providers in the Admin Dashboard, you'll be able to start practicing these scenarios with realistic AI prospects.
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              <strong>What to expect:</strong> Real-time voice conversations with AI prospects, instant feedback on your performance, personalized coaching tips, and progress tracking across all scenarios.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Training;
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <div className="flex items-center gap-3">
                <Key size={24} className="text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">ElevenLabs API Key</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{loading ? 'Checking...' : currentKeys.elevenlabs}</p>
                </div>
              </div>
              {currentKeys.elevenlabs.includes('Configured') && (
                <CheckCircle size={24} className="text-green-500" />
              )}
            </div>
            
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <div className="flex items-center gap-3">
                <Key size={24} className="text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">OpenAI API Key</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{loading ? 'Checking...' : currentKeys.openai}</p>
                </div>
              </div>
              {currentKeys.openai.includes('Configured') && (
                <CheckCircle size={24} className="text-green-500" />
              )}
            </div>
          </div>
        </div>

        {/* API Key Configuration Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Configure API Keys</h3>
          
          <div className="space-y-4">
            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Provider
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setProvider('elevenlabs');
                    setApiKey('');
                    setTestStatus('idle');
                    setMessage('');
                  }}
                  className={`p-4 rounded-xl border-2 transition ${
                    provider === 'elevenlabs'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                  }`}
                >
                  <div className="font-medium text-gray-900 dark:text-white">ElevenLabs</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Recommended - Best voice quality</div>
                </button>
                
                <button
                  onClick={() => {
                    setProvider('openai');
                    setApiKey('');
                    setTestStatus('idle');
                    setMessage('');
                  }}
                  className={`p-4 rounded-xl border-2 transition ${
                    provider === 'openai'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                  }`}
                >
                  <div className="font-medium text-gray-900 dark:text-white">OpenAI</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">For AI conversation logic</div>
                </button>
              </div>
            </div>

            
            {/* API Key Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {provider === 'elevenlabs' ? 'ElevenLabs API Key' : 'OpenAI API Key'}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestStatus('idle');
                  setMessage('');
                }}
                placeholder={provider === 'elevenlabs' ? 'Enter your ElevenLabs API key...' : 'sk-proj-...'}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {provider === 'elevenlabs' ? (
                  <>Get your API key from <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-700 underline">ElevenLabs Dashboard</a></>
                ) : (
                  <>Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-700 underline">OpenAI Platform</a></>
                )}
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
            <p><strong>ElevenLabs:</strong> Industry-leading text-to-speech with the most natural, realistic voices. Perfect for training sessions. (~$0.30 per 1K characters)</p>
            <p><strong>OpenAI:</strong> Powers the conversational AI logic and understanding. Required for realistic prospect responses.</p>
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
