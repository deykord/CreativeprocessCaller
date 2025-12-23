// Twilio is disabled - using Telnyx only
// This file kept for backward compatibility but returns empty array

async function getTwilioNumbers() {
  console.log('Twilio is disabled, using Telnyx');
  return [];
}

module.exports = { getTwilioNumbers };
