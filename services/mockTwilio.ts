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
    await new Promise(resolve => setTimeout(resolve, 600)); // Simulate API latency
    return [
      {
        sid: 'PN123456789',
        phoneNumber: '+15551002001',
        friendlyName: '(555) 100-2001',
        capabilities: { voice: true, sms: true, mms: true }
      },
      {
        sid: 'PN987654321',
        phoneNumber: '+15551002002',
        friendlyName: '(555) 100-2002',
        capabilities: { voice: true, sms: true, mms: false }
      },
      {
        sid: 'PN456123789',
        phoneNumber: '+14155550099',
        friendlyName: 'San Francisco HQ',
        capabilities: { voice: true, sms: true, mms: true }
      }
    ];
  }
}

export const twilioService = new MockTwilioService();
