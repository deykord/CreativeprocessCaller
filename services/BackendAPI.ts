
import { Prospect, CallLog, TwilioPhoneNumber, AuthResponse, User } from '../types';

const API_BASE_URL = 'http://localhost:3001/api';

/**
 * Connects to the Node.js / Express Backend
 */
export const backendAPI = {
  
  // --- Authentication ---
  
  async signup(email: string, password: string, firstName: string, lastName: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, firstName, lastName })
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
  }
};
