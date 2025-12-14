const WebSocket = require('ws');
const config = require('../config/config');

/**
 * OpenAI Realtime API Service for AI Training Calls
 * Uses WebRTC for real-time voice conversations
 * Documentation: https://platform.openai.com/docs/guides/realtime
 */

class OpenAIService {
  constructor() {
    this.apiKey = config.openai.apiKey;
    this.model = config.openai.model;
    this.voice = config.openai.voice;
    this.sessions = new Map(); // Track active sessions
  }

  /**
   * Create a new training session with OpenAI Realtime API
   * @param {Object} options - Session configuration
   * @returns {Promise<Object>} Session details
   */
  async createSession(options = {}) {
    const {
      scenarioId,
      scenarioName,
      instructions,
      temperature = 0.8,
      maxResponseLength = 150,
    } = options;

    try {
      if (!this.apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      // Generate session-specific instructions based on scenario
      const systemInstructions = this.generateScenarioInstructions(
        scenarioId,
        scenarioName,
        instructions
      );

      // Create ephemeral session token for client-side WebRTC connection
      const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          voice: this.voice,
          instructions: systemInstructions,
          temperature,
          max_response_output_tokens: maxResponseLength,
          turn_detection: {
            type: 'server_vad', // Server-side Voice Activity Detection
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500,
          },
          input_audio_format: 'pcm16', // 16-bit PCM
          output_audio_format: 'pcm16',
          input_audio_transcription: {
            model: 'whisper-1',
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
      }

      const session = await response.json();
      
      // Store session details
      this.sessions.set(session.id, {
        ...session,
        scenarioId,
        scenarioName,
        startTime: new Date(),
        audioChunks: [],
        transcripts: [],
      });

      return {
        sessionId: session.id,
        clientSecret: session.client_secret && session.client_secret.value ? session.client_secret.value : session.client_secret,
        expiresAt: session.expires_at,
        instructions: systemInstructions,
      };

    } catch (error) {
      console.error('Failed to create OpenAI session:', error);
      throw error;
    }
  }

  /**
   * Generate scenario-specific instructions for the AI
   */
  generateScenarioInstructions(scenarioId, scenarioName, customInstructions) {
    const baseInstructions = `You are an AI-powered prospect in a sales training simulation. Your role is to help sales representatives practice their skills in a realistic environment.

Scenario: ${scenarioName}
Training Objective: Provide realistic responses while evaluating the sales rep's performance.

Guidelines:
- Stay in character throughout the conversation
- Respond naturally and conversationally
- Challenge the rep appropriately based on the scenario
- Note strong techniques and areas for improvement
- Keep responses concise (1-3 sentences typically)
- Be helpful but realistic`;

    const scenarioSpecifics = {
      'cold-interested': `
You are a potential customer who is genuinely interested in learning more about the product/service. Show curiosity, ask relevant questions, but also have some concerns about timing, budget, or fit. Be open to scheduling a follow-up call if the rep does well.`,

      'cold-skeptical': `
You are a prospect who has been burned by similar products before. Show skepticism, ask tough questions about ROI, and require strong proof points. Push back on claims but be willing to reconsider if presented with compelling evidence.`,

      'cold-busy': `
You are a busy executive with limited time. Be direct, somewhat impatient, and focused on quick value propositions. If the rep doesn't capture your interest in 30 seconds, express that you need to go. Reward efficiency and clarity.`,

      'cold-not-interested': `
You are polite but firm that you're not interested. You may have existing solutions, no budget, or other priorities. Test the rep's ability to handle rejection professionally while attempting to find a reason to continue the conversation.`,

      'gk-helpful': `
You are a friendly gatekeeper/assistant. You're willing to help but need to understand the purpose of the call and ensure it's valuable before connecting to your boss. Ask qualifying questions and appreciate professional, respectful approaches.`,

      'gk-blocking': `
You are a protective gatekeeper whose job is to screen calls. Be firm in asking purpose, be skeptical of sales calls, and require compelling reasons before agreeing to transfer. Test the rep's persistence and creativity.`,

      'obj-price': `
You are interested in the product but shocked by the price. Make price objections, compare to cheaper alternatives, and question the value. See if the rep can reframe pricing in terms of ROI and value rather than just cost.`,

      'obj-timing': `
You like the product but claim it's not the right time (too busy, end of quarter, need to plan, etc.). Test whether the rep can create urgency or find a way to move forward despite timing concerns.`,

      'obj-competitor': `
You already use a competitor's solution. Be somewhat satisfied with it but open to hearing about alternatives if they offer clear advantages. Challenge the rep to differentiate without bashing competitors.`,

      'obj-authority': `
You're interested but don't have decision-making authority. Test whether the rep can identify and navigate to the real decision-maker while still building rapport with you as an influencer.`,
    };

    const specificInstructions = scenarioSpecifics[scenarioId] || '';
    
    return `${baseInstructions}\n\n${specificInstructions}\n\n${customInstructions || ''}`;
  }

  /**
   * End a training session and analyze performance
   */
  async endSession(sessionId) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    const endTime = new Date();
    const duration = Math.floor((endTime - session.startTime) / 1000);
    const cost = (duration / 60) * 0.06; // $0.06 per minute

    // Generate AI feedback based on conversation
    const feedback = await this.generateFeedback(session);

    // Clean up session
    this.sessions.delete(sessionId);

    return {
      duration,
      cost,
      feedback,
      transcripts: session.transcripts,
    };
  }

