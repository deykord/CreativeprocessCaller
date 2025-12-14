const dbService = require('../services/databaseService');
const openaiService = require('../services/openaiService');

// Check provider connection status based on env variables
exports.getProviderStatus = async (req, res) => {
  try {
    const statuses = {
      openai: !!process.env.OPENAI_API_KEY,
      elevenlabs: !!process.env.ELEVENLABS_API_KEY,
      vapi: !!process.env.VAPI_API_KEY,
      retell: !!process.env.RETELL_API_KEY,
      bland: !!process.env.BLAND_API_KEY,
      deepgram: !!process.env.DEEPGRAM_API_KEY
    };
    
    res.json(statuses);
  } catch (error) {
    console.error('Failed to get provider status:', error);
    res.status(500).json({ error: 'Failed to get provider status' });
  }
};

// Test provider connection
exports.testProvider = async (req, res) => {
  try {
    const { providerId } = req.params;
    
    let result = { configured: false, connected: false };
    
    if (providerId === 'openai') {
      result.configured = openaiService.isConfigured();
      if (result.configured) {
        result.connected = await openaiService.testConnection();
      }
    }
    // TODO: Add tests for other providers
    
    res.json(result);
  } catch (error) {
    console.error(`Failed to test ${req.params.providerId} connection:`, error);
    res.status(500).json({ error: 'Failed to test provider connection', details: error.message });
  }
};

// Get all training sessions
exports.getSessions = async (req, res) => {
  try {
    const sessions = await dbService.getTrainingSessions();
    res.json(sessions || []);
  } catch (error) {
    console.error('Failed to get training sessions:', error);
    res.status(500).json({ error: 'Failed to get training sessions' });
  }
};

// Start a new training session
exports.startSession = async (req, res) => {
  try {
    const { providerId, scenarioId, feedbackOptions } = req.body;
    const userId = req.user?.id || req.user?.userId;
    const userName = req.user?.firstName ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : 'Unknown';
    
    // Get scenario name from the predefined list
    const scenarioNames = {
      'cold-interested': 'Interested Prospect',
      'cold-skeptical': 'Skeptical Prospect',
      'cold-busy': 'Busy Executive',
      'cold-not-interested': 'Not Interested',
      'gk-helpful': 'Helpful Gatekeeper',
      'gk-blocking': 'Blocking Gatekeeper',
      'gk-voicemail': 'Voicemail Only',
      'obj-price': 'Price Objection',
      'obj-timing': 'Timing Objection',
      'obj-competitor': 'Already Have Solution',
      'obj-authority': 'No Decision Authority',
      'obj-stall': 'Send Me Info'
    };
    
    const session = {
      id: `training-${Date.now()}`,
      agentId: userId,
      agentName: userName,
      providerId,
      scenarioId,
      scenarioName: scenarioNames[scenarioId] || scenarioId,
      startTime: new Date().toISOString(),
      duration: 0,
      cost: 0,
      status: 'active',
      feedbackOptions
    };
    
    // Save session to database
    await dbService.createTrainingSession(session);
    
    // Initialize voice AI connection based on providerId
    let aiSession = null;
    
    if (providerId === 'openai') {
      try {
        aiSession = await openaiService.createSession({
          scenarioId,
          scenarioName: scenarioNames[scenarioId] || scenarioId,
          instructions: feedbackOptions?.customInstructions,
        });
        
        // Add AI session details to response
        session.aiSession = aiSession;
      } catch (error) {
        console.error('Failed to create OpenAI session:', error);
        // Continue without AI session - will fall back to mock
      }
    }
    // TODO: Add other providers (Vapi, Retell, ElevenLabs, etc.)
    
    res.json(session);
  } catch (error) {
    console.error('Failed to start training session:', error);
    res.status(500).json({ error: 'Failed to start training session' });
  }
};

// End a training session
exports.endSession = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the session
    const session = await dbService.getTrainingSession(id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Calculate duration and cost
    const endTime = new Date();
    const startTime = new Date(session.start_time);
    const durationSeconds = Math.floor((endTime - startTime) / 1000);
    
    // Cost per minute by provider
    const costPerMinute = {
      openai: 0.06,
      elevenlabs: 0.10,
      vapi: 0.05,
      retell: 0.10,
      bland: 0.09,
      deepgram: 0.02
    };
    
    const cost = (durationSeconds / 60) * (costPerMinute[session.provider_id] || 0.05);
    
    // Generate mock feedback scores (in production, this would come from AI analysis)
    const feedback = {
      overallScore: Math.floor(Math.random() * 30) + 70, // 70-100
      categories: {
        openingStrength: Math.floor(Math.random() * 30) + 70,
        objectionHandling: Math.floor(Math.random() * 30) + 70,
        rapport: Math.floor(Math.random() * 30) + 70,
        closingSkill: Math.floor(Math.random() * 30) + 70,
        tone: Math.floor(Math.random() * 30) + 70,
        pacing: Math.floor(Math.random() * 30) + 70
      },
      strengths: [
        'Good opening hook',
        'Maintained positive tone',
        'Asked probing questions'
      ],
      improvements: [
        'Could handle price objection better',
        'Try to create more urgency',
        'Follow up on buying signals'
      ]
    };
    
    // Update session in database
    const completedSession = await dbService.updateTrainingSession(id, {
      endTime: endTime.toISOString(),
      duration: durationSeconds,
      cost,
      score: feedback.overallScore,
      feedback: JSON.stringify(feedback),
      status: 'completed'
    });
    
    res.json({
      ...completedSession,
      feedback
    });
  } catch (error) {
    console.error('Failed to end training session:', error);
    res.status(500).json({ error: 'Failed to end training session' });
  }
};

// Get cost summary
exports.getCosts = async (req, res) => {
  try {
    const costs = await dbService.getTrainingCosts();
    res.json(costs || {
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      allTime: 0,
      byProvider: {},
      byAgent: {}
    });
  } catch (error) {
    console.error('Failed to get training costs:', error);
    res.status(500).json({ error: 'Failed to get training costs' });
  }
};
