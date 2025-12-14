const config = require('../config/config');
const pool = require('../config/database');

// Store conversation history per session (in-memory cache, backed by DB)
const conversationHistory = new Map();

// Clean old conversations from memory (older than 30 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, data] of conversationHistory.entries()) {
    if (now - data.lastUpdated > 30 * 60 * 1000) {
      conversationHistory.delete(sessionId);
    }
  }
}, 5 * 60 * 1000); // Clean every 5 minutes

// Available OpenAI TTS voices
const AVAILABLE_VOICES = [
  { id: 'alloy', name: 'Alloy', description: 'Neutral, balanced', gender: 'neutral' },
  { id: 'echo', name: 'Echo', description: 'Warm, male', gender: 'male' },
  { id: 'fable', name: 'Fable', description: 'British accent, male', gender: 'male' },
  { id: 'onyx', name: 'Onyx', description: 'Deep, authoritative', gender: 'male' },
  { id: 'nova', name: 'Nova', description: 'Friendly, female', gender: 'female' },
  { id: 'shimmer', name: 'Shimmer', description: 'Soft, female', gender: 'female' }
];

// Get available voices
const getVoices = async (req, res) => {
  res.json({ success: true, voices: AVAILABLE_VOICES });
};

// Greetings for each scenario - AI picks up the phone
const SCENARIO_GREETINGS = {
  // Decision Makers - more natural, casual greetings
  'cold-cfo': "Yeah, this is David. I've got like 3 minutes, what's up?",
  'cold-ceo': "Michael Torres. I don't know this number... who's this?",
  'cold-it-director': "IT, James speaking. How'd you get this line?",
  'cold-ops-manager': "Hey, Sandra here. Is this a sales thing? I'm kinda swamped.",
  'cold-small-biz': "Yeah hello? Thompson Auto, this is Mike. Hang on... YEAH GIMME A SEC! Okay, what do you need?",
  
  // Gatekeepers
  'gk-executive-asst': "Mr. Harrison's office, this is Patricia. How can I help you?",
  'gk-receptionist': "Hi, thanks for calling Apex Industries! This is Jennifer. Who are you trying to reach?",
  'gk-voicemail': "Hey, you've reached Rob Martinez. Leave me a message and I'll get back to you. BEEP.",
  
  // Objection Scenarios - more conversational
  'obj-budget-freeze': "Oh yeah, I got your email. Look, I gotta be upfront, we froze all spending til Q2. CFO's orders.",
  'obj-bad-experience': "Oh, you're selling that? Yeah... we tried something like that about a year and a half ago. Total disaster honestly.",
  'obj-committee': "Okay so here's the thing. I might see value but, I can't decide this alone. Anything over 5K needs like three approvals.",
  'obj-contract-locked': "I appreciate you reaching out, but, we just renewed with Salesforce. Locked in for like 22 more months.",
  'obj-no-need': "Hmm, I'm not really sure why you're calling us? We've been fine for 15 years without this kind of thing.",
  'obj-send-info': "Yeah sure, just uh, send me something to my email? I'll look at it when I get a chance."
};

