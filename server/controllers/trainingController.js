const dbService = require('../services/databaseService');
const fs = require('fs').promises;
const path = require('path');

// Check provider connection status based on env variables
exports.getProviderStatus = async (req, res) => {
  try {
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-');
    const hasElevenLabsKey = !!process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY.length > 0;
    
    console.log('API Key check:', { 
      openai: hasOpenAIKey, 
      elevenlabs: hasElevenLabsKey,
      openaiPrefix: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 10) + '...' : 'not set',
      elevenLabsPrefix: process.env.ELEVENLABS_API_KEY ? process.env.ELEVENLABS_API_KEY.substring(0, 10) + '...' : 'not set'
    });
    
    const statuses = {
      openai: hasOpenAIKey,
      elevenlabs: hasElevenLabsKey
    };
    
    res.json(statuses);
  } catch (error) {
    console.error('Failed to get provider status:', error);
    res.status(500).json({ error: 'Failed to get provider status' });
  }
};

// Test API key with timeout
exports.testApiKey = async (req, res) => {
  try {
    const { apiKey, provider } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'API key is required' });
    }

    // Test the key with a timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      let response;
      
      if (provider === 'elevenlabs') {
        // Test ElevenLabs API key
        response = await fetch('https://api.elevenlabs.io/v1/user', {
          method: 'GET',
          headers: {
            'xi-api-key': apiKey
          },
          signal: controller.signal
        });
      } else {
        // Test OpenAI API key (default)
        if (!apiKey.startsWith('sk-')) {
          return res.status(400).json({ success: false, error: 'Invalid OpenAI API key format (must start with sk-)' });
        }
        
        response = await fetch('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });
      }

      clearTimeout(timeout);

      if (response.ok) {
        return res.json({ success: true, message: 'API key is valid' });
      } else {
        const errorText = await response.text();
        return res.status(400).json({ 
          success: false, 
          error: `Invalid API key: ${response.status} ${response.statusText}` 
        });
      }
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError.name === 'AbortError') {
        return res.status(408).json({ success: false, error: 'Request timeout - API took too long to respond' });
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('Failed to test API key:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to test API key' 
    });
  }
};

// Save API key to .env file
exports.saveApiKey = async (req, res) => {
  try {
    const { apiKey, provider } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'API key is required' });
    }

    const envPath = path.join(__dirname, '../../.env');
    let envContent = '';
    
    try {
      envContent = await fs.readFile(envPath, 'utf8');
    } catch (error) {
      // File doesn't exist, create new
      envContent = '';
    }

    // Determine which env variable to update
    const envVar = provider === 'elevenlabs' ? 'ELEVENLABS_API_KEY' : 'OPENAI_API_KEY';
    
    // Update or add the API key
    const lines = envContent.split('\n');
    let updated = false;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith(`${envVar}=`)) {
        lines[i] = `${envVar}=${apiKey}`;
        updated = true;
        break;
      }
    }
    
    if (!updated) {
      lines.push(`${envVar}=${apiKey}`);
    }
    
    await fs.writeFile(envPath, lines.join('\n'), 'utf8');
    
    // Update process.env
    process.env[envVar] = apiKey;
    
    // Reload config
    const config = require('../config/config');
    if (provider === 'elevenlabs') {
      config.elevenlabs.apiKey = apiKey;
    } else {
      config.openai.apiKey = apiKey;
    }
    
    res.json({ success: true, message: 'API key saved successfully' });
  } catch (error) {
    console.error('Failed to save API key:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to save API key' 
    });
  }
};

// Get all training sessions (disabled for now)
exports.getSessions = async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    console.error('Failed to get training sessions:', error);
    res.status(500).json({ error: 'Failed to get training sessions' });
  }
};

// Start a new training session (disabled for now)
exports.startSession = async (req, res) => {
  res.status(501).json({ error: 'Training sessions are temporarily disabled. Please configure OpenAI API key first.' });
};

// End a training session (disabled for now)
exports.endSession = async (req, res) => {
  res.status(501).json({ error: 'Training sessions are temporarily disabled.' });
};

// Get cost summary (disabled for now)
exports.getCosts = async (req, res) => {
  res.json({
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    allTime: 0,
    byProvider: {},
    byAgent: {}
  });
};
