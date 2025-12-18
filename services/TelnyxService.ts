/**
 * Telnyx WebRTC Service
 * Alternative to Twilio Voice SDK for browser-based calling
 * 
 * Install: npm install @telnyx/webrtc
 */

import { TelnyxRTC, ICall, INotification } from '@telnyx/webrtc';
import { CallState, CallEndReason } from '../types';

// Extended call state info with end reason tracking
export interface TelnyxCallStateInfo {
  state: CallState;
  callId?: string;
  callControlId?: string;
  duration?: number;
  endReason?: CallEndReason;
  answeredBy?: 'human' | 'machine' | 'unknown';
  disconnectedBy?: 'local' | 'remote';
}

export interface TelnyxCredentials {
  login: string;      // SIP username from Telnyx credential connection
  password: string;   // SIP password
  callerIdName?: string;
  callerIdNumber?: string;
}

/**
 * Telnyx WebRTC Service - Browser-based calling using Telnyx
 */
class TelnyxService {
  private client: TelnyxRTC | null = null;
  private currentCall: ICall | null = null;
  private statusCallbacks: Set<(stateInfo: TelnyxCallStateInfo) => void> = new Set();
  private currentCallId: string | null = null;
  private callControlId: string | null = null;
  private callStartTime: Date | null = null;
  private localDisconnect: boolean = false;
  private credentials: TelnyxCredentials | null = null;
  private isReady: boolean = false;
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;

  registerStatusCallback(cb: (stateInfo: TelnyxCallStateInfo) => void) {
    this.statusCallbacks.add(cb);
    // Return unsubscribe function
    return () => this.statusCallbacks.delete(cb);
  }

  // Legacy support - wrap to new format
  registerStatusCallbackLegacy(cb: (state: CallState) => void) {
    const wrappedCb = (info: TelnyxCallStateInfo) => cb(info.state);
    this.statusCallbacks.add(wrappedCb);
    return () => this.statusCallbacks.delete(wrappedCb);
  }

  getCurrentCallId(): string | null {
    return this.currentCallId;
  }

  getCallControlId(): string | null {
    return this.callControlId;
  }

  getCallDuration(): number {
    if (!this.callStartTime) return 0;
    return Math.floor((Date.now() - this.callStartTime.getTime()) / 1000);
  }

  private emitStatus(state: CallState, extras: Partial<TelnyxCallStateInfo> = {}) {
    const stateInfo: TelnyxCallStateInfo = {
      state,
      callId: this.currentCallId || undefined,
      callControlId: this.callControlId || undefined,
      duration: this.getCallDuration(),
      ...extras
    };
    console.log('TelnyxService emitting status:', state, 'to', this.statusCallbacks.size, 'callbacks');
    this.statusCallbacks.forEach(cb => {
      try {
        cb(stateInfo);
      } catch (e) {
        console.error('Error in status callback:', e);
      }
    });
  }

  /**
   * Initialize the Telnyx WebRTC client
   * @param credentials - SIP credentials from Telnyx
   */
  async initialize(credentials: TelnyxCredentials): Promise<this> {
    try {
      console.log('Initializing Telnyx with credentials:', { login: credentials.login, hasPassword: !!credentials.password });
      this.credentials = credentials;
      this.isReady = false;

      // Validate credentials
      if (!credentials.login || !credentials.password) {
        throw new Error('Telnyx credentials missing: login and password are required');
      }

      // Create audio element for remote audio if it doesn't exist
      this.ensureAudioElement();

      // Create a promise that resolves when telnyx.ready fires
      this.readyPromise = new Promise((resolve) => {
        this.readyResolve = resolve;
      });

      console.log('Creating TelnyxRTC instance...');
      this.client = new TelnyxRTC({
        login: credentials.login,
        password: credentials.password,
        // Optional caller ID settings
        ...(credentials.callerIdName && { callerIdName: credentials.callerIdName }),
        ...(credentials.callerIdNumber && { callerIdNumber: credentials.callerIdNumber }),
      });

      // Set the audio element for remote audio playback
      this.client.remoteElement = 'telnyx-remote-audio';

      // Set up event listeners BEFORE connecting
      console.log('Setting up Telnyx event listeners...');
      this.setupClientListeners();

      // Connect to Telnyx
      console.log('Connecting to Telnyx...');
      await this.client.connect();
      console.log('Telnyx connect() completed');

      // Wait for the ready event (max 30 seconds)
      console.log('Waiting for telnyx.ready event...');
      const timeout = new Promise<void>((_, reject) => 
        setTimeout(() => reject(new Error('Telnyx client ready timeout after 30 seconds. Check SIP credentials.')), 30000)
      );
      
      await Promise.race([this.readyPromise, timeout]);

      console.log('✓ Telnyx WebRTC client connected and ready');
      return this;
    } catch (err) {
      console.error('Failed to initialize Telnyx client:', err);
      this.isReady = false;
      throw err;
    }
  }

