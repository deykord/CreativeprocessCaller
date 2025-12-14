#!/usr/bin/env node
/**
 * Test script for OpenAI Realtime API integration
 * Run: node server/test-openai.js
 */

require('dotenv').config();
const openaiService = require('./services/openaiService');

async function testOpenAI() {
  console.log('🧪 Testing OpenAI Integration...\n');

  // Check if configured
  console.log('1. Checking configuration...');
  const isConfigured = openaiService.isConfigured();
  console.log(`   ✓ API Key configured: ${isConfigured ? '✅' : '❌'}`);
  
  if (!isConfigured) {
    console.log('\n❌ OpenAI API key not found or invalid in .env file');
    console.log('   Please set OPENAI_API_KEY=sk-...');
    process.exit(1);
  }

  // Test connection
  console.log('\n2. Testing API connection...');
  try {
    const isConnected = await openaiService.testConnection();
    console.log(`   ✓ API connection: ${isConnected ? '✅' : '❌'}`);
    
    if (!isConnected) {
      console.log('\n❌ Failed to connect to OpenAI API');
      console.log('   Please verify your API key is valid');
      process.exit(1);
    }
  } catch (error) {
    console.error('   ❌ Connection error:', error.message);
    process.exit(1);
  }

  // Test session creation
  console.log('\n3. Creating test training session...');
  try {
    const session = await openaiService.createSession({
      scenarioId: 'cold-interested',
      scenarioName: 'Interested Prospect',
      instructions: 'This is a test session',
    });

    console.log('   ✓ Session created successfully! ✅');
    console.log('\n📋 Session Details:');
    console.log(`   Session ID: ${session.sessionId}`);
    console.log(`   Model: gpt-4o-realtime-preview-2024-12-17`);
    console.log(`   Voice: alloy`);
    console.log(`   Expires: ${session.expiresAt ? new Date(session.expiresAt * 1000).toLocaleString() : 'N/A'}`);
    console.log(`   Client Secret: ${session.clientSecret ? String(session.clientSecret).substring(0, 20) + '...' : 'N/A'}`);
    
    console.log('\n✅ OpenAI integration is fully configured and working!');
    console.log('\n📝 Next steps:');
    console.log('   1. The backend is ready to create training sessions');
    console.log('   2. Use the /api/training/sessions/start endpoint to start a session');
    console.log('   3. Connect from the frontend using the client secret for WebRTC');
    console.log('   4. The AI will respond in real-time using the specified scenario');
    
  } catch (error) {
    console.error('\n❌ Failed to create session:', error.message);
    if (error.message.includes('quota') || error.message.includes('billing')) {
      console.log('\n💡 Tip: Check your OpenAI billing and usage limits at:');
      console.log('   https://platform.openai.com/account/billing');
    }
    process.exit(1);
  }
}

// Run the test
testOpenAI().catch(error => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
