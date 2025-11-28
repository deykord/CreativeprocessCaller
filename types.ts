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

