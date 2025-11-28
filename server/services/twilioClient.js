const twilio = require('twilio');
const config = require('../config/config');

const client = twilio(config.twilio.accountSid, config.twilio.authToken);

module.exports = {
  client,
  // Helper to fetch incoming numbers
  getIncomingNumbers: async () => {
    try {
      const numbers = await client.incomingPhoneNumbers.list({ limit: 20 });
      return numbers.map(n => ({
        sid: n.sid,
        phoneNumber: n.phoneNumber,
        friendlyName: n.friendlyName,
        capabilities: n.capabilities
      }));
    } catch (error) {
      console.error('Error fetching Twilio numbers:', error);
      throw error;
    }
  }
};