// Start a new training session (saves to DB)
const startSession = async (req, res) => {
  const { scenarioId, scenarioName, voiceId } = req.body;
  const userId = req.user?.id;

  try {
    const result = await pool.query(
      `INSERT INTO training_sessions (user_id, scenario_id, scenario_name, voice_id, started_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, started_at`,
      [userId, scenarioId, scenarioName, voiceId || 'alloy']
    );
    
    const session = result.rows[0];
    console.log('📝 Created training session:', session.id);
    
    // Clear any old conversation history for this session ID
    // This ensures the conversation starts fresh
    conversationHistory.delete(session.id);
    
    // Get the greeting for this scenario (AI answers the phone first)
    const greeting = SCENARIO_GREETINGS[scenarioId] || "Hello, how can I help you?";
    console.log('📞 AI greeting (picked up phone):', greeting);
    
    // Initialize a fresh conversation WITH the greeting as first message
    // This way AI knows it already answered the phone
    conversationHistory.set(session.id, {
      messages: [
        { role: 'assistant', content: greeting }
      ],
      topics_discussed: [],
      lastUpdated: Date.now()
    });
    console.log('🔄 Initialized fresh conversation with greeting for session:', session.id);
    
    res.json({ 
      success: true, 
      sessionId: session.id,
      startedAt: session.started_at 
    });
  } catch (error) {
    console.error('❌ Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
};

// End a training session
const endSession = async (req, res) => {
  const { sessionId, score, feedback } = req.body;

  // Check if sessionId is a valid UUID
  const isValidUUID = sessionId && sessionId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  
  if (!isValidUUID) {
    console.log('⚠️ Invalid session ID format, clearing memory only:', sessionId);
    conversationHistory.delete(sessionId);
    return res.json({ success: true, note: 'Memory cleared (no DB session)' });
  }

  try {
    // Get message count
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM training_messages WHERE session_id = $1',
      [sessionId]
    );
    
    // Calculate duration
    await pool.query(
      `UPDATE training_sessions 
       SET ended_at = NOW(), 
           duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER,
           message_count = $2,
           score = $3,
           feedback = $4
       WHERE id = $1`,
      [sessionId, countResult.rows[0].count, score, feedback]
    );
    
    // Clear from memory cache
    conversationHistory.delete(sessionId);
    
    console.log('✅ Ended training session:', sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error ending session:', error);
    // Still clear memory even if DB fails
    conversationHistory.delete(sessionId);
    res.status(500).json({ error: 'Failed to end session' });
  }
};

// Get user's training history
const getHistory = async (req, res) => {
  const userId = req.user?.id;
  const limit = parseInt(req.query.limit) || 20;

  try {
    const result = await pool.query(
      `SELECT id, scenario_id, scenario_name, voice_id, started_at, ended_at, 
              duration_seconds, message_count, score, feedback
       FROM training_sessions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    
    res.json({ success: true, sessions: result.rows });
  } catch (error) {
    console.error('❌ Error getting history:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
};

// Get messages for a specific session
const getSessionMessages = async (req, res) => {
  const { sessionId } = req.params;

  try {
    const result = await pool.query(
      `SELECT role, content, created_at
       FROM training_messages
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [sessionId]
    );
    
    res.json({ success: true, messages: result.rows });
  } catch (error) {
    console.error('❌ Error getting messages:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
};

// Generate real-time AI response using OpenAI with conversation memory
const generateResponse = async (req, res) => {
  const { userMessage, systemPrompt, scenario, sessionId, voiceId } = req.body;

  if (!userMessage || !systemPrompt) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    console.log('🤖 Generating AI response for scenario:', scenario);
    console.log('👤 User message:', userMessage);
    console.log('🔑 Session ID:', sessionId);
    
    // Get or create conversation history for this session
    // Use sessionId if provided, otherwise create a temporary one
    const convId = sessionId || `temp-${scenario}-${Date.now()}`;
    
    if (!conversationHistory.has(convId)) {
      console.log('📝 Creating new conversation for:', convId);
      conversationHistory.set(convId, {
        messages: [],
        topics_discussed: [],  // Track what's been talked about
        lastUpdated: Date.now()
      });
    }
    
    const conversation = conversationHistory.get(convId);
    console.log('📊 Current conversation has', conversation.messages.length, 'messages');
    
    // Add user message to history
    conversation.messages.push({
      role: 'user',
      content: userMessage
    });
    conversation.lastUpdated = Date.now();
    
    // Build a summary of what's been discussed to prevent repetition
    const conversationSummary = conversation.messages.length > 2 
      ? `\n\nCONVERSATION SO FAR (${conversation.messages.length} exchanges):\n` +
        conversation.messages.map((m, i) => `${m.role === 'user' ? 'THEM' : 'YOU'}: ${m.content}`).join('\n')
      : '';
    
    // Build messages array with full conversation history
    const messages = [
      {
        role: 'system',
        content: systemPrompt + 
          `\n\n=== CRITICAL MEMORY RULES ===
1. This is message #${Math.ceil(conversation.messages.length / 2)} in an ONGOING conversation
2. You MUST remember everything said above
3. NEVER repeat a question you already asked
4. NEVER repeat a concern you already raised
5. If they answered something, MOVE ON to a new topic
6. Respond to what they JUST said, don't ignore it
7. Act like a REAL HUMAN with memory

${conversationSummary}`
      },
      ...conversation.messages
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openai.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.8,
        max_tokens: 100,  // Shorter responses feel more natural
        presence_penalty: 0.8,  // Strongly discourage repetition
        frequency_penalty: 0.6  // Strongly encourage variety
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ OpenAI API error:', error);
      throw new Error('OpenAI API request failed');
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content.trim();
    
    // Track usage for cost calculation
    const usage = data.usage || {};
    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;
    
    // GPT-4o-mini pricing: $0.15/1M input, $0.60/1M output
    const costUsd = (inputTokens * 0.00000015) + (outputTokens * 0.0000006);

    // Add AI response to history (memory)
    conversation.messages.push({
      role: 'assistant',
      content: aiResponse
    });
    
    console.log('✅ AI response generated:', aiResponse);
    console.log('📝 Conversation now has', conversation.messages.length, 'messages');
    console.log('💰 Tokens used:', inputTokens, 'in /', outputTokens, 'out = $', costUsd.toFixed(6));

    // Save messages to database if we have a valid session ID (UUID format)
    if (sessionId && sessionId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      try {
        // Save user message
        await pool.query(
          'INSERT INTO training_messages (session_id, role, content, tokens_used, cost_usd) VALUES ($1, $2, $3, $4, $5)',
          [sessionId, 'user', userMessage, 0, 0]
        );
        // Save AI response with usage stats
        await pool.query(
          'INSERT INTO training_messages (session_id, role, content, tokens_used, cost_usd) VALUES ($1, $2, $3, $4, $5)',
          [sessionId, 'assistant', aiResponse, inputTokens + outputTokens, costUsd]
        );
        
        // Track usage in training_usage table
        const userId = req.user?.id || null;
        await pool.query(
          `INSERT INTO training_usage (session_id, user_id, api_type, model, input_tokens, output_tokens, cost_usd)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [sessionId, userId, 'chat', 'gpt-4o-mini', inputTokens, outputTokens, costUsd]
        );
        
        console.log('💾 Saved messages and usage to database');
      } catch (dbError) {
        console.error('⚠️ Failed to save to DB (continuing):', dbError.message);
      }
    }

    res.json({
      success: true,
      response: aiResponse,
      scenario: scenario,
      sessionId: convId,  // Return the conversation ID used
      messageCount: Math.ceil(conversation.messages.length / 2)  // Number of exchanges
    });

  } catch (error) {
    console.error('❌ Error generating AI response:', error);
    res.status(500).json({
      error: 'Failed to generate response',
      message: error.message
    });
  }
};

// OpenAI TTS voices:
// - alloy: neutral, balanced
// - echo: male, warm
// - fable: male, British accent
// - onyx: deep male, authoritative
// - nova: female, friendly
// - shimmer: female, soft

// Map scenario to appropriate voice
const getVoiceForScenario = (scenarioId) => {
  const voiceMap = {
    // Decision Makers
    'cold-cfo': 'onyx',      // Deep, authoritative CFO
    'cold-ceo': 'echo',      // Warm, confident CEO
    'cold-it-director': 'fable',  // Technical, thoughtful
    'cold-ops-manager': 'nova',   // Female ops manager
    'cold-small-biz': 'echo',     // Casual male business owner
    
    // Gatekeepers
    'gk-executive-asst': 'nova',     // Professional female assistant
    'gk-receptionist': 'shimmer',    // Friendly female receptionist
    'gk-voicemail': 'onyx',          // Professional voicemail
    
    // Objection handlers
    'obj-budget-freeze': 'echo',
    'obj-bad-experience': 'onyx',
    'obj-committee': 'fable',
    'obj-contract-locked': 'echo',
    'obj-no-need': 'nova',
    'obj-send-info': 'shimmer'
  };
  
  return voiceMap[scenarioId] || 'alloy';
};

// Generate speech using OpenAI TTS
const generateSpeech = async (req, res) => {
  const { text, voice, scenario, sessionId } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Missing text' });
  }

  try {
    // Use provided voice or get from scenario
    const selectedVoice = voice || getVoiceForScenario(scenario) || 'alloy';
    
    console.log('🔊 Generating TTS with voice:', selectedVoice);
    console.log('📝 Text:', text.substring(0, 50) + '...');

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openai.apiKey}`
      },
      body: JSON.stringify({
        model: 'tts-1',  // Use tts-1-hd for higher quality (more expensive)
        input: text,
        voice: selectedVoice,
        response_format: 'mp3',
        speed: 1.0
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ OpenAI TTS error:', error);
      throw new Error('OpenAI TTS request failed');
    }

    // Get audio as buffer and send
    const audioBuffer = await response.arrayBuffer();
    
    // Track TTS usage for cost calculation
    // TTS pricing: $15 per 1M characters
    const charCount = text.length;
    const costUsd = charCount * 0.000015;
    const audioSeconds = audioBuffer.byteLength / 16000; // Rough estimate: 16KB/s for MP3
    
    console.log('💰 TTS chars:', charCount, '= $', costUsd.toFixed(6));
    
    // Save TTS usage to database if we have a valid session ID
    if (sessionId && sessionId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      try {
        const userId = req.user?.id || null;
        await pool.query(
          `INSERT INTO training_usage (session_id, user_id, api_type, model, audio_seconds, cost_usd)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [sessionId, userId, 'tts', 'tts-1', audioSeconds, costUsd]
        );
      } catch (dbError) {
        console.error('⚠️ Failed to save TTS usage (continuing):', dbError.message);
      }
    }
    
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.byteLength
    });
    
    res.send(Buffer.from(audioBuffer));
    console.log('✅ Audio generated successfully');

  } catch (error) {
    console.error('❌ Error generating speech:', error);
    res.status(500).json({
      error: 'Failed to generate speech',
      message: error.message
    });
  }
};

// Get ephemeral token for OpenAI Realtime API
const getRealtimeToken = async (req, res) => {
  const { scenario } = req.body;

  try {
    console.log('🎫 Generating realtime session token for scenario:', scenario);

    // Build persona instructions based on scenario
    const instructions = {
      'cold-interested': "You are a moderately interested business owner taking a sales call. Ask relevant questions about features, pricing, and ROI. Be professional but slightly busy. Speak naturally and conversationally. Keep responses under 25 words.",
      'cold-skeptical': "You are a skeptical business owner who doubts sales pitches. Question claims, ask for proof, be dismissive but not rude. Speak naturally. Keep responses under 25 words.",
      'cold-busy': "You are an extremely busy executive with no time. Be impatient, interrupt if they ramble, demand they get to the point immediately. Keep responses under 15 words.",
      'gk-helpful': "You are a friendly executive assistant screening calls. Be polite, professional, but need proper information before transferring. Speak naturally. Keep responses under 20 words.",
      'gk-blocking': "You are a protective executive assistant guarding your boss's time. Be suspicious of sales calls, require strong justification. Keep responses under 20 words.",
      'obj-price': "You are a cost-conscious business owner focused on budget. Everything seems expensive. Compare prices, push for discounts. Keep responses under 20 words.",
      'obj-timing': "You are interested but claim bad timing. You're busy with other projects. Keep responses under 20 words.",
      'obj-competitor': "You are loyal to your current vendor and satisfied. Need strong reasons to consider switching. Keep responses under 20 words."
    }[scenario] || "You are a neutral business contact in a phone conversation. Speak naturally and conversationally.";

    res.json({
      success: true,
      token: config.openai.apiKey,
      sessionConfig: {
        instructions: instructions
      }
    });

  } catch (error) {
    console.error('❌ Error generating realtime token:', error);
    res.status(500).json({
      error: 'Failed to generate token',
      message: error.message
    });
  }
};

module.exports = {
  generateResponse,
  getRealtimeToken,
  generateSpeech,
  getVoiceForScenario,
  getVoices,
  startSession,
  endSession,
  getHistory,
  getSessionMessages
};
