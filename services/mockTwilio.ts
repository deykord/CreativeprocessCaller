import { CallState, TwilioPhoneNumber } from '../types';

/**
 * Mocks the behavior of @twilio/voice-sdk Device and Connection
 * This allows the UI to function fully in a frontend-only environment.
 */
class MockTwilioService {
  private statusCallback: ((state: CallState) => void) | null = null;
  
  initialize(token: string) {
    console.log(`[TwilioMock] Initialized with token: ${token.substring(0, 10)}...`);
    return this;
  }

  registerStatusCallback(cb: (state: CallState) => void) {
    this.statusCallback = cb;
  }

  async connect(phoneNumber: string, fromNumber?: string) {
    console.log(`[TwilioMock] Connecting to ${phoneNumber} from ${fromNumber || 'Default'}...`);
    
    if (this.statusCallback) this.statusCallback(CallState.DIALING);

    // Simulate network delay and ringing
    await new Promise(resolve => setTimeout(resolve, 800));
    if (this.statusCallback) this.statusCallback(CallState.RINGING);

    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Simulate connection
    if (this.statusCallback) this.statusCallback(CallState.CONNECTED);
    
    return {
      disconnect: () => this.disconnect()
    };
  }

  disconnect() {
    console.log('[TwilioMock] Call disconnected');
    if (this.statusCallback) this.statusCallback(CallState.WRAP_UP);
  }

  mute(muted: boolean) {
    console.log(`[TwilioMock] Microphone ${muted ? 'muted' : 'unmuted'}`);
  }

  /**
   * Simulates fetching numbers owned by the Twilio Account
   * In a real app, this would call your backend, which calls client.incomingPhoneNumbers.list()
   */
  async getIncomingPhoneNumbers(): Promise<TwilioPhoneNumber[]> {
    // TODO: Integrate with backend API to fetch real Twilio phone numbers
    // Example: return await fetch('/api/twilio/numbers').then(res => res.json());
    return [];
  }
}

export const twilioService = new MockTwilioService();
