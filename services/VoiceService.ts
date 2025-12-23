/**
 * Unified Voice Service
 * Abstraction layer that can use either Twilio or Telnyx as the voice provider
 * 
 * This allows easy switching between providers without changing the PowerDialer or other components
 */

console.log('🔊 VoiceService module loading...');

import { liveTwilioService, CallStateInfo as TwilioCallStateInfo } from './LiveTwilioService';
import { telnyxService, TelnyxCallStateInfo, TelnyxCredentials } from './TelnyxService';
import { CallState, CallEndReason } from '../types';

console.log('🔊 VoiceService imports complete');

export type VoiceProvider = 'twilio' | 'telnyx';

export interface UnifiedCallStateInfo {
  state: CallState;
  callId?: string;          // callSid (Twilio) or callId (Telnyx)
  callControlId?: string;   // Telnyx only
  duration?: number;
  endReason?: CallEndReason;
  answeredBy?: 'human' | 'machine' | 'unknown';
  disconnectedBy?: 'local' | 'remote';
  provider: VoiceProvider;
}

export interface VoiceServiceConfig {
  provider: VoiceProvider;
  twilio?: {
    token: string;
  };
  telnyx?: TelnyxCredentials;
}

/**
 * Unified Voice Service
 * Provides a single interface for both Twilio and Telnyx
 */
class UnifiedVoiceService {
  private provider: VoiceProvider = 'twilio';
  private statusCallbacks: Set<(stateInfo: UnifiedCallStateInfo) => void> = new Set();
  private initialized: boolean = false;
  private unsubscribeFns: Array<() => void> = [];

  /**
   * Set the voice provider to use
   */
  setProvider(provider: VoiceProvider) {
    this.provider = provider;
    console.log(`Voice provider set to: ${provider}`);
  }

  /**
   * Get the current provider
   */
  getProvider(): VoiceProvider {
    return this.provider;
  }

  /**
   * Register a callback for call state changes
   * Returns an unsubscribe function
   */
  registerStatusCallback(cb: (stateInfo: UnifiedCallStateInfo) => void): () => void {
    this.statusCallbacks.add(cb);
    
    // Create wrapper that broadcasts to this callback
    const wrapperCb = (info: TelnyxCallStateInfo | TwilioCallStateInfo) => {
      const unifiedInfo: UnifiedCallStateInfo = {
        ...info,
        callId: 'callSid' in info ? info.callSid : info.callId,
        provider: this.provider,
      };
      cb(unifiedInfo);
    };
    
    // Register with the appropriate service based on current provider
    let unsubscribe: (() => void) | undefined;
    if (this.provider === 'twilio') {
      unsubscribe = liveTwilioService.registerStatusCallback(wrapperCb as any);
    } else {
      unsubscribe = telnyxService.registerStatusCallback(wrapperCb as any);
    }
    
    // Return combined unsubscribe function
    return () => {
      this.statusCallbacks.delete(cb);
      unsubscribe?.();
    };
  }

  /**
   * Initialize the voice service
   */
  async initialize(config: VoiceServiceConfig): Promise<void> {
    this.provider = config.provider;

    if (this.provider === 'twilio' && config.twilio?.token) {
      await liveTwilioService.initialize(config.twilio.token);
      this.initialized = true;
      console.log('Twilio voice service initialized');
    } else if (this.provider === 'telnyx' && config.telnyx) {
      await telnyxService.initialize(config.telnyx);
      this.initialized = true;
      console.log('Telnyx voice service initialized');
    } else {
      throw new Error(`Invalid voice service configuration for provider: ${this.provider}`);
    }

    // Re-register existing callbacks with the new provider
    const existingCallbacks = Array.from(this.statusCallbacks);
    this.statusCallbacks.clear();
    // Clean up old unsubscribe functions
    this.unsubscribeFns.forEach(fn => fn());
    this.unsubscribeFns = [];
    // Re-register with new provider
    existingCallbacks.forEach(cb => {
      const unsub = this.registerStatusCallback(cb);
      this.unsubscribeFns.push(unsub);
    });
  }

  /**
   * Make an outbound call
   */
  async connect(phoneNumber: string, fromNumber?: string): Promise<any> {
    if (!this.initialized) {
      throw new Error('Voice service not initialized');
    }

    console.log(`📞 VoiceService.connect() using provider: ${this.provider}`);
    
    if (this.provider === 'twilio') {
      console.log('→ Routing to Twilio service');
      return liveTwilioService.connect(phoneNumber, fromNumber);
    } else {
      console.log('→ Routing to Telnyx service');
      return telnyxService.connect(phoneNumber, fromNumber);
    }
  }

