const { v4: uuidv4 } = require('uuid');

// Initial Seed Data (Matches Frontend Constants)
// TODO: Integrate with a real database (e.g., MongoDB, PostgreSQL, MySQL)
let prospects = [];

// TODO: Integrate with a real database (e.g., MongoDB, PostgreSQL, MySQL)
let callLogs = [];

// Call Recordings Storage
let callRecordings = [];

/**
 * Service to handle data persistence. 
 * In a real app, replace these methods with Mongoose/Sequelize calls.
 */
class MockDatabase {
  
  // --- Prospects ---

  async getAllProspects() {
    return prospects;
  }

  async createProspect(data) {
    const newProspect = {
      id: uuidv4(),
      ...data,
      status: data.status || 'New',
    };
    prospects.push(newProspect);
    return newProspect;
  }

  async updateProspect(id, updates) {
    const index = prospects.findIndex(p => p.id === id);
    if (index === -1) return null;
    
    prospects[index] = { ...prospects[index], ...updates };
    return prospects[index];
  }

  // --- Call Logs ---

  async getAllCallLogs() {
    return callLogs;
  }

  async createCallLog(data) {
    const newLog = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...data
    };
    callLogs.push(newLog);
    return newLog;
  }

  // --- Call Recordings ---

  async saveCallRecording(data) {
    const recording = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...data
    };
    callRecordings.push(recording);
    console.log('Recording saved:', recording.id);
    return recording;
  }

  async getCallRecordings(callSid) {
    return callRecordings.filter(r => r.callSid === callSid);
  }

  async getAllCallRecordings() {
    return callRecordings;
  }

  async getStats() {
    return {
      callsMade: callLogs.length,
      connections: callLogs.filter(c => c.outcome === 'Connected' || c.outcome === 'Meeting Set').length,
      appointmentsSet: callLogs.filter(c => c.outcome === 'Meeting Set').length,
      talkTime: callLogs.reduce((acc, curr) => acc + (curr.duration || 0), 0)
    };
  }
}

module.exports = new MockDatabase();