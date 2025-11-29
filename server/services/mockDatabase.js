const { v4: uuidv4 } = require('uuid');

// Initial Seed Data (Matches Frontend Constants)
// TODO: Integrate with a real database (e.g., MongoDB, PostgreSQL, MySQL)
let prospects = [];

// TODO: Integrate with a real database (e.g., MongoDB, PostgreSQL, MySQL)
let callLogs = [];

// Call Recordings Storage
let callRecordings = [];

// Users Map (exported for authService and other controllers)
const users = new Map();

// Messages Storage
let messages = [];

// Lead Lists (Campaigns/Groups of prospects)
let leadLists = [];

// Lead List Permissions (who can view/edit which lists)
let leadListPermissions = [];

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

  // --- Lead Lists (Campaigns) ---

  async createLeadList(data) {
    const newList = {
      id: uuidv4(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    leadLists.push(newList);
    return newList;
  }

  async getAllLeadLists() {
    return leadLists;
  }

  async getLeadList(id) {
    return leadLists.find(l => l.id === id);
  }

  async updateLeadList(id, updates) {
    const index = leadLists.findIndex(l => l.id === id);
    if (index === -1) return null;
    
    leadLists[index] = { 
      ...leadLists[index], 
      ...updates,
      updatedAt: new Date().toISOString()
    };
    return leadLists[index];
  }

  async deleteLeadList(id) {
    const index = leadLists.findIndex(l => l.id === id);
    if (index === -1) return null;
    
    const deleted = leadLists[index];
    leadLists.splice(index, 1);
    
    // Delete associated permissions
    leadListPermissions = leadListPermissions.filter(p => p.listId !== id);
    
    return deleted;
  }

  // --- Lead List Permissions ---

  async addLeadListPermission(data) {
    const permission = {
      id: uuidv4(),
      ...data,
      createdAt: new Date().toISOString(),
    };
    leadListPermissions.push(permission);
    return permission;
  }

  async getLeadListPermissions(listId) {
    return leadListPermissions.filter(p => p.listId === listId);
  }

  async getUserLeadListPermissions(userId) {
    return leadListPermissions.filter(p => p.userId === userId);
  }

  async updateLeadListPermission(id, updates) {
    const index = leadListPermissions.findIndex(p => p.id === id);
    if (index === -1) return null;
    
    leadListPermissions[index] = { ...leadListPermissions[index], ...updates };
    return leadListPermissions[index];
  }

  async deleteLeadListPermission(id) {
    const index = leadListPermissions.findIndex(p => p.id === id);
    if (index === -1) return null;
    
    const deleted = leadListPermissions[index];
    leadListPermissions.splice(index, 1);
    
    return deleted;
  }

  async canUserAccessList(userId, listId) {
    // List owner always has access
    const list = await this.getLeadList(listId);
    if (list && list.createdBy === userId) return true;
    
    // Check explicit permissions
    const permission = leadListPermissions.find(p => p.listId === listId && p.userId === userId);
    return permission && (permission.canView || permission.canEdit);
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
module.exports.users = users;
module.exports.messages = messages;
module.exports.leadLists = leadLists;
module.exports.leadListPermissions = leadListPermissions;