  /**
   * Disconnect the current call
   */
  disconnect(): void {
    if (this.provider === 'twilio') {
      liveTwilioService.disconnect();
    } else {
      telnyxService.disconnect();
    }
  }

  /**
   * Mute/unmute the current call
   */
  mute(shouldMute: boolean): void {
    if (this.provider === 'twilio') {
      liveTwilioService.mute(shouldMute);
    } else {
      telnyxService.mute(shouldMute);
    }
  }

  /**
   * Toggle mute state
   */
  toggleMute(): boolean {
    if (this.provider === 'twilio') {
      // Twilio doesn't have toggleMute, so we track state ourselves
      const currentState = (this as any)._isMuted || false;
      (this as any)._isMuted = !currentState;
      liveTwilioService.mute(!currentState);
      return !currentState;
    } else {
      return telnyxService.toggleMute();
    }
  }

  /**
   * Toggle hold state
   */
  toggleHold(): boolean {
    if (this.provider === 'twilio') {
      // Twilio doesn't have toggleHold, so we track state ourselves
      const currentState = (this as any)._isHeld || false;
      (this as any)._isHeld = !currentState;
      // Twilio hold would go here if implemented
      return !currentState;
    } else {
      return telnyxService.toggleHold();
    }
  }

  /**
   * Get the current call ID
   */
  getCurrentCallId(): string | null {
    if (this.provider === 'twilio') {
      return liveTwilioService.getCurrentCallSid();
    } else {
      return telnyxService.getCurrentCallId();
    }
  }

  /**
   * Alias for getCurrentCallId - maintains compatibility with Twilio naming
   */
  getCurrentCallSid(): string | null {
    return this.getCurrentCallId();
  }

  /**
   * Get the call control ID (Telnyx only)
   */
  getCallControlId(): string | null {
    if (this.provider === 'telnyx') {
      return telnyxService.getCallControlId();
    }
    return null;
  }

  /**
   * Get the current call duration
   */
  getCallDuration(): number {
    if (this.provider === 'twilio') {
      return liveTwilioService.getCallDuration();
    } else {
      return telnyxService.getCallDuration();
    }
  }

  /**
   * Check if the service is connected
   */
  isConnected(): boolean {
    if (this.provider === 'telnyx') {
      return telnyxService.isConnected();
    }
    // Twilio doesn't have a direct isConnected method
    return this.initialized;
  }

  /**
   * Check if there's an active call
   */
  hasActiveCall(): boolean {
    if (this.provider === 'telnyx') {
      return telnyxService.hasActiveCall();
    }
    // For Twilio, check if we have a current call SID
    return liveTwilioService.getCurrentCallSid() !== null;
  }

  /**
   * Send DTMF tones (Telnyx only currently)
   */
  sendDTMF(digit: string): void {
    if (this.provider === 'telnyx') {
      telnyxService.sendDTMF(digit);
    }
    // Twilio DTMF would need to be added to LiveTwilioService
  }

  /**
   * Hold/unhold (Telnyx only currently)
   */
  hold(shouldHold: boolean): void {
    if (this.provider === 'telnyx') {
      telnyxService.hold(shouldHold);
    }
    // Twilio hold would need to be added to LiveTwilioService
  }

  /**
   * Get available audio devices
   */
  async getAudioDevices(): Promise<{ microphones: MediaDeviceInfo[], speakers: MediaDeviceInfo[] }> {
    // Same implementation for both providers
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      microphones: devices.filter(d => d.kind === 'audioinput'),
      speakers: devices.filter(d => d.kind === 'audiooutput'),
    };
  }

  /**
   * Destroy and clean up the service
   */
  destroy(): void {
    if (this.provider === 'telnyx') {
      telnyxService.destroy();
    } else {
      liveTwilioService.disconnect();
    }
    this.initialized = false;
  }

  /**
   * Register token refresh callback (Twilio only)
   */
  registerTokenRefresh(getToken: () => Promise<string>): void {
    if (this.provider === 'twilio') {
      liveTwilioService.registerTokenRefresh(getToken);
    }
    // Telnyx uses SIP credentials, no token refresh needed
  }
}

// Singleton instance
export const voiceService = new UnifiedVoiceService();

// Export individual services for direct access if needed
export { liveTwilioService } from './LiveTwilioService';
export { telnyxService } from './TelnyxService';
