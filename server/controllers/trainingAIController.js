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

// Available ElevenLabs TTS voices
const AVAILABLE_VOICES = [
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', description: 'Deep, authoritative male', gender: 'male' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', description: 'Soft, warm female', gender: 'female' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'Well-rounded male', gender: 'male' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', description: 'Young, energetic female', gender: 'female' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', description: 'Professional male', gender: 'male' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', description: 'Crisp, confident male', gender: 'male' },
  { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy', description: 'Pleasant female', gender: 'female' },
  { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill', description: 'Trustworthy male', gender: 'male' }
];

// Get available voices
const getVoices = async (req, res) => {
  res.json({ success: true, voices: AVAILABLE_VOICES });
};

// Greetings for each scenario - AI picks up the phone (HARDER VERSION)
const SCENARIO_GREETINGS = {
  // Decision Makers - AGGRESSIVE, DISMISSIVE, SHORT ON TIME
  'cold-cfo': "Yeah? David here. I'm literally walking into a board meeting right now. You've got 30 seconds, make it count.",
  'cold-ceo': "Who is this? How did you get my direct line? I don't take cold calls. You've got 15 seconds before I hang up.",
  'cold-it-director': "IT Security. Who gave you this number? We have a strict no-solicitation policy. Start talking or I'm disconnecting.",
  'cold-ops-manager': "Yeah, Sandra. Let me stop you right there - if this is another software pitch, we're not interested. We get 10 of these a day.",
  'cold-small-biz': "Thompson Auto, what?! No, no, NO - I told you people to stop calling here! We're slammed. Unless you're a customer, I don't have time for this!",
  
  // Gatekeepers - PROTECTIVE, SUSPICIOUS, TRAINED TO BLOCK
  'gk-executive-asst': "Mr. Harrison's office. He doesn't accept unsolicited calls. What company are you with and what's this regarding? Be specific.",
  'gk-receptionist': "Apex Industries. Hold on - before you continue, are you selling something? Because all vendor inquiries go through our procurement portal online.",
  'gk-voicemail': "You've reached Rob Martinez. I don't return calls from numbers I don't recognize. If this is sales, don't waste your time. BEEP.",
  
  // Objection Scenarios - HOSTILE, BURNED BEFORE, ZERO TRUST
  'obj-budget-freeze': "Yeah I got your email and honestly? Total waste of time. We just had layoffs last month. Budget's frozen solid til at least Q3, maybe Q4. So... yeah.",
  'obj-bad-experience': "Oh great, another one of YOU guys. Look, we got burned BADLY on something like this 8 months ago. Cost us 40K and didn't work. I'm not making that mistake again.",
  'obj-committee': "Okay, real talk? Even if I loved this, I don't make decisions anymore. Anything over 2K needs approval from THREE different VPs who all hate each other. It's a nightmare.",
  'obj-contract-locked': "We JUST signed with Salesforce. Like literally last month. 3-year contract, early termination penalty is insane. So this conversation is pointless.",
  'obj-no-need': "I'm confused why you're calling. We've been doing this manually for 18 years. It works. Why would we change? This sounds like a solution looking for a problem.",
  'obj-send-info': "Look, I'm going to be honest with you - I get 50 emails a day like this. Just send it over. I'll probably delete it, but send it anyway if it makes you feel better."
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
    
    // Build messages array with full conversation history - EXTREME DIFFICULTY MODE
    const messages = [
      {
        role: 'system',
        content: systemPrompt + 
          `\n\n=== CRITICAL RULES - MAXIMUM DIFFICULTY ===
1. This is message #${Math.ceil(conversation.messages.length / 2)} - ONGOING conversation, you REMEMBER everything
2. You are EXTREMELY skeptical, busy, and have been burned before
3. Challenge EVERY claim they make - demand proof, specifics, case studies
4. Interrupt if they ramble or use vague language - call it out immediately
5. You've heard "hundreds" of pitches - nothing impresses you easily
6. TRUST NOTHING - you've been lied to before by salespeople
7. If they can't answer a tough question, get MORE suspicious and dismissive
8. Push back HARD on price - everything is "too expensive" until they prove ROI
9. Bring up competitors and claim they're better/cheaper
10. Your default is NO - they must EARN a yes through exceptional skill
11. Cut them off if they sound scripted or use buzzwords - hate corporate speak
12. Ask confrontational questions: "Why should I believe you?" "What's the catch?"
13. If they dodge a question, call them out: "You didn't answer my question"
14. Be impatient - you have 5 minutes MAX and you're watching the clock
15. NEVER make it easy - even if interested, stay difficult and skeptical

=== YOUR PERSONALITY ===
- Short temper, zero tolerance for BS
- Burned by bad vendors before
- Protective of budget and time
- Expect to be disappointed
- Will hang up if they waste your time
- Respect ONLY data, proof, and directness

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
        temperature: 0.9,  // Higher for more aggressive, unpredictable responses
        max_tokens: 80,  // Even shorter - busy, impatient people don't ramble
        presence_penalty: 1.0,  // Maximum - never repeat yourself
        frequency_penalty: 0.8  // High variety, unpredictable reactions
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
    // Use provided voice or get from scenario (default to Adam)
    const selectedVoice = voice || getVoiceForScenario(scenario) || 'pNInz6obpgDQGcFmaJgB';
    
    console.log('🔊 Generating ElevenLabs TTS with voice:', selectedVoice);
    console.log('📝 Text:', text.substring(0, 50) + '...');

    if (!config.elevenlabs?.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': config.elevenlabs.apiKey
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_turbo_v2_5',  // Fast, low-latency model
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ ElevenLabs TTS error:', error);
      throw new Error('ElevenLabs TTS request failed');
    }

    // Get audio as buffer and send
    const audioBuffer = await response.arrayBuffer();
    
    // Track TTS usage for cost calculation
    // ElevenLabs pricing: ~$0.30 per 1K characters (turbo model)
    const charCount = text.length;
    const costUsd = (charCount / 1000) * 0.30;
    const audioSeconds = audioBuffer.byteLength / 16000; // Rough estimate: 16KB/s for MP3
    
    console.log('💰 ElevenLabs TTS chars:', charCount, '= $', costUsd.toFixed(6));
    
    // Save TTS usage to database if we have a valid session ID
    if (sessionId && sessionId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      try {
        const userId = req.user?.id || null;
        await pool.query(
          `INSERT INTO training_usage (session_id, user_id, api_type, model, audio_seconds, cost_usd)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [sessionId, userId, 'tts', 'eleven_turbo_v2_5', audioSeconds, costUsd]
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
    console.log('✅ ElevenLabs audio generated successfully');

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
