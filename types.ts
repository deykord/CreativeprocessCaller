export interface Prospect {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  status: 'New' | 'Contacted' | 'Qualified' | 'Lost' | 'Do Not Call';
  lastCall?: string;
  notes?: string;
  timezone: string;
}

export enum CallState {
  IDLE = 'IDLE',
  DIALING = 'DIALING',
  RINGING = 'RINGING',
  CONNECTED = 'CONNECTED',
  WRAP_UP = 'WRAP_UP',
}

export interface CallLog {
  id: string;
  prospectId?: string;
  prospectName: string;
  phoneNumber: string;
  duration: number; // in seconds
  outcome: 'Connected' | 'Voicemail' | 'Busy' | 'No Answer' | 'Meeting Set' | 'Not Interested';
  timestamp: string;
  note: string;
  fromNumber: string;
}

export interface AgentStats {
  callsMade: number;
  connections: number;
  appointmentsSet: number;
  talkTime: number; // in minutes
}

export interface TwilioPhoneNumber {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
}

// Authentication Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role?: 'admin' | 'agent' | 'manager';
  profilePicture?: string;
  bio?: string;
  workHours?: WorkHours;
  createdAt: string;
  updatedAt?: string;
}

export interface WorkHours {
  monday?: { start: string; end: string };
  tuesday?: { start: string; end: string };
  wednesday?: { start: string; end: string };
  thursday?: { start: string; end: string };
  friday?: { start: string; end: string };
  saturday?: { start: string; end: string };
  sunday?: { start: string; end: string };
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  content: string;
  timestamp: string;
  read: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: User;
  token?: string;
  error?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}
