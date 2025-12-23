// Twilio is disabled - using Telnyx only
// This file kept for backward compatibility but does nothing

module.exports = {
  client: null,
  getIncomingNumbers: async () => {
    console.log('Twilio is disabled, using Telnyx');
    return [];
  }
};