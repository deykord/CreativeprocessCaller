
import { Device, Call } from '@twilio/voice-sdk';
import { CallState, TwilioPhoneNumber } from '../types';

/**
 * Real implementation using @twilio/voice-sdk
 * Make sure to run: npm install @twilio/voice-sdk
 */
class LiveTwilioService {
  private device: Device | null = null;
  private currentCall: Call | null = null;
  private statusCallback: ((state: CallState) => void) | null = null;

  registerStatusCallback(cb: (state: CallState) => void) {
    this.statusCallback = cb;
  }

  /**
   * Initialize the Twilio Device with a Capability Token fetched from your backend
   */
  async initialize(token: string) {
    try {
      this.device = new Device(token, {
        logLevel: 1,
        codecPreferences: ['opus', 'pcmu'],
      });

      this.device.on('registered', () => console.log('Twilio Device Ready'));
      this.device.on('error', (error) => console.error('Twilio Device Error:', error));
      
      this.device.on('incoming', (call) => {
        // Handle incoming calls here if needed
        call.accept();
        this.currentCall = call;
        this.setupCallListeners(call);
      });

      await this.device.register();
      return this;
    } catch (err) {
      console.error("Failed to initialize Twilio device", err);
      throw err;
    }
  }

  /**
   * Make an outbound call
   */
  async connect(phoneNumber: string, fromNumber?: string) {
    if (!this.device) throw new Error("Device not initialized");

    if (this.statusCallback) this.statusCallback(CallState.DIALING);

    const params: any = { To: phoneNumber };
    if (fromNumber) params.callerId = fromNumber;

    try {
      const call = await this.device.connect({ params });
      this.currentCall = call;
      this.setupCallListeners(call);
      return call;
    } catch (err) {
      console.error("Connection failed", err);
      if (this.statusCallback) this.statusCallback(CallState.WRAP_UP); // Or error state
      throw err;
    }
  }

  private setupCallListeners(call: Call) {
    call.on('accept', () => {
      if (this.statusCallback) this.statusCallback(CallState.CONNECTED);
    });

    call.on('disconnect', () => {
      if (this.statusCallback) this.statusCallback(CallState.WRAP_UP);
      this.currentCall = null;
    });

    call.on('error', (err) => {
      console.error("Call error", err);
      if (this.statusCallback) this.statusCallback(CallState.WRAP_UP);
    });
  }

  disconnect() {
    if (this.currentCall) {
      this.currentCall.disconnect();
    } else if (this.device) {
      this.device.disconnectAll();
    }
  }

  mute(shouldMute: boolean) {
    if (this.currentCall) {
      this.currentCall.mute(shouldMute);
    }
  }

  async getIncomingPhoneNumbers(): Promise<TwilioPhoneNumber[]> {
    // In a real app, this MUST fetch from your backend API, not the Voice SDK
    // The Voice SDK cannot list account numbers.
    // Use the BackendAPI.getIncomingNumbers() method instead.
    return []; 
  }
}

export const liveTwilioService = new LiveTwilioService();
