
import { Device, Call } from '@twilio/voice-sdk';
import { CallState, TwilioPhoneNumber, CallEndReason, TwilioCallStatus } from '../types';

// Extended call state info with end reason tracking
export interface CallStateInfo {
  state: CallState;
  callSid?: string;
  duration?: number;
  endReason?: CallEndReason;
  answeredBy?: 'human' | 'machine' | 'unknown';
  disconnectedBy?: 'local' | 'remote';
}

/**
 * Real implementation using @twilio/voice-sdk
 * Make sure to run: npm install @twilio/voice-sdk
 */
class LiveTwilioService {
  private device: Device | null = null;
  private currentCall: Call | null = null;
  private statusCallbacks: Set<(stateInfo: CallStateInfo) => void> = new Set();
  private tokenRefreshInterval: NodeJS.Timeout | null = null;
  private getTokenCallback: (() => Promise<string>) | null = null;
  private currentCallSid: string | null = null;
  private callStartTime: Date | null = null;
  private localDisconnect: boolean = false; // Track if we initiated the disconnect

  registerStatusCallback(cb: (stateInfo: CallStateInfo) => void) {
    this.statusCallbacks.add(cb);
    return () => this.statusCallbacks.delete(cb);
  }

  // Legacy support - wrap to new format
  registerStatusCallbackLegacy(cb: (state: CallState) => void) {
    const wrappedCb = (info: CallStateInfo) => cb(info.state);
    this.statusCallbacks.add(wrappedCb);
    return () => this.statusCallbacks.delete(wrappedCb);
  }

  registerTokenRefresh(getToken: () => Promise<string>) {
    this.getTokenCallback = getToken;
  }

  getCurrentCallSid(): string | null {
    return this.currentCallSid;
  }

  getCallDuration(): number {
    if (!this.callStartTime) return 0;
    return Math.floor((Date.now() - this.callStartTime.getTime()) / 1000);
  }

  private async refreshToken() {
    if (!this.getTokenCallback || !this.device) return;
    try {
      const newToken = await this.getTokenCallback();
      this.device.updateToken(newToken);
      console.log('Twilio token refreshed successfully');
    } catch (err) {
      console.error('Failed to refresh Twilio token:', err);
    }
  }

  private emitStatus(state: CallState, extras: Partial<CallStateInfo> = {}) {
    const stateInfo: CallStateInfo = {
      state,
      callSid: this.currentCallSid || undefined,
      duration: this.getCallDuration(),
      ...extras
    };
    console.log('TwilioService emitting status:', state, 'to', this.statusCallbacks.size, 'callbacks');
    this.statusCallbacks.forEach(cb => {
      try {
        cb(stateInfo);
      } catch (e) {
        console.error('Error in status callback:', e);
      }
    });
  }

