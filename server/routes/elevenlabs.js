/**
 * ElevenLabs API Routes
 * Endpoints for managing ElevenLabs voice configuration
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const config = require('../config/config');

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Get API key from config
const getApiKey = () => config.elevenlabs?.apiKey || process.env.ELEVENLABS_API_KEY;

// Helper to make ElevenLabs API requests
const elevenLabsRequest = async (endpoint, options = {}) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured');
  }

  const response = await fetch(`${ELEVENLABS_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail?.message || error.message || `ElevenLabs API error: ${response.status}`);
  }

  return response.json();
};

// Check if ElevenLabs is configured
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      return res.json({
        configured: false,
        message: 'ElevenLabs API key not configured'
      });
    }

    // Verify API key by fetching user info
    const user = await elevenLabsRequest('/user');
    
    res.json({
      configured: true,
      subscription: {
        tier: user.subscription?.tier || 'free',
        characterCount: user.subscription?.character_count || 0,
        characterLimit: user.subscription?.character_limit || 0,
        canExtendCharacterLimit: user.subscription?.can_extend_character_limit || false,
        allowedToExtendCharacterLimit: user.subscription?.allowed_to_extend_character_limit || false,
        nextCharacterCountResetUnix: user.subscription?.next_character_count_reset_unix,
        voiceLimit: user.subscription?.voice_limit || 0,
        maxVoiceAddEdits: user.subscription?.max_voice_add_edits || 0,
        canExtendVoiceLimit: user.subscription?.can_extend_voice_limit || false,
        canUseInstantVoiceCloning: user.subscription?.can_use_instant_voice_cloning || false,
        canUseProfessionalVoiceCloning: user.subscription?.can_use_professional_voice_cloning || false,
      },
      user: {
        email: user.email,
        firstName: user.first_name,
      }
    });
  } catch (error) {
    console.error('ElevenLabs status check error:', error);
    res.json({
      configured: false,
      error: error.message
    });
  }
});

// Get all available voices
router.get('/voices', authMiddleware, async (req, res) => {
  try {
    const data = await elevenLabsRequest('/voices');
    
    // Format voices with additional info
    const voices = (data.voices || []).map(voice => ({
      voice_id: voice.voice_id,
      name: voice.name,
      category: voice.category || 'premade',
      description: voice.description,
      preview_url: voice.preview_url,
      labels: voice.labels || {},
      settings: voice.settings || {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0,
        use_speaker_boost: true,
        speed: 1.0
      },
      fine_tuning: voice.fine_tuning,
      available_for_tiers: voice.available_for_tiers,
      high_quality_base_model_ids: voice.high_quality_base_model_ids,
    }));

    res.json({ 
      voices,
      total: voices.length
    });
  } catch (error) {
    console.error('Fetch voices error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get voice settings
router.get('/voices/:voiceId/settings', authMiddleware, async (req, res) => {
  try {
    const { voiceId } = req.params;
    const settings = await elevenLabsRequest(`/voices/${voiceId}/settings`);
    res.json(settings);
  } catch (error) {
    console.error('Get voice settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update voice settings
router.post('/voices/:voiceId/settings', authMiddleware, async (req, res) => {
  try {
    const { voiceId } = req.params;
    const { stability, similarity_boost, style, use_speaker_boost, speed } = req.body;

    await elevenLabsRequest(`/voices/${voiceId}/settings/edit`, {
      method: 'POST',
      body: JSON.stringify({
        stability,
        similarity_boost,
        style,
        use_speaker_boost,
        speed
      })
    });

    res.json({ success: true, message: 'Voice settings updated' });
  } catch (error) {
    console.error('Update voice settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available models
router.get('/models', authMiddleware, async (req, res) => {
  try {
    const data = await elevenLabsRequest('/models');
    
    const models = (data || []).map(model => ({
      model_id: model.model_id,
      name: model.name,
      description: model.description,
      can_be_finetuned: model.can_be_finetuned,
      can_do_text_to_speech: model.can_do_text_to_speech,
      can_do_voice_conversion: model.can_do_voice_conversion,
      can_use_style: model.can_use_style,
      can_use_speaker_boost: model.can_use_speaker_boost,
      serves_pro_voices: model.serves_pro_voices,
      token_cost_factor: model.token_cost_factor,
      languages: model.languages?.map(l => ({
        language_id: l.language_id,
        name: l.name
      })) || [],
      max_characters_request_free_user: model.max_characters_request_free_user,
      max_characters_request_subscribed_user: model.max_characters_request_subscribed_user,
    }));

    res.json({ models });
  } catch (error) {
    console.error('Fetch models error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get default voice settings
router.get('/settings/default', authMiddleware, async (req, res) => {
  try {
    const settings = await elevenLabsRequest('/voices/settings/default');
    res.json(settings);
  } catch (error) {
    console.error('Get default settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate voice preview (text-to-speech)
router.post('/preview', authMiddleware, async (req, res) => {
  try {
    const { voice_id, text, model_id, voice_settings } = req.body;

    if (!voice_id || !text) {
      return res.status(400).json({ error: 'voice_id and text are required' });
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return res.status(400).json({ error: 'ElevenLabs API key not configured' });
    }

    // Make TTS request
    const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: model_id || 'eleven_multilingual_v2',
        voice_settings: voice_settings || {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail?.message || 'Failed to generate preview');
    }

    // Convert to base64
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    res.json({
      audio: `data:audio/mpeg;base64,${base64}`,
      format: 'mp3'
    });
  } catch (error) {
    console.error('Voice preview error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get usage statistics
router.get('/usage', authMiddleware, async (req, res) => {
  try {
    const user = await elevenLabsRequest('/user');
    
    res.json({
      character_count: user.subscription?.character_count || 0,
      character_limit: user.subscription?.character_limit || 0,
      remaining: (user.subscription?.character_limit || 0) - (user.subscription?.character_count || 0),
      reset_date: user.subscription?.next_character_count_reset_unix 
        ? new Date(user.subscription.next_character_count_reset_unix * 1000).toISOString()
        : null,
      tier: user.subscription?.tier || 'free'
    });
  } catch (error) {
    console.error('Get usage error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get voice library (shared voices)
router.get('/voice-library', authMiddleware, async (req, res) => {
  try {
    const { page_size = 30, category, gender, age, language } = req.query;
    
    let url = `/shared-voices?page_size=${page_size}`;
    if (category) url += `&category=${category}`;
    if (gender) url += `&gender=${gender}`;
    if (age) url += `&age=${age}`;
    if (language) url += `&language=${language}`;

    const data = await elevenLabsRequest(url);
    
    res.json({
      voices: data.voices || [],
      has_more: data.has_more || false,
      last_sort_id: data.last_sort_id
    });
  } catch (error) {
    console.error('Get voice library error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add voice from library
router.post('/add-voice', authMiddleware, async (req, res) => {
  try {
    const { public_user_id, voice_id, new_name } = req.body;

    if (!public_user_id || !voice_id) {
      return res.status(400).json({ error: 'public_user_id and voice_id are required' });
    }

    const data = await elevenLabsRequest('/voices/add', {
      method: 'POST',
      body: JSON.stringify({
        public_user_id,
        voice_id,
        new_name
      })
    });

    res.json(data);
  } catch (error) {
    console.error('Add voice error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save voice configuration to database
router.post('/config/save', authMiddleware, async (req, res) => {
  try {
    const pool = require('../config/database');
    const { default_voice_id, default_model_id, voice_settings } = req.body;

    // Check if config exists
    const existing = await pool.query(
      "SELECT * FROM ai_agent_settings WHERE key = 'elevenlabs_config'"
    );

    const configValue = JSON.stringify({
      default_voice_id,
      default_model_id,
      voice_settings,
      updated_at: new Date().toISOString()
    });

    if (existing.rows.length > 0) {
      await pool.query(
        "UPDATE ai_agent_settings SET value = $1, updated_at = NOW() WHERE key = 'elevenlabs_config'",
        [configValue]
      );
    } else {
      await pool.query(
        "INSERT INTO ai_agent_settings (key, value, category, description) VALUES ($1, $2, 'voice', 'ElevenLabs voice configuration')",
        ['elevenlabs_config', configValue]
      );
    }

    res.json({ success: true, message: 'Configuration saved' });
  } catch (error) {
    console.error('Save config error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get saved voice configuration
router.get('/config', authMiddleware, async (req, res) => {
  try {
    const pool = require('../config/database');
    
    const result = await pool.query(
      "SELECT value FROM ai_agent_settings WHERE key = 'elevenlabs_config'"
    );

    if (result.rows.length > 0) {
      res.json(JSON.parse(result.rows[0].value));
    } else {
      res.json({
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
    }
  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