  /**
   * Create audio element for remote audio if it doesn't exist
   */
  private ensureAudioElement() {
    if (typeof document === 'undefined') return;
    
    let audioEl = document.getElementById('telnyx-remote-audio') as HTMLAudioElement;
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.id = 'telnyx-remote-audio';
      audioEl.autoplay = true;
      // Don't set muted - we want to hear the audio!
      document.body.appendChild(audioEl);
      console.log('Created Telnyx audio element');
    }
  }

  private setupClientListeners() {
    if (!this.client) return;

    // Client ready
    this.client.on('telnyx.ready', () => {
      console.log('✓ EVENT: telnyx.ready - Client ready for calls');
      this.isReady = true;
      if (this.readyResolve) {
        this.readyResolve();
      }
    });

    // Client error
    this.client.on('telnyx.error', (error: any) => {
      console.error('✗ EVENT: telnyx.error -', error);
      if (error.message) {
        console.error('Error message:', error.message);
      }
    });

    // Socket close
    this.client.on('telnyx.socket.close', (event: any) => {
      console.log('⚠ EVENT: telnyx.socket.close', event);
      this.isReady = false;
    });

    // Socket error
    this.client.on('telnyx.socket.error', (event: any) => {
      console.error('✗ EVENT: telnyx.socket.error', event);
    });

    // Socket open
    this.client.on('telnyx.socket.open', () => {
      console.log('✓ EVENT: telnyx.socket.open - WebSocket connected');
    });

    // Handle notifications (call updates)
    this.client.on('telnyx.notification', (notification: INotification) => {
      console.log('Telnyx notification:', notification.type);
      
      // Handle call updates
      if (notification.type === 'callUpdate' && notification.call) {
        this.handleCallUpdate(notification.call);
      }
    });
  }

  /**
   * Make an outbound call
   * @param phoneNumber - The phone number to call (E.164 format)
   * @param fromNumber - The caller ID number (optional, uses default)
   */
  async connect(phoneNumber: string, fromNumber?: string): Promise<ICall> {
    if (!this.client) {
      throw new Error('Telnyx client not initialized. Call initialize() first.');
    }
    if (!this.isReady) {
      throw new Error('Telnyx client not ready. The WebRTC connection may still be establishing. Please wait a moment and try again.');
    }

    this.localDisconnect = false;
    this.callStartTime = null;
    this.emitStatus(CallState.DIALING);

    try {
      const call = this.client.newCall({
        destinationNumber: phoneNumber,
        callerNumber: fromNumber || this.credentials?.callerIdNumber,
        callerName: this.credentials?.callerIdName || 'Sales Agent',
        audio: true,
        video: false,
      });

      this.currentCall = call;
      this.currentCallId = call.id;
      
      // Listen to call-level state changes directly on the call object
      call.on('stateChange', (state: { current: string }) => {
        console.log('Telnyx call stateChange event:', state.current);
        this.handleCallUpdate(call);
      });

      return call;
    } catch (err) {
      console.error('Telnyx call connection failed:', err);
      this.emitStatus(CallState.WRAP_UP, { endReason: CallEndReason.FAILED });
      throw err;
    }
  }

  private handleCallUpdate(call: ICall) {
    const state = call.state;
    console.log('Telnyx handleCallUpdate - raw state:', state, 'call.id:', call.id);

    // Update current call reference
    this.currentCall = call;
    this.currentCallId = call.id;

    switch (state) {
      case 'new':
      case 'trying':
      case 'requesting':
      case 'recovering':
        console.log('Telnyx: Emitting DIALING for state:', state);
        this.emitStatus(CallState.DIALING);
        break;
      case 'ringing':
      case 'early':
      case 'answering':
        console.log('Telnyx: Emitting RINGING for state:', state);
        this.emitStatus(CallState.RINGING);
        break;
      case 'active':
        console.log('Telnyx: Emitting CONNECTED for state:', state);
        if (!this.callStartTime) {
          this.callStartTime = new Date();
        }
        this.emitStatus(CallState.CONNECTED);
        break;
      case 'hangup':
      case 'destroy':
      case 'purge':
        console.log('🔴 Telnyx: Call ended with state:', state);
        console.log('🔴 Local disconnect:', this.localDisconnect);
        const endReason = this.localDisconnect
          ? CallEndReason.AGENT_HANGUP
          : CallEndReason.CUSTOMER_HANGUP;
        
        console.log('🔴 Emitting WRAP_UP with reason:', endReason);
        this.emitStatus(CallState.WRAP_UP, {
          endReason,
          disconnectedBy: this.localDisconnect ? 'local' : 'remote',
          duration: this.getCallDuration()
        });
        console.log('🔴 Cleaning up call state');
        this.cleanup();
        break;
      case 'held':
        // Call on hold - could emit a specific state if needed
        break;
    }
  }

  private handleCallStateChange(state: string, call: ICall) {
    const stateMap: Record<string, CallState> = {
      'new': CallState.IDLE,
      'trying': CallState.DIALING,
      'requesting': CallState.DIALING,
      'recovering': CallState.DIALING,
      'ringing': CallState.RINGING,
      'answering': CallState.RINGING,
      'early': CallState.RINGING,
      'active': CallState.CONNECTED,
      'held': CallState.CONNECTED,
      'hangup': CallState.WRAP_UP,
      'destroy': CallState.WRAP_UP,
      'purge': CallState.COMPLETED,
    };

    const mappedState = stateMap[state] || CallState.IDLE;
    
    if (state === 'active' && !this.callStartTime) {
      this.callStartTime = new Date();
      this.currentCallId = call.id;
    }

    // Only emit for significant state changes
    if (['ringing', 'active', 'hangup'].includes(state)) {
      this.emitStatus(mappedState);
    }
  }

  private mapHangupCause(cause?: string): CallEndReason {
    if (!cause) return CallEndReason.CUSTOMER_HANGUP;

    const causeMap: Record<string, CallEndReason> = {
      'NORMAL_CLEARING': CallEndReason.CUSTOMER_HANGUP,
      'USER_BUSY': CallEndReason.BUSY,
      'NO_USER_RESPONSE': CallEndReason.NO_ANSWER,
      'NO_ANSWER': CallEndReason.NO_ANSWER,
      'CALL_REJECTED': CallEndReason.CALL_REJECTED,
      'INVALID_NUMBER_FORMAT': CallEndReason.INVALID_NUMBER,
      'UNALLOCATED_NUMBER': CallEndReason.INVALID_NUMBER,
      'DESTINATION_OUT_OF_ORDER': CallEndReason.FAILED,
      'NETWORK_OUT_OF_ORDER': CallEndReason.NETWORK_ERROR,
      'ORIGINATOR_CANCEL': CallEndReason.CANCELED,
    };

    return causeMap[cause] || CallEndReason.CUSTOMER_HANGUP;
  }

  private mapErrorToEndReason(error: any): CallEndReason {
    if (!error) return CallEndReason.FAILED;

    const errorCode = error.code || '';
    
    if (errorCode.includes('BUSY')) return CallEndReason.BUSY;
    if (errorCode.includes('NO_ANSWER')) return CallEndReason.NO_ANSWER;
    if (errorCode.includes('INVALID')) return CallEndReason.INVALID_NUMBER;
    if (errorCode.includes('NETWORK')) return CallEndReason.NETWORK_ERROR;
    if (errorCode.includes('REJECTED')) return CallEndReason.CALL_REJECTED;

    return CallEndReason.FAILED;
  }

  private cleanup() {
    this.currentCall = null;
    this.currentCallId = null;
    this.callControlId = null;
    this.callStartTime = null;
    this.localDisconnect = false;
  }

  /**
   * Disconnect the current call
   */
  disconnect() {
    console.log('🔴 Telnyx: Disconnect requested');
    this.localDisconnect = true;

    if (this.currentCall) {
      console.log('🔴 Telnyx: Hanging up call:', this.currentCallId);
      try {
        this.currentCall.hangup();
        console.log('✓ Telnyx: Hangup command sent');
      } catch (err) {
        console.error('Error hanging up call:', err);
        // Force cleanup even if hangup fails
        this.emitStatus(CallState.WRAP_UP, {
          endReason: CallEndReason.AGENT_HANGUP,
          disconnectedBy: 'local',
          duration: this.getCallDuration()
        });
        this.cleanup();
      }
    } else {
      console.warn('🔴 Telnyx: No active call to disconnect');
    }
  }

  /**
   * Mute/unmute the current call
   */
  mute(shouldMute: boolean) {
    if (this.currentCall) {
      if (shouldMute) {
        this.currentCall.muteAudio();
      } else {
        this.currentCall.unmuteAudio();
      }
    }
  }

  /**
   * Hold/unhold the current call
   */
  hold(shouldHold: boolean) {
    if (this.currentCall) {
      if (shouldHold) {
        this.currentCall.hold();
      } else {
        this.currentCall.unhold();
      }
    }
  }

  /**
   * Send DTMF tones
   */
  sendDTMF(digit: string) {
    if (this.currentCall) {
      this.currentCall.dtmf(digit);
    }
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.client?.connected || false;
  }

  /**
   * Check if there's an active call
   */
  hasActiveCall(): boolean {
    return this.currentCall !== null;
  }

  /**
   * Destroy the client and clean up
   */
  destroy() {
    if (this.currentCall) {
      this.currentCall.hangup();
    }
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
    this.cleanup();
  }

  /**
   * Get available audio devices
   */
  async getAudioDevices(): Promise<{ microphones: MediaDeviceInfo[], speakers: MediaDeviceInfo[] }> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      microphones: devices.filter(d => d.kind === 'audioinput'),
      speakers: devices.filter(d => d.kind === 'audiooutput'),
    };
  }

  /**
   * Set the microphone device
   */
  async setMicrophone(deviceId: string) {
    if (this.currentCall) {
      await (this.currentCall as any).setAudioInDevice(deviceId);
    }
  }

  /**
   * Set the speaker device
   */
  async setSpeaker(deviceId: string) {
    if (this.currentCall) {
      await (this.currentCall as any).setAudioOutDevice(deviceId);
    }
  }
}

// Singleton instance
export const telnyxService = new TelnyxService();
