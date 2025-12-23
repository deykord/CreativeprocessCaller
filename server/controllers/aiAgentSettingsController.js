/**
 * AI Agent Settings Controller
 * Handles CRUD operations for AI training agent configuration
 */

const pool = require('../config/database');
const { DEFAULT_PROMPTS, PERSONALITY_TRAITS, HUMAN_SPEECH_PATTERNS, buildSystemPrompt } = require('../config/agentPrompts');

/**
 * Get all AI agent settings
 */
exports.getAllSettings = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM ai_agent_settings ORDER BY category, setting_key'
    );
    
    // If no settings in DB, return defaults
    if (result.rows.length === 0) {
      return res.json({
        settings: getDefaultSettings(),
        isDefault: true
      });
    }
    
    // Convert DB rows to settings object
    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_key] = {
        value: row.setting_value,
        description: row.description,
        category: row.category,
        updatedAt: row.updated_at
      };
    });
    
    res.json({ settings, isDefault: false });
  } catch (error) {
    console.error('Error fetching AI settings:', error);
    res.status(500).json({ error: 'Failed to fetch AI agent settings' });
  }
};

/**
 * Get default settings structure
 */
function getDefaultSettings() {
  return {
    basePersonality: {
      value: DEFAULT_PROMPTS.basePersonality,
      description: 'Base personality and behavior rules for all AI agents',
      category: 'prompts'
    },
    scenarios: {
      value: DEFAULT_PROMPTS.scenarios,
      description: 'Scenario-specific prompts and voice settings',
      category: 'scenarios'
    },
    behaviorSettings: {
      value: DEFAULT_PROMPTS.behaviorSettings,
      description: 'Global behavior modifiers',
      category: 'behavior'
    },
    personalityTraits: {
      value: PERSONALITY_TRAITS,
      description: 'Available personality trait presets',
      category: 'traits'
    },
    humanSpeechPatterns: {
      value: HUMAN_SPEECH_PATTERNS,
      description: 'Human-like speech patterns to inject',
      category: 'patterns'
    }
  };
}

/**
 * Get settings by category
 */
exports.getSettingsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM ai_agent_settings WHERE category = $1 ORDER BY setting_key',
      [category]
    );
    
    if (result.rows.length === 0) {
      // Return defaults for this category
      const defaults = getDefaultSettings();
      const categoryDefaults = {};
      Object.entries(defaults).forEach(([key, value]) => {
        if (value.category === category) {
          categoryDefaults[key] = value;
        }
      });
      return res.json({ settings: categoryDefaults, isDefault: true });
    }
    
    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_key] = {
        value: row.setting_value,
        description: row.description,
        category: row.category,
        updatedAt: row.updated_at
      };
    });
    
    res.json({ settings, isDefault: false });
  } catch (error) {
    console.error('Error fetching settings by category:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

/**
 * Get a specific setting
 */
exports.getSetting = async (req, res) => {
  try {
    const { key } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM ai_agent_settings WHERE setting_key = $1',
      [key]
    );
    
    if (result.rows.length === 0) {
      // Return default if exists
      const defaults = getDefaultSettings();
      if (defaults[key]) {
        return res.json({ setting: defaults[key], isDefault: true });
      }
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    const row = result.rows[0];
    res.json({
      setting: {
        value: row.setting_value,
        description: row.description,
        category: row.category,
        updatedAt: row.updated_at
      },
      isDefault: false
    });
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
};

/**
 * Update or create a setting
 */
exports.updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value, description, category } = req.body;
    const userId = req.userId;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }
    
    // Upsert the setting
    const result = await pool.query(
      `INSERT INTO ai_agent_settings (setting_key, setting_value, description, category, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (setting_key) 
       DO UPDATE SET 
         setting_value = $2,
         description = COALESCE($3, ai_agent_settings.description),
         category = COALESCE($4, ai_agent_settings.category),
         updated_by = $5,
         updated_at = NOW()
       RETURNING *`,
      [key, JSON.stringify(value), description, category || 'general', userId]
    );
    
    console.log(`✅ AI setting updated: ${key} by user ${userId}`);
    
    res.json({
      success: true,
      setting: {
        key: result.rows[0].setting_key,
        value: result.rows[0].setting_value,
        description: result.rows[0].description,
        category: result.rows[0].category,
        updatedAt: result.rows[0].updated_at
      }
    });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
};

/**
 * Update multiple settings at once
 */
