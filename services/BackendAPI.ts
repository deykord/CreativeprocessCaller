
import { Prospect, CallLog, TwilioPhoneNumber } from '../types';

const API_BASE_URL = 'http://localhost:3001/api';

/**
 * Connects to the Node.js / Express Backend
 */
export const backendAPI = {
  
  // --- Auth ---
  
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
  }
};
