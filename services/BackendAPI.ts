
import { Prospect, CallLog, TwilioPhoneNumber, AuthResponse, User, Message } from '../types';

const API_BASE_URL = 'http://localhost:3001/api';

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
    return res.json();
  },

  async logout(): Promise<void> {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  },

  async getCurrentUser(): Promise<User | null> {
    const token = localStorage.getItem('authToken');
    if (!token) return null;
    
    const res = await fetch(`${API_BASE_URL}/auth/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      return null;
    }
    
    const data = await res.json();
    return data.user;
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

  // --- Calls ---

  async getCallHistory(): Promise<CallLog[]> {
    const res = await fetch(`${API_BASE_URL}/calls`);
    return res.json();
  },

  async logCall(log: Partial<CallLog>): Promise<CallLog> {
    const res = await fetch(`${API_BASE_URL}/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log)
    });
    return res.json();
  },

  // --- Settings ---
  
  async getIncomingNumbers(): Promise<TwilioPhoneNumber[]> {
    const res = await fetch(`${API_BASE_URL}/voice/incoming-numbers`);
    return res.json();
  },

  async getTwilioNumbers(): Promise<TwilioPhoneNumber[]> {
    const res = await fetch(`${API_BASE_URL}/voice/numbers`);
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
  }
};