exports.updateMultipleSettings = async (req, res) => {
  try {
    const { settings } = req.body;
    const userId = req.userId;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const results = [];
      for (const [key, data] of Object.entries(settings)) {
        const { value, description, category } = data;
        
        const result = await client.query(
          `INSERT INTO ai_agent_settings (setting_key, setting_value, description, category, updated_by, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (setting_key) 
           DO UPDATE SET 
             setting_value = $2,
             description = COALESCE($3, ai_agent_settings.description),
             category = COALESCE($4, ai_agent_settings.category),
             updated_by = $5,
             updated_at = NOW()
           RETURNING *`,
          [key, JSON.stringify(value), description, category || 'general', userId]
        );
        
        results.push(result.rows[0]);
      }
      
      await client.query('COMMIT');
      
      console.log(`✅ ${results.length} AI settings updated by user ${userId}`);
      
      res.json({
        success: true,
        updated: results.length,
        settings: results
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating multiple settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

/**
 * Reset settings to defaults
 */
exports.resetToDefaults = async (req, res) => {
  try {
    const { category } = req.query;
    const userId = req.userId;
    
    if (category) {
      // Reset only specific category
      await pool.query(
        'DELETE FROM ai_agent_settings WHERE category = $1',
        [category]
      );
      console.log(`🔄 AI settings reset to defaults for category: ${category} by user ${userId}`);
    } else {
      // Reset all
      await pool.query('DELETE FROM ai_agent_settings');
      console.log(`🔄 All AI settings reset to defaults by user ${userId}`);
    }
    
    res.json({
      success: true,
      message: category ? `Settings for ${category} reset to defaults` : 'All settings reset to defaults'
    });
  } catch (error) {
    console.error('Error resetting settings:', error);
    res.status(500).json({ error: 'Failed to reset settings' });
  }
};

/**
 * Get complete prompt for a scenario (combines base + scenario + settings)
 */
exports.getScenarioPrompt = async (req, res) => {
  try {
    const { scenarioId } = req.params;
    
    // Try to get custom settings from DB
    const settingsResult = await pool.query(
      "SELECT * FROM ai_agent_settings WHERE setting_key IN ('basePersonality', 'behaviorSettings', 'scenarios')"
    );
    
    let basePersonality = DEFAULT_PROMPTS.basePersonality;
    let behaviorSettings = DEFAULT_PROMPTS.behaviorSettings;
    let scenarios = DEFAULT_PROMPTS.scenarios;
    
    // Override with DB values if they exist
    settingsResult.rows.forEach(row => {
      if (row.setting_key === 'basePersonality') {
        basePersonality = row.setting_value;
      } else if (row.setting_key === 'behaviorSettings') {
        behaviorSettings = row.setting_value;
      } else if (row.setting_key === 'scenarios') {
        scenarios = row.setting_value;
      }
    });
    
    const scenario = scenarios[scenarioId];
    if (!scenario) {
      return res.status(404).json({ error: `Scenario not found: ${scenarioId}` });
    }
    
    const fullPrompt = `${basePersonality}

=== SCENARIO ===
${scenario.systemPrompt}

=== BEHAVIOR SETTINGS ===
- Resistance Level: ${Math.round(behaviorSettings.baseResistance * 100)}%
- Max Exchanges Before Decision: ${behaviorSettings.maxExchanges}
- Booking Probability (if earned): ${Math.round(behaviorSettings.bookingProbability * 100)}%
- Use Human Speech Patterns: ${behaviorSettings.useHumanPatterns ? 'Yes' : 'No'}
- Response Length: ${behaviorSettings.responseLength}`;
    
    res.json({
      scenarioId,
      scenarioName: scenario.name,
      fullPrompt,
      voiceSettings: scenario.voiceSettings,
      behaviorSettings
    });
  } catch (error) {
    console.error('Error getting scenario prompt:', error);
    res.status(500).json({ error: 'Failed to get scenario prompt' });
  }
};

/**
 * Get available scenarios list
 */
exports.getScenarios = async (req, res) => {
  try {
    // Try to get custom scenarios from DB
    const result = await pool.query(
      "SELECT setting_value FROM ai_agent_settings WHERE setting_key = 'scenarios'"
    );
    
    const scenarios = result.rows.length > 0 
      ? result.rows[0].setting_value 
      : {};
    
    // Convert to array format with full data
    const scenarioList = Object.entries(scenarios).map(([id, data]) => ({
      id,
      name: data.name,
      description: data.description || '',
      systemPrompt: data.systemPrompt || '',
      voiceSettings: data.voiceSettings || { speed: 1.0, pitch: 1.0, stability: 0.7 },
      difficulty: data.difficulty || 'medium',
      tags: data.tags || []
    }));
    
    res.json({ scenarios: scenarioList });
  } catch (error) {
    console.error('Error getting scenarios:', error);
    res.status(500).json({ error: 'Failed to get scenarios' });
  }
};

/**
 * Create a new scenario
 */
exports.createScenario = async (req, res) => {
  try {
    const { name, description, systemPrompt, voiceSettings, difficulty, tags } = req.body;
    const userId = req.userId;
    
    if (!name || !systemPrompt) {
      return res.status(400).json({ error: 'Name and systemPrompt are required' });
    }
    
    // Generate scenario ID from name
    const scenarioId = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
    
    // Get current scenarios
    const result = await pool.query(
      "SELECT setting_value FROM ai_agent_settings WHERE setting_key = 'scenarios'"
    );
    
    let scenarios = result.rows.length > 0 
      ? result.rows[0].setting_value 
      : {};
    
    // Check for duplicate ID
    if (scenarios[scenarioId]) {
      return res.status(400).json({ error: 'A scenario with a similar name already exists' });
    }
    
    // Create the scenario
    scenarios[scenarioId] = {
      name,
      description: description || '',
      systemPrompt,
      voiceSettings: voiceSettings || { speed: 1.0, pitch: 1.0, stability: 0.7 },
      difficulty: difficulty || 'medium',
      tags: tags || [],
      createdAt: new Date().toISOString(),
      createdBy: userId
    };
    
    // Save to DB
    await pool.query(
      `INSERT INTO ai_agent_settings (setting_key, setting_value, description, category, updated_by, updated_at)
       VALUES ('scenarios', $1, 'Admin-created training scenarios', 'scenarios', $2, NOW())
       ON CONFLICT (setting_key) 
       DO UPDATE SET setting_value = $1, updated_by = $2, updated_at = NOW()`,
      [JSON.stringify(scenarios), userId]
    );
    
    console.log(`✅ Scenario "${name}" created by user ${userId}`);
    
    res.json({
      success: true,
      scenario: {
        id: scenarioId,
        ...scenarios[scenarioId]
      }
    });
  } catch (error) {
    console.error('Error creating scenario:', error);
    res.status(500).json({ error: 'Failed to create scenario' });
  }
};

/**
 * Delete a scenario
 */
exports.deleteScenario = async (req, res) => {
  try {
    const { scenarioId } = req.params;
    const userId = req.userId;
    
    // Get current scenarios
    const result = await pool.query(
      "SELECT setting_value FROM ai_agent_settings WHERE setting_key = 'scenarios'"
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No scenarios exist' });
    }
    
    let scenarios = result.rows[0].setting_value;
    
    if (!scenarios[scenarioId]) {
      return res.status(404).json({ error: `Scenario not found: ${scenarioId}` });
    }
    
    const deletedName = scenarios[scenarioId].name;
    delete scenarios[scenarioId];
    
    // Save to DB
    await pool.query(
      `UPDATE ai_agent_settings SET setting_value = $1, updated_by = $2, updated_at = NOW() WHERE setting_key = 'scenarios'`,
      [JSON.stringify(scenarios), userId]
    );
    
    console.log(`🗑️ Scenario "${deletedName}" deleted by user ${userId}`);
    
    res.json({
      success: true,
      message: `Scenario "${deletedName}" deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting scenario:', error);
    res.status(500).json({ error: 'Failed to delete scenario' });
  }
};

/**
 * Duplicate a scenario
 */
exports.duplicateScenario = async (req, res) => {
  try {
    const { scenarioId } = req.params;
    const { newName } = req.body;
    const userId = req.userId;
    
    // Get current scenarios
    const result = await pool.query(
      "SELECT setting_value FROM ai_agent_settings WHERE setting_key = 'scenarios'"
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No scenarios exist' });
    }
    
    let scenarios = result.rows[0].setting_value;
    
    if (!scenarios[scenarioId]) {
      return res.status(404).json({ error: `Scenario not found: ${scenarioId}` });
    }
    
    const originalScenario = scenarios[scenarioId];
    const duplicateName = newName || `${originalScenario.name} (Copy)`;
    
    // Generate new ID
    const newScenarioId = duplicateName.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
    
    // Create duplicate
    scenarios[newScenarioId] = {
      ...originalScenario,
      name: duplicateName,
      createdAt: new Date().toISOString(),
      createdBy: userId
    };
    
    // Save to DB
    await pool.query(
      `UPDATE ai_agent_settings SET setting_value = $1, updated_by = $2, updated_at = NOW() WHERE setting_key = 'scenarios'`,
      [JSON.stringify(scenarios), userId]
    );
    
    console.log(`📋 Scenario "${originalScenario.name}" duplicated as "${duplicateName}" by user ${userId}`);
    
    res.json({
      success: true,
      scenario: {
        id: newScenarioId,
        ...scenarios[newScenarioId]
      }
    });
  } catch (error) {
    console.error('Error duplicating scenario:', error);
    res.status(500).json({ error: 'Failed to duplicate scenario' });
  }
};

/**
 * Update a specific scenario
 */
exports.updateScenario = async (req, res) => {
  try {
    const { scenarioId } = req.params;
    const { name, systemPrompt, voiceSettings } = req.body;
    const userId = req.userId;
    
    // Get current scenarios
    const result = await pool.query(
      "SELECT setting_value FROM ai_agent_settings WHERE setting_key = 'scenarios'"
    );
    
    let scenarios = result.rows.length > 0 
      ? result.rows[0].setting_value 
      : { ...DEFAULT_PROMPTS.scenarios };
    
    if (!scenarios[scenarioId]) {
      return res.status(404).json({ error: `Scenario not found: ${scenarioId}` });
    }
    
    // Update the scenario
    scenarios[scenarioId] = {
      ...scenarios[scenarioId],
      ...(name && { name }),
      ...(systemPrompt && { systemPrompt }),
      ...(voiceSettings && { voiceSettings })
    };
    
    // Save back to DB
    await pool.query(
      `INSERT INTO ai_agent_settings (setting_key, setting_value, description, category, updated_by, updated_at)
       VALUES ('scenarios', $1, 'Scenario-specific prompts', 'scenarios', $2, NOW())
       ON CONFLICT (setting_key) 
       DO UPDATE SET setting_value = $1, updated_by = $2, updated_at = NOW()`,
      [JSON.stringify(scenarios), userId]
    );
    
    console.log(`✅ Scenario ${scenarioId} updated by user ${userId}`);
    
    res.json({
      success: true,
      scenario: {
        id: scenarioId,
        ...scenarios[scenarioId]
      }
    });
  } catch (error) {
    console.error('Error updating scenario:', error);
    res.status(500).json({ error: 'Failed to update scenario' });
  }
};

/**
 * Get behavior settings
 */
exports.getBehaviorSettings = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT setting_value FROM ai_agent_settings WHERE setting_key = 'behaviorSettings'"
    );
    
    const settings = result.rows.length > 0 
      ? result.rows[0].setting_value 
      : DEFAULT_PROMPTS.behaviorSettings;
    
    res.json({
      settings,
      isDefault: result.rows.length === 0
    });
  } catch (error) {
    console.error('Error getting behavior settings:', error);
    res.status(500).json({ error: 'Failed to get behavior settings' });
  }
};

/**
 * Update behavior settings
 */
exports.updateBehaviorSettings = async (req, res) => {
  try {
    const { settings } = req.body;
    const userId = req.userId;
    
    if (!settings) {
      return res.status(400).json({ error: 'Settings object is required' });
    }
    
    // Merge with defaults
    const merged = {
      ...DEFAULT_PROMPTS.behaviorSettings,
      ...settings
    };
    
    await pool.query(
      `INSERT INTO ai_agent_settings (setting_key, setting_value, description, category, updated_by, updated_at)
       VALUES ('behaviorSettings', $1, 'Global behavior modifiers', 'behavior', $2, NOW())
       ON CONFLICT (setting_key) 
       DO UPDATE SET setting_value = $1, updated_by = $2, updated_at = NOW()`,
      [JSON.stringify(merged), userId]
    );
    
    console.log(`✅ Behavior settings updated by user ${userId}`);
    
    res.json({
      success: true,
      settings: merged
    });
  } catch (error) {
    console.error('Error updating behavior settings:', error);
    res.status(500).json({ error: 'Failed to update behavior settings' });
  }
};

/**
 * Get base personality prompt
 */
exports.getBasePersonality = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT setting_value FROM ai_agent_settings WHERE setting_key = 'basePersonality'"
    );
    
    const prompt = result.rows.length > 0 
      ? result.rows[0].setting_value 
      : DEFAULT_PROMPTS.basePersonality;
    
    res.json({
      prompt,
      isDefault: result.rows.length === 0
    });
  } catch (error) {
    console.error('Error getting base personality:', error);
    res.status(500).json({ error: 'Failed to get base personality' });
  }
};

/**
 * Update base personality prompt
 */
exports.updateBasePersonality = async (req, res) => {
  try {
    const { prompt } = req.body;
    const userId = req.userId;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    await pool.query(
      `INSERT INTO ai_agent_settings (setting_key, setting_value, description, category, updated_by, updated_at)
       VALUES ('basePersonality', $1, 'Base personality prompt for all AI agents', 'prompts', $2, NOW())
       ON CONFLICT (setting_key) 
       DO UPDATE SET setting_value = $1, updated_by = $2, updated_at = NOW()`,
      [JSON.stringify(prompt), userId]
    );
    
    console.log(`✅ Base personality updated by user ${userId}`);
    
    res.json({
      success: true,
      prompt
    });
  } catch (error) {
    console.error('Error updating base personality:', error);
    res.status(500).json({ error: 'Failed to update base personality' });
  }
};
