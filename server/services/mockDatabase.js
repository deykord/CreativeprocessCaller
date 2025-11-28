const { v4: uuidv4 } = require('uuid');

// Initial Seed Data (Matches Frontend Constants)
let prospects = [
  {
    id: '1',
    firstName: 'Sarah',
    lastName: 'Connor',
    title: 'CTO',
    company: 'Skynet Cyberdyne',
    phone: '+1 (555) 123-4567',
    email: 'sarah@skynet.com',
    status: 'New',
    timezone: 'PST',
  },
  {
    id: '2',
    firstName: 'James',
    lastName: 'Holden',
    title: 'Captain',
    company: 'Rocinante Transport',
    phone: '+1 (555) 987-6543',
    email: 'j.holden@rocinante.com',
    status: 'New',
    timezone: 'EST',
  },
  {
    id: '3',
    firstName: 'Walter',
    lastName: 'White',
    title: 'Lead Chemist',
    company: 'Gray Matter Tech',
    phone: '+1 (505) 555-0192',
    email: 'heisenberg@graymatter.com',
    status: 'Qualified',
    timezone: 'MST',
  },
  {
    id: '4',
    firstName: 'Diana',
    lastName: 'Prince',
    title: 'Curator',
    company: 'Louvre Museum',
    phone: '+1 (202) 555-0144',
    email: 'diana@themyscira.gov',
    status: 'Lost',
    timezone: 'EST',
  },
  {
    id: '5',
    firstName: 'Tony',
    lastName: 'Stark',
    title: 'CEO',
    company: 'Stark Industries',
    phone: '+1 (212) 555-0199',
    email: 'tony@stark.com',
    status: 'New',
    timezone: 'EST',
  },
];

let callLogs = [];

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