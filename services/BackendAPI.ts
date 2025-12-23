
import { Prospect, CallLog, TwilioPhoneNumber, AuthResponse, User, Message, LeadList, LeadListPermission, StatusChange, ProspectCallLog, LeadActivityLog, TwilioCallStatus, CallEndReason } from '../types';

// Determine API URL based on environment
const getAPIBaseURL = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    
    // Check if running on dev path (/dev/)
    if (pathname.startsWith('/dev/') || pathname.startsWith('/dev')) {
      return `${window.location.protocol}//${window.location.host}/dev/api`;
    }
    
    // In production (non-localhost), use same origin
    if (!hostname.includes('localhost')) {
      return `${window.location.protocol}//${window.location.host}/api`;
    }
  }
  // In development, use localhost:3001
  return 'http://localhost:3001/api';
};

const API_BASE_URL = getAPIBaseURL();

/**
 * Connects to the Node.js / Express Backend
 */
export const backendAPI = {
  
  // --- Authentication ---
  
  async createUser(email: string, firstName: string, lastName: string, role?: string): Promise<AuthResponse> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/auth/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
      },
      body: JSON.stringify({ email, firstName, lastName, role })
    });
    return res.json();
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    let data: any;
    try {
      if (res.ok) {
        data = await res.json();
      } else {
        // Try to parse as JSON, fallback to text
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { success: false, error: text.startsWith('<') ? 'Server error: received HTML response' : text };
        }
      }
    } catch (err) {
      data = { success: false, error: 'Network or server error' };
    }
    return data;
  },

  async logout(): Promise<void> {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  },

  async getCurrentUser(): Promise<User | null> {
    const token = localStorage.getItem('authToken');
    if (!token) return null;
    
    try {
      const res = await fetch(`${API_BASE_URL}/auth/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        // Only log non-401 errors (401 is expected when token expires)
        if (res.status !== 401) {
          console.error(`Profile fetch failed with status ${res.status}`);
        }
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        return null;
      }
      
      const data = await res.json();
      return data.user;
    } catch (error) {
      // Suppress network errors during profile check
      console.debug('Profile check failed:', error);
      return null;
    }
  },

  getAuthToken(): string | null {
    return localStorage.getItem('authToken');
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('authToken');
  },

  // --- Twilio Token ---
  
  async getToken(identity?: string): Promise<string> {
    const res = await fetch(`${API_BASE_URL}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity })
    });
    const data = await res.json();
    return data.token;
  },

  // --- Prospects ---

  async getProspects(): Promise<Prospect[]> {
    const res = await fetch(`${API_BASE_URL}/prospects`);
    return res.json();
  },

  async createProspect(prospect: Partial<Prospect>): Promise<Prospect> {
    const res = await fetch(`${API_BASE_URL}/prospects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prospect)
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const error = new Error(errorData.error || `Failed to create prospect (${res.status})`);
      (error as any).status = res.status;
      throw error;
    }
    
    return res.json();
  },

  async updateProspect(id: string, updates: Partial<Prospect>): Promise<Prospect> {
    const res = await fetch(`${API_BASE_URL}/prospects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return res.json();
  },

  async deleteProspect(id: string): Promise<void> {
    await fetch(`${API_BASE_URL}/prospects/${id}`, {
      method: 'DELETE'
    });
  },

  async getProspectStatusHistory(prospectId: string): Promise<StatusChange[]> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/prospects/${prospectId}/status-history`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    return res.json();
  },

  async getProspectCallHistory(prospectId: string): Promise<ProspectCallLog[]> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/prospects/${prospectId}/call-history`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    return res.json();
  },

  async getProspectActivityLog(prospectId: string, limit: number = 100): Promise<LeadActivityLog[]> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/prospects/${prospectId}/activity-log?limit=${limit}`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    return res.json();
  },

  async getProspectPhoneHistory(prospectId: string): Promise<Array<{
    id: string;
    phoneNumber: string;
    isCurrent: boolean;
    changedAt: string;
    changedTo?: string;
    changedBy?: string;
    changedByName?: string;
  }>> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/prospects/${prospectId}/phone-history`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    return res.json();
  },

  // --- Calls ---

  async getCallHistory(): Promise<CallLog[]> {
    const res = await fetch(`${API_BASE_URL}/calls`);
    return res.json();
  },

  async logCall(log: Partial<CallLog>): Promise<CallLog> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/calls`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`
      },
      body: JSON.stringify(log)
    });
    return res.json();
  },

  // --- Recordings ---

  async getRecordings(): Promise<any[]> {
    const res = await fetch(`${API_BASE_URL}/calls/recordings`);
    return res.json();
  },

  async deleteRecording(id: string): Promise<void> {
    await fetch(`${API_BASE_URL}/calls/recordings/${id}`, { method: 'DELETE' });
  },

  async deleteRecordings(ids: string[]): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/calls/recordings/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    return res.json();
  },

  async deleteAllRecordings(): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/calls/recordings`, { method: 'DELETE' });
    return res.json();
  },

  async getRecordingDownloadUrl(id: string): Promise<string> {
    // This endpoint redirects to the actual recording URL; return the redirect path so the caller can open it
    return `${API_BASE_URL}/calls/recording/${id}/download`;
  },

  // --- Call Log Deletion ---

  async deleteCallLog(id: string): Promise<any> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/calls/logs/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    return res.json();
  },

  async deleteCallLogs(ids: string[]): Promise<any> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/calls/logs/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`
      },
      body: JSON.stringify({ ids })
    });
    return res.json();
  },

  async deleteAllCallLogs(): Promise<any> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/calls/logs`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    return res.json();
  },

  // --- Settings ---
  
  async getVoiceConfig(): Promise<{
    provider: 'twilio' | 'telnyx';
    twilio?: {};
    telnyx?: {
      sipUsername: string;
      sipPassword: string;
      callerId: string;
    };
  }> {
    const res = await fetch(`${API_BASE_URL}/voice/config`);
    return res.json();
  },

  async getIncomingNumbers(): Promise<TwilioPhoneNumber[]> {
    const res = await fetch(`${API_BASE_URL}/voice/incoming-numbers`);
    return res.json();
  },

  async getTwilioNumbers(): Promise<TwilioPhoneNumber[]> {
    const res = await fetch(`${API_BASE_URL}/voice/numbers`);
    return res.json();
  },

  async getTelnyxNumbers(): Promise<TwilioPhoneNumber[]> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/telnyx/numbers`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    if (!res.ok) {
      console.error('Failed to fetch Telnyx numbers:', res.status);
      return [];
    }
    return res.json();
  },

  // --- Real-time Call Status ---

  async getCallStatus(callSid: string): Promise<TwilioCallStatus> {
    const res = await fetch(`${API_BASE_URL}/voice/calls/${callSid}/status`);
    if (!res.ok) {
      throw new Error(`Failed to fetch call status: ${res.status}`);
    }
    return res.json();
  },

  async getCachedCallStatus(callSid: string): Promise<TwilioCallStatus | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/voice/calls/${callSid}/cached-status`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Failed to fetch cached status: ${res.status}`);
      return res.json();
    } catch {
      return null;
    }
  },

  async getActiveCalls(): Promise<TwilioCallStatus[]> {
    const res = await fetch(`${API_BASE_URL}/voice/calls/active`);
    return res.json();
  },

  async endCall(callSid: string): Promise<{ callSid: string; status: string; endReason: string; duration: number }> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/telnyx/calls/${callSid}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
      }
    });
    if (!res.ok) {
      throw new Error(`Failed to end call: ${res.status}`);
    }
    return res.json();
  },

  async getPendingInboundCalls(): Promise<{ success: boolean; calls: Array<{ callControlId: string; from: string; to: string; startTime: string }> }> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/telnyx/calls/inbound/pending`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    if (!res.ok) {
      throw new Error(`Failed to get pending inbound calls: ${res.status}`);
    }
    return res.json();
  },

  async answerInboundCall(callControlId: string): Promise<{ success: boolean }> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/telnyx/calls/${callControlId}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
      }
    });
    if (!res.ok) {
      throw new Error(`Failed to answer inbound call: ${res.status}`);
    }
    return res.json();
  },

  // --- Profile & User Management ---

  async updateProfile(user: User): Promise<User> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
      },
      body: JSON.stringify(user)
    });
    const data = await res.json();
    return data.user;
  },

  async getTeamMembers(): Promise<User[]> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/auth/team-members`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    return res.json();
  },

  async deleteUser(userId: string): Promise<void> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/auth/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to delete user');
    }
  },

  // --- Messaging ---

  async sendMessage(senderId: string, recipientId: string, content: string): Promise<Message> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
      },
      body: JSON.stringify({ senderId, recipientId, content })
    });
    return res.json();
  },

  async getMessages(userId: string): Promise<Message[]> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/messages?userId=${userId}`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    return res.json();
  },

  async sendBugReport(data: {
    senderId: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    attachments?: string[];
  }): Promise<any> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/messages/bug-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
      },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async updateBugStatus(messageId: string, status: 'open' | 'in_progress' | 'resolved'): Promise<any> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/messages/${messageId}/bug-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
      },
      body: JSON.stringify({ status })
    });
    return res.json();
  },

  // --- Lead Lists & Permissions ---

  async createLeadList(name: string, description: string, prospects: string[]): Promise<LeadList> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/lead-lists`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
      },
      body: JSON.stringify({ name, description, prospects })
    });
    return res.json();
  },

  async getLeadLists(): Promise<LeadList[]> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/lead-lists`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    return res.json();
  },

  async getLeadList(id: string): Promise<LeadList> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/lead-lists/${id}`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    return res.json();
  },

  async updateLeadList(id: string, updates: Partial<LeadList>): Promise<LeadList> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/lead-lists/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
      },
      body: JSON.stringify(updates)
    });
    return res.json();
  },

  async deleteLeadList(id: string): Promise<void> {
    const token = localStorage.getItem('authToken');
    await fetch(`${API_BASE_URL}/lead-lists/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
  },

  async addLeadListPermission(listId: string, targetUserId: string, canView: boolean, canEdit: boolean): Promise<LeadListPermission> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/lead-lists/${listId}/permissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
      },
      body: JSON.stringify({ targetUserId, canView, canEdit })
    });
    return res.json();
  },

  async getLeadListPermissions(listId: string): Promise<LeadListPermission[]> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/lead-lists/${listId}/permissions`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    return res.json();
  },

  async removeLeadListPermission(listId: string, permissionId: string): Promise<void> {
    const token = localStorage.getItem('authToken');
    await fetch(`${API_BASE_URL}/lead-lists/${listId}/permissions/${permissionId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
  },

  async removeProspectsFromList(listId: string, prospectIds: string[]): Promise<{ success: boolean; removedCount: number }> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/lead-lists/${listId}/prospects`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
      },
      body: JSON.stringify({ prospectIds })
    });
    return res.json();
  },

  // --- Sales Floor ---

  async getSalesFloorActivity(): Promise<{
    teamStats: Array<{
      userId: string;
      callsMade: number;
      statusChanges: number;
      lastActivity: string | null;
      dispositions: Record<string, number>;
    }>;
    recentActivity: Array<{
      id: string;
      userId: string;
      action: string;
      prospectId?: string;
      prospectName?: string;
      details: string;
      timestamp: string;
      duration?: number;
      disposition?: string;
    }>;
  }> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/sales-floor/team`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    return res.json();
  },

  async getSalesFloorStats(userId?: string): Promise<{
    userId: string;
    callsMade: number;
    statusChanges: number;
    lastActivity: string | null;
    dispositions: Record<string, number>;
  }[]> {
    const token = localStorage.getItem('authToken');
    const url = userId 
      ? `${API_BASE_URL}/sales-floor/stats?userId=${userId}`
      : `${API_BASE_URL}/sales-floor/stats`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    const data = await res.json();
    return data.stats;
  },

  async getActivityLogs(filters?: { userId?: string; startDate?: string; endDate?: string; limit?: number }): Promise<Array<{
    id: string;
    userId: string;
    action: string;
    prospectId?: string;
    prospectName?: string;
    details: string;
    timestamp: string;
    duration?: number;
    disposition?: string;
  }>> {
    const token = localStorage.getItem('authToken');
    const params = new URLSearchParams();
    if (filters?.userId) params.append('userId', filters.userId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    
    const url = `${API_BASE_URL}/sales-floor/activity${params.toString() ? '?' + params.toString() : ''}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    const data = await res.json();
    return data.logs;
  },

  // --- Voicemails ---

  async getVoicemails(): Promise<Array<{
    id: string;
    userId: string;
    name: string;
    description: string;
    audioData: string;
    duration: number;
    isDefault: boolean;
    usageCount: number;
    createdAt: string;
    updatedAt: string;
  }>> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/voicemails`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch voicemails: ${res.status}`);
    }
    const data = await res.json();
    return data.voicemails || [];
  },

  async createVoicemail(voicemail: {
    name: string;
    description?: string;
    audioData: string;
    duration?: number;
  }): Promise<{
    id: string;
    userId: string;
    name: string;
    description: string;
    audioData: string;
    duration: number;
    isDefault: boolean;
    usageCount: number;
    createdAt: string;
    updatedAt: string;
  }> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/voicemails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
      },
      body: JSON.stringify(voicemail)
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || `Failed to create voicemail: ${res.status}`);
    }
    const data = await res.json();
    return data.voicemail;
  },

  async updateVoicemail(id: string, updates: {
    name?: string;
    description?: string;
    audioData?: string;
    duration?: number;
  }): Promise<{
    id: string;
    userId: string;
    name: string;
    description: string;
    audioData: string;
    duration: number;
    isDefault: boolean;
    usageCount: number;
    createdAt: string;
    updatedAt: string;
  }> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/voicemails/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
      },
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || `Failed to update voicemail: ${res.status}`);
    }
    const data = await res.json();
    return data.voicemail;
  },

  async deleteVoicemail(id: string): Promise<void> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/voicemails/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || `Failed to delete voicemail: ${res.status}`);
    }
  },

  async setDefaultVoicemail(id: string): Promise<void> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/voicemails/${id}/default`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || `Failed to set default voicemail: ${res.status}`);
    }
  },

  async getVoicemailStats(): Promise<{
    totalVoicemails: number;
    totalDrops: number;
    recentDrops: Array<{
      voicemailName: string;
      prospectName: string;
      droppedAt: string;
    }>;
  }> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/voicemails/stats`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch voicemail stats: ${res.status}`);
    }
    return res.json();
  },

  async logVoicemailDrop(voicemailId: string, prospectId: string, callSid?: string): Promise<void> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/voicemails/drop-log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
      },
      body: JSON.stringify({ voicemailId, prospectId, callSid })
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || `Failed to log voicemail drop: ${res.status}`);
    }
  },

  // --- Dashboard Stats ---

  async getDashboardStats(period: 'today' | 'week' | 'month' | 'all' = 'today', userId?: string): Promise<{
    callsMade: number;
    connections: number;
    appointmentsSet: number;
    talkTime: number;
    prospects: {
      total: number;
      new: number;
      contacted: number;
      qualified: number;
      lost: number;
    };
    recentCalls: Array<{
      id: string;
      prospectId: string;
      prospectName: string;
      company: string;
      outcome: string;
      duration: number;
      timestamp: string;
      notes: string;
    }>;
  }> {
    const token = localStorage.getItem('authToken');
    const params = new URLSearchParams({ period });
    if (userId) params.append('userId', userId);
    
    const res = await fetch(`${API_BASE_URL}/dashboard/stats?${params}`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch dashboard stats: ${res.status}`);
    }
    const data = await res.json();
    return data.stats;
  },

  async getTeamDashboardStats(period: 'today' | 'week' | 'month' | 'all' = 'today'): Promise<{
    callsMade: number;
    connections: number;
    appointmentsSet: number;
    talkTime: number;
    prospects: {
      total: number;
      new: number;
      contacted: number;
      qualified: number;
      lost: number;
    };
    recentCalls: Array<{
      id: string;
      prospectId: string;
      prospectName: string;
      company: string;
      outcome: string;
      duration: number;
      timestamp: string;
      notes: string;
    }>;
  }> {
    const token = localStorage.getItem('authToken');
    const params = new URLSearchParams({ period });
    
    const res = await fetch(`${API_BASE_URL}/dashboard/stats/team?${params}`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch team dashboard stats: ${res.status}`);
    }
    const data = await res.json();
    return data.stats;
  },

  // --- Telnyx Integration ---

  async isTelnyxConfigured(): Promise<boolean> {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/telnyx/configured`, {
        headers: { 'Authorization': `Bearer ${token || ''}` }
      });
      if (!res.ok) return false;
      const data = await res.json();
      return data.configured;
    } catch {
      return false;
    }
  },

  async getTelnyxPhoneNumbers(): Promise<TwilioPhoneNumber[]> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/telnyx/numbers`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch Telnyx numbers: ${res.status}`);
    }
    return res.json();
  },

  async getTelnyxCallStatus(callControlId: string): Promise<TwilioCallStatus> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/telnyx/calls/${callControlId}/status`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch Telnyx call status: ${res.status}`);
    }
    return res.json();
  },

  async getTelnyxActiveCalls(): Promise<TwilioCallStatus[]> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/telnyx/calls/active`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch active Telnyx calls: ${res.status}`);
    }
    return res.json();
  },

  async endTelnyxCall(callControlId: string): Promise<{ success: boolean; callControlId: string }> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/telnyx/calls/${callControlId}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
      }
    });
    if (!res.ok) {
      throw new Error(`Failed to end Telnyx call: ${res.status}`);
    }
    return res.json();
  },

  async getTelnyxRecordings(): Promise<Array<{
    id: string;
    callControlId: string;
    status: string;
    duration: number;
    createdAt: string;
    downloadUrl: string;
  }>> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/telnyx/recordings`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch Telnyx recordings: ${res.status}`);
    }
    return res.json();
  },

  // Helper to get current voice provider
  async getVoiceProvider(): Promise<'twilio' | 'telnyx'> {
    // Check if Telnyx is configured, otherwise default to Twilio
    const telnyxConfigured = await this.isTelnyxConfigured();
    return telnyxConfigured ? 'telnyx' : 'twilio';
  },

  // --- Training ---
  
  async getTrainingProviderStatus(): Promise<{ openai: boolean }> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/training/providers/status`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch training provider status: ${res.status}`);
    }
    return res.json();
  },

  // --- Generic API Methods (for new endpoints) ---

  async get(endpoint: string): Promise<any> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || `Request failed: ${res.status}`);
    }
    return res.json();
  },

  async post(endpoint: string, data?: any): Promise<any> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
      },
      body: data ? JSON.stringify(data) : undefined
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || `Request failed: ${res.status}`);
    }
    return res.json();
  },

  async put(endpoint: string, data?: any): Promise<any> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
      },
      body: data ? JSON.stringify(data) : undefined
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || `Request failed: ${res.status}`);
    }
    return res.json();
  },

  async delete(endpoint: string): Promise<any> {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token || ''}` }
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || `Request failed: ${res.status}`);
    }
    return res.json();
  }
};