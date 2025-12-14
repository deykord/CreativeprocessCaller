const dbService = require('../services/databaseService');
const fs = require('fs').promises;
const path = require('path');

// Check provider connection status based on env variables
exports.getProviderStatus = async (req, res) => {
  try {
    const hasKey = !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-');
    console.log('OpenAI API Key check:', { 
      hasKey, 
      keyPrefix: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 10) + '...' : 'not set' 
    });
    
    const statuses = {
      openai: hasKey
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
    const { apiKey } = req.body;
    
    if (!apiKey || !apiKey.startsWith('sk-')) {
      return res.status(400).json({ success: false, error: 'Invalid API key format' });
    }

    // Test the key with a timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (response.ok) {
        return res.json({ success: true, message: 'API key is valid' });
      } else {
        return res.status(400).json({ 
          success: false, 
          error: `Invalid API key: ${response.status} ${response.statusText}` 
        });
      }
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError.name === 'AbortError') {
        return res.status(408).json({ success: false, error: 'Request timeout - OpenAI API took too long to respond' });
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
    const { apiKey } = req.body;
    
    if (!apiKey || !apiKey.startsWith('sk-')) {
      return res.status(400).json({ success: false, error: 'Invalid API key format' });
    }

    const envPath = path.join(__dirname, '../../.env');
    let envContent = '';
    
    try {
      envContent = await fs.readFile(envPath, 'utf8');
    } catch (error) {
      // File doesn't exist, create new
      envContent = '';
    }

    // Update or add OPENAI_API_KEY
    const lines = envContent.split('\n');
    let updated = false;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('OPENAI_API_KEY=')) {
        lines[i] = `OPENAI_API_KEY=${apiKey}`;
        updated = true;
        break;
      }
    }
    
    if (!updated) {
      lines.push(`OPENAI_API_KEY=${apiKey}`);
    }
    
    await fs.writeFile(envPath, lines.join('\n'), 'utf8');
    
    // Update process.env
    process.env.OPENAI_API_KEY = apiKey;
    
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