  /**
   * Generate performance feedback based on the conversation
   */
  async generateFeedback(session) {
    // In production, this would use GPT-4 to analyze the full conversation
    // For now, return structured feedback format
    return {
      overallScore: Math.floor(Math.random() * 30) + 70,
      categories: {
        openingStrength: Math.floor(Math.random() * 30) + 70,
        objectionHandling: Math.floor(Math.random() * 30) + 70,
        rapport: Math.floor(Math.random() * 30) + 70,
        closingSkill: Math.floor(Math.random() * 30) + 70,
        tone: Math.floor(Math.random() * 30) + 70,
        pacing: Math.floor(Math.random() * 30) + 70,
      },
      strengths: [
        'Good opening hook',
        'Maintained positive tone',
        'Asked probing questions',
      ],
      improvements: [
        'Could handle objections better',
        'Try to create more urgency',
        'Follow up on buying signals',
      ],
      transcript: session.transcripts,
    };
  }

  /**
   * Store audio chunk for potential playback/review
   */
  storeAudioChunk(sessionId, audioData) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.audioChunks.push({
        timestamp: new Date(),
        data: audioData,
      });
    }
  }

  /**
   * Store transcript for analysis
   */
  storeTranscript(sessionId, speaker, text) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.transcripts.push({
        timestamp: new Date(),
        speaker, // 'agent' or 'ai'
        text,
      });
    }
  }

  /**
   * Check if OpenAI is properly configured
   */
  isConfigured() {
    return !!this.apiKey && this.apiKey.startsWith('sk-');
  }

  /**
   * Test the connection to OpenAI with timeout
   */
  async testConnection() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: controller.signal
      });

      clearTimeout(timeout);
      return response.ok;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('OpenAI connection test timeout after 10 seconds');
      } else {
        console.error('OpenAI connection test failed:', error);
      }
      return false;
    }
  }

  /**
   * Clean up sessions to prevent memory leaks
   */
  cleanupOldSessions() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.startTime < oneHourAgo) {
        console.log(`Cleaning up old session: ${sessionId}`);
        this.sessions.delete(sessionId);
      }
    }
  }
}

// Create singleton instance
const instance = new OpenAIService();

// Run cleanup every 30 minutes
setInterval(() => {
  instance.cleanupOldSessions();
}, 30 * 60 * 1000);

module.exports = instance;
