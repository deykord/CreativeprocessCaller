const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Check if we should use the database or mock data
const USE_DATABASE = process.env.USE_DATABASE === 'true';

// Import database service if enabled
let databaseService = null;
if (USE_DATABASE) {
  try {
    databaseService = require('./databaseService');
    console.log('✅ Database service loaded - using PostgreSQL');
  } catch (error) {
    console.error('❌ Failed to load database service:', error.message);
    console.log('⚠️  Falling back to mock data');
  }
}

// Initial Seed Data (Used only when USE_DATABASE=false)
let prospects = [
  {
    id: uuidv4(),
    firstName: 'John',
    lastName: 'Smith',
    company: 'Acme Corp',
    title: 'CEO',
    phone: '5551234567',
    email: 'john.smith@acme.com',
    status: 'New',
    timezone: 'America/New_York',
    notes: 'Interested in enterprise plan',
    statusHistory: [],
    lastUpdatedBy: null,
    lastUpdatedAt: null
  },
  {
    id: uuidv4(),
    firstName: 'Sarah',
    lastName: 'Johnson',
    company: 'Tech Innovations',
    title: 'CTO',
    phone: '5559876543',
    email: 'sarah.j@techinnovations.com',
    status: 'New',
    timezone: 'America/Los_Angeles',
    notes: 'Follow up next week',
    statusHistory: [],
    lastUpdatedBy: null,
    lastUpdatedAt: null
  },
  {
    id: uuidv4(),
    firstName: 'Michael',
    lastName: 'Davis',
    company: 'Global Solutions',
    title: 'VP Sales',
    phone: '5555551234',
    email: 'mdavis@globalsolutions.com',
    status: 'New',
    timezone: 'America/Chicago',
    notes: 'Warm lead from conference',
    statusHistory: [],
    lastUpdatedBy: null,
    lastUpdatedAt: null
  }
];

// Activity logs for sales floor monitoring
let activityLogs = [];

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
    if (USE_DATABASE && databaseService) {
      return await databaseService.getProspects();
    }
    return prospects;
  }

  async createProspect(data, createdBy = null) {
    if (USE_DATABASE && databaseService) {
      return await databaseService.createProspect(data, createdBy);
    }
    const newProspect = {
      id: uuidv4(),
      ...data,
      status: data.status || 'New',
    };
    prospects.push(newProspect);
    return newProspect;
  }

  async updateProspect(id, updates, userId = null) {
    if (USE_DATABASE && databaseService) {
      return await databaseService.updateProspect(id, updates, userId);
    }
    
    const index = prospects.findIndex(p => p.id === id);
    if (index === -1) return null;
    
    const prospect = prospects[index];
    const timestamp = new Date().toISOString();
    
    // Track status changes
    if (updates.status && updates.status !== prospect.status) {
      const statusChange = {
        id: uuidv4(),
        prospectId: id,
        oldStatus: prospect.status,
        newStatus: updates.status,
        userId: userId,
        timestamp: timestamp,
      };
      
      if (!prospect.statusHistory) {
        prospect.statusHistory = [];
      }
      prospect.statusHistory.push(statusChange);
      
      // Log activity for sales floor
      activityLogs.push({
        id: uuidv4(),
        userId: userId,
        action: 'status_change',
        prospectId: id,
        prospectName: `${prospect.firstName} ${prospect.lastName}`,
        details: `Changed status from ${prospect.status} to ${updates.status}`,
        timestamp: timestamp
      });
    }
    
    prospects[index] = { 
      ...prospect, 
      ...updates,
      lastUpdatedBy: userId,
      lastUpdatedAt: timestamp
    };
    return prospects[index];
  }

  async deleteProspect(id) {
    if (USE_DATABASE && databaseService) {
      return await databaseService.deleteProspect(id);
    }
    const index = prospects.findIndex(p => p.id === id);
    if (index === -1) return null;
    const deleted = prospects[index];
    prospects.splice(index, 1);
    return deleted;
  }

  async bulkUploadProspects(prospectsArray, createdBy = null) {
    if (USE_DATABASE && databaseService) {
      // For database, create them one by one (can be optimized later)
      const created = [];
      for (const prospect of prospectsArray) {
        try {
          const result = await databaseService.createProspect(prospect, createdBy);
          created.push(result);
        } catch (error) {
          console.error('Error creating prospect:', error);
        }
      }
      return created;
    }
    
    const newProspects = prospectsArray.map(data => ({
      id: uuidv4(),
      ...data,
      status: data.status || 'New',
    }));
    prospects.push(...newProspects);
    return newProspects;
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
    if (USE_DATABASE && databaseService) {
      return await databaseService.getAllCallLogs();
    }
    return callLogs;
  }

  async createCallLog(data) {
    if (USE_DATABASE && databaseService) {
      return await databaseService.createCallLog(data);
    }
    const newLog = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...data
    };
    callLogs.push(newLog);
    
    // Log activity for sales floor
    if (data.userId) {
      activityLogs.push({
        id: uuidv4(),
        userId: data.userId,
        action: 'call_made',
        prospectId: data.prospectId,
        prospectName: data.prospectName || 'Unknown',
        details: `Called ${data.prospectName || data.phone}`,
        timestamp: newLog.timestamp,
        duration: data.duration || 0,
        disposition: data.disposition || 'Unknown'
      });
    }
    
    return newLog;
  }

  // --- Activity Logs (Sales Floor) ---

  async getActivityLogs(filters = {}) {
    let filtered = [...activityLogs];
    
    if (filters.userId) {
      filtered = filtered.filter(log => log.userId === filters.userId);
    }
    
    if (filters.startDate) {
      filtered = filtered.filter(log => new Date(log.timestamp) >= new Date(filters.startDate));
    }
    
    if (filters.endDate) {
      filtered = filtered.filter(log => new Date(log.timestamp) <= new Date(filters.endDate));
    }
    
    // Sort by timestamp descending
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return filtered;
  }

  async getSalesFloorStats(userId = null) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Filter logs for today
    let todayLogs = activityLogs.filter(log => new Date(log.timestamp) >= todayStart);
    
    if (userId) {
      todayLogs = todayLogs.filter(log => log.userId === userId);
    }
    
    // Calculate stats by user
    const userStats = {};
    
    todayLogs.forEach(log => {
      if (!userStats[log.userId]) {
        userStats[log.userId] = {
          userId: log.userId,
          callsMade: 0,
          statusChanges: 0,
          lastActivity: null,
          dispositions: {}
        };
      }
      
      const stats = userStats[log.userId];
      
      if (log.action === 'call_made') {
        stats.callsMade++;
        if (log.disposition) {
          stats.dispositions[log.disposition] = (stats.dispositions[log.disposition] || 0) + 1;
        }
      } else if (log.action === 'status_change') {
        stats.statusChanges++;
      }
      
      if (!stats.lastActivity || new Date(log.timestamp) > new Date(stats.lastActivity)) {
        stats.lastActivity = log.timestamp;
      }
    });
    
    return Object.values(userStats);
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

  async deleteCallRecording(id) {
    const idx = callRecordings.findIndex(r => r.id === id);
    if (idx === -1) return null;
    const deleted = callRecordings[idx];
    callRecordings.splice(idx, 1);
    return deleted;
  }

  async deleteCallRecordings(ids = []) {
    const deleted = [];
    callRecordings = callRecordings.filter(r => {
      if (ids.includes(r.id)) {
        deleted.push(r);
        return false;
      }
      return true;
    });
    return deleted;
  }

  async deleteAllCallRecordings() {
    const all = callRecordings.slice();
    callRecordings = [];
    return all;
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