  /**
   * Initialize the Twilio Device with a Capability Token fetched from your backend
   */
  async initialize(token: string) {
    try {
      this.device = new Device(token, {
        logLevel: 1,
        codecPreferences: ['opus', 'pcmu'],
        disableAudioContextSounds: true,
        enableRingingTimer: true,
        enableImprovedSignalingErrorPrecision: true,
      });

      this.device.on('registered', () => console.log('Twilio Device Ready'));
      this.device.on('error', (error) => {
        console.error('Twilio Device Error:', error);
        // Log the error code for debugging
        if (error && typeof error === 'object') {
          console.error('Error code:', (error as any).code);
          console.error('Error message:', (error as any).message);
          // If token is invalid, try to refresh it
          if ((error as any).code === 20101) { // AccessTokenInvalid
            console.log('Attempting to refresh token due to invalid token error');
            this.refreshToken();
          }
        }
      });
      
      this.device.on('incoming', (call) => {
        // Handle incoming calls here if needed
        call.accept();
        this.currentCall = call;
        this.setupCallListeners(call);
      });

      await this.device.register();

      // Refresh token every 50 minutes (tokens are typically valid for 1 hour)
      if (this.getTokenCallback) {
        this.tokenRefreshInterval = setInterval(() => {
          this.refreshToken();
        }, 50 * 60 * 1000);
      }

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
    if (!this.device) {
      console.warn('Twilio device not initialized - this service should not be called if using Telnyx');
      throw new Error("Twilio device not initialized. Check voice provider configuration.");
    }

    this.localDisconnect = false;
    this.callStartTime = null;
    this.emitStatus(CallState.DIALING);

    const params: any = { To: phoneNumber };
    if (fromNumber) params.callerId = fromNumber;

    try {
      console.log('Twilio: Calling device.connect() with params:', params);
      const call = await this.device.connect({ params });
      
      console.log('Twilio: device.connect() returned:', {
        type: typeof call,
        isNull: call === null,
        isUndefined: call === undefined,
        hasOn: call && typeof call.on === 'function',
        constructor: call?.constructor?.name,
        keys: call ? Object.keys(call).slice(0, 10) : []
      });
      
      // Validate the call object before proceeding
      if (!call) {
        console.error('Device.connect() returned null or undefined');
        throw new Error("Device.connect() returned null or undefined");
      }
      
      // Check if call is a Promise that needs to be awaited again
      if (call instanceof Promise) {
        console.log('Call object is a Promise, awaiting it...');
        const resolvedCall = await call;
        return this.handleCallObject(resolvedCall, params);
      }
      
      return this.handleCallObject(call, params);
    } catch (err) {
      console.error("Connection failed", err);
      this.emitStatus(CallState.WRAP_UP, { endReason: CallEndReason.FAILED });
      throw err;
    }
  }

  private handleCallObject(call: any, params: any): Call {
    if (!call) {
      throw new Error("Call object is null or undefined");
    }
    
    if (typeof call.on !== 'function') {
      console.error("Call object missing .on() method. Call object details:", {
        type: typeof call,
        constructor: call?.constructor?.name,
        keys: Object.keys(call),
        proto: Object.getPrototypeOf(call),
        methods: Object.getOwnPropertyNames(Object.getPrototypeOf(call) || {})
      });
      throw new Error("Invalid call object - missing event handler method. Type: " + typeof call);
    }
    
    this.currentCall = call;
    // The callSid is available on the call object after connection
    // Try multiple ways to get the CallSid
    this.currentCallSid = (call as any).parameters?.CallSid 
      || (call as any).customParameters?.get?.('CallSid')
      || (call as any)._mediaHandler?.callSid
      || null;
    
    console.log('Call connected, CallSid:', this.currentCallSid);
    this.setupCallListeners(call);
    return call;
  }

  private setupCallListeners(call: Call) {
    // Safety check - ensure call object has the .on() method
    if (!call || typeof call.on !== 'function') {
      console.error('Invalid call object - missing .on() method:', call);
      this.emitStatus(CallState.WRAP_UP, { endReason: CallEndReason.FAILED });
      return;
    }

    // Wrap all event handlers in try-catch to prevent errors from breaking the flow
    const safeEventHandler = (eventName: string, handler: Function) => {
      try {
        call.on(eventName as any, (...args: any[]) => {
          try {
            handler(...args);
          } catch (err) {
            console.error(`Error in Twilio ${eventName} handler:`, err);
          }
        });
      } catch (err) {
        console.error(`Error registering Twilio ${eventName} listener:`, err);
      }
    };

    // Called when the call is accepted/answered
    safeEventHandler('accept', () => {
      this.callStartTime = new Date();
      // Get CallSid when call is accepted - try multiple properties
      const callSid = (call as any).parameters?.CallSid 
        || (call as any).customParameters?.get?.('CallSid')
        || (call as any)._mediaHandler?.callSid
        || (call as any).outboundConnectionId
        || this.currentCallSid;
      
      if (callSid) {
        this.currentCallSid = callSid;
        console.log('Call accepted, CallSid:', this.currentCallSid);
      }
      this.emitStatus(CallState.CONNECTED);
    });

    // Called when the call is ringing
    safeEventHandler('ringing', (hasEarlyMedia: boolean) => {
      console.log('Call is ringing, hasEarlyMedia:', hasEarlyMedia);
      // Also try to get CallSid on ringing
      const callSid = (call as any).parameters?.CallSid 
        || (call as any).customParameters?.get?.('CallSid')
        || (call as any)._mediaHandler?.callSid
        || (call as any).outboundConnectionId;
      if (callSid && !this.currentCallSid) {
        this.currentCallSid = callSid;
        console.log('Got CallSid on ringing:', this.currentCallSid);
      }
      this.emitStatus(CallState.RINGING);
    });

    // Called when the call is disconnected
    safeEventHandler('disconnect', (call: Call) => {
      console.log('Call disconnected');
      
      // Determine who hung up based on our local tracking
      const endReason = this.localDisconnect 
        ? CallEndReason.AGENT_HANGUP 
        : CallEndReason.CUSTOMER_HANGUP;
      
      this.emitStatus(CallState.WRAP_UP, { 
        endReason,
        disconnectedBy: this.localDisconnect ? 'local' : 'remote',
        duration: this.getCallDuration()
      });
      
      this.currentCall = null;
      this.currentCallSid = null;
      this.callStartTime = null;
      this.localDisconnect = false;
    });

    // Called when there's a call error
    safeEventHandler('error', (err: any) => {
      console.error("Call error", err);
      
      // Map error codes to end reasons
      let endReason = CallEndReason.FAILED;
      if (err.code === 31002) endReason = CallEndReason.INVALID_NUMBER;
      else if (err.code === 31005) endReason = CallEndReason.BUSY;
      else if (err.code === 31486) endReason = CallEndReason.BUSY;
      else if (err.code === 31480) endReason = CallEndReason.NO_ANSWER;
      else if (err.code === 31603) endReason = CallEndReason.CALL_REJECTED;
      
      this.emitStatus(CallState.WRAP_UP, { endReason });
    });

    // Called when call is rejected
    safeEventHandler('reject', () => {
      console.log('Call rejected');
      this.emitStatus(CallState.WRAP_UP, { endReason: CallEndReason.CALL_REJECTED });
      this.currentCall = null;
      this.currentCallSid = null;
    });

    // Called when call is canceled
    safeEventHandler('cancel', () => {
      console.log('Call canceled');
      this.emitStatus(CallState.WRAP_UP, { endReason: CallEndReason.CANCELED });
      this.currentCall = null;
      this.currentCallSid = null;
    });

    // Called when answering machine is detected
    call.on('messageReceived', (message: any) => {
      console.log('Message received:', message);
      // AMD detection might come through here
    });
  }

  disconnect() {
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
      this.tokenRefreshInterval = null;
    }
    
    // Mark that we initiated the disconnect
    this.localDisconnect = true;
    
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
