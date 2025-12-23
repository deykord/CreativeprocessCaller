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
  private ringbackAudio: HTMLAudioElement | null = null;

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

  /**
   * Play local ringback tone when Telnyx doesn't provide early media
   */
  private playRingbackTone() {
    if (typeof document === 'undefined') return;
    
    // Stop any existing ringback
    this.stopRingbackTone();
    
    // Create ringback audio using AudioContext for reliable browser playback
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Generate ringback tone (US standard: 440Hz + 480Hz, 2s on, 4s off)
      const createRingbackTone = () => {
        const oscillator1 = audioContext.createOscillator();
        const oscillator2 = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator1.frequency.value = 440;
        oscillator2.frequency.value = 480;
        
        oscillator1.connect(gainNode);
        oscillator2.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        gainNode.gain.value = 0.1; // Low volume
        
        oscillator1.start();
        oscillator2.start();
        
        // Stop after 2 seconds
        setTimeout(() => {
          oscillator1.stop();
          oscillator2.stop();
        }, 2000);
      };
      
      // Play immediately and then every 4 seconds
      createRingbackTone();
      const intervalId = setInterval(() => {
        if (this.ringbackAudio) {
          createRingbackTone();
        } else {
          clearInterval(intervalId);
        }
      }, 4000);
      
      // Store reference to stop later (using a marker audio element)
      this.ringbackAudio = document.createElement('audio');
      (this.ringbackAudio as any)._intervalId = intervalId;
      (this.ringbackAudio as any)._audioContext = audioContext;
      
      console.log('🔔 Playing local ringback tone');
    } catch (e) {
      console.warn('Could not create ringback tone:', e);
    }
  }

  /**
   * Stop the local ringback tone
   */
  private stopRingbackTone() {
    if (this.ringbackAudio) {
      console.log('🔔 Stopping ringback tone');
      const intervalId = (this.ringbackAudio as any)._intervalId;
      const audioContext = (this.ringbackAudio as any)._audioContext;
      
      if (intervalId) clearInterval(intervalId);
      if (audioContext) audioContext.close().catch(() => {});
      
      this.ringbackAudio = null;
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

    // Handle incoming calls and ringing
    this.client.on('telnyx.socket.message', (message: any) => {
      console.log('📨 Telnyx socket message:', message);
      
      // Check if this is an incoming call invitation
      if (message.method === 'INVITE') {
        console.log('📞 Incoming call detected!');
        // The call object will be available via notification events
      }
      
      // Handle ringing notification (early media / ringback)
      if (message.method === 'telnyx_rtc.ringing') {
        console.log('🔔 Telnyx ringing detected via socket message');
        // Emit RINGING state
        this.emitStatus(CallState.RINGING);
        // Telnyx provides ringback via early media - no need for local tone
        // Try to attach remote stream for ringback audio
        if (this.currentCall) {
          this.tryAttachRemoteStream(this.currentCall);
        }
      }
      
      // Handle media event for stream updates
      if (message.method === 'telnyx_rtc.media') {
        console.log('🔊 Telnyx media event received');
        if (this.currentCall) {
          this.tryAttachRemoteStream(this.currentCall);
        }
      }
    });
  }

  /**
   * Make an outbound call
   * @param phoneNumber - The phone number to call (E.164 format)
   * @param fromNumber - The caller ID number (optional, uses default)
   */
  async connect(phoneNumber: string, fromNumber?: string): Promise<ICall> {
    console.log('📞 TelnyxService.connect() called with:', { phoneNumber, fromNumber });
    
    if (!this.client) {
      throw new Error('Telnyx client not initialized. Call initialize() first.');
    }
    if (!this.isReady) {
      throw new Error('Telnyx client not ready. The WebRTC connection may still be establishing. Please wait a moment and try again.');
    }

    this.localDisconnect = false;
    this.callStartTime = null;
    
    // Format numbers for E.164
    const formattedTo = phoneNumber.startsWith('+') ? phoneNumber : `+1${phoneNumber.replace(/\D/g, '')}`;
    const formattedFrom = fromNumber?.startsWith('+') ? fromNumber : (fromNumber ? `+1${fromNumber.replace(/\D/g, '')}` : undefined);

    console.log('🔍 Telnyx Client State BEFORE call:', {
      connected: this.client.connected,
      isReady: this.isReady,
      login: this.credentials?.login,
      callerIdNumber: this.credentials?.callerIdNumber,
      formattedTo,
      formattedFrom: formattedFrom || this.credentials?.callerIdNumber
    });

    this.emitStatus(CallState.DIALING);

    try {
      const call = this.client.newCall({
        destinationNumber: formattedTo,
        callerNumber: formattedFrom || this.credentials?.callerIdNumber,
        callerName: this.credentials?.callerIdName || 'Sales Agent',
        audio: true,
        video: false,
      });

      console.log('✅ Telnyx Call Created:', {
        id: call.id,
        state: call.state,
        direction: call.direction,
        destinationNumber: formattedTo,
        callerNumber: formattedFrom || this.credentials?.callerIdNumber
      });

      this.currentCall = call;
      this.currentCallId = call.id;
      
      // Note: Telnyx SDK doesn't support call.on() - state changes come via telnyx.notification

      return call;
    } catch (err) {
      console.error('❌ Telnyx call connection failed:', err);
      console.error('Error details:', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });
      this.emitStatus(CallState.WRAP_UP, { endReason: CallEndReason.FAILED });
      throw err;
    }
  }

  private handleCallUpdate(call: ICall) {
    const state = call.state;
    console.log('🔄 Telnyx handleCallUpdate - raw state:', state, 'call.id:', call.id);
    console.log('🔍 Call object details:', {
      id: call.id,
      state: call.state,
      direction: call.direction,
      remoteCallerNumber: (call as any).remoteCallerNumber,
      options: (call as any).options
    });

    // Update current call reference
    this.currentCall = call;
    this.currentCallId = call.id;
    
    // Store call control ID if available (for inbound calls)
    if ((call as any).options?.call_control_id) {
      this.callControlId = (call as any).options.call_control_id;
      console.log('📝 Stored callControlId:', this.callControlId);
    }

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
        // Try to attach remote stream for early media (ringback from Telnyx)
        this.tryAttachRemoteStream(call);
        // Note: Not playing local ringback - Telnyx provides early media
        break;
      case 'active':
        console.log('Telnyx: Emitting CONNECTED for state:', state);
        // Stop ringback tone when call is answered
        this.stopRingbackTone();
        if (!this.callStartTime) {
          this.callStartTime = new Date();
        }
        this.emitStatus(CallState.CONNECTED);
        // Ensure remote stream is attached when call is active
        this.tryAttachRemoteStream(call);
        break;
      case 'hangup':
      case 'destroy':
      case 'purge':
        console.log('🔴 Telnyx: Call ended with state:', state);
        // Stop ringback tone if still playing
        this.stopRingbackTone();
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
   * Try to attach the remote audio stream from the call
   * According to Telnyx SDK docs, call.remoteStream provides the remote MediaStream
   */
  private tryAttachRemoteStream(call: ICall) {
    try {
      const audioEl = document.getElementById('telnyx-remote-audio') as HTMLAudioElement;
      if (!audioEl) {
        console.warn('🔊 Audio element not found');
        return;
      }

      // First try: Use the SDK's remoteStream accessor (documented API)
      const remoteStream = (call as any).remoteStream;
      if (remoteStream && remoteStream instanceof MediaStream) {
        console.log('🔊 Attaching call.remoteStream (SDK accessor)');
        audioEl.srcObject = remoteStream;
        audioEl.play().catch(e => console.warn('Audio autoplay blocked:', e));
        
        // Log track info
        remoteStream.getTracks().forEach((track: MediaStreamTrack, i: number) => {
          console.log(`🔊 Track ${i}: kind=${track.kind}, enabled=${track.enabled}, muted=${track.muted}, readyState=${track.readyState}`);
        });
        return;
      }

      // Fallback: Check if call has a peer connection with remote stream
      const peer = (call as any).peer;
      if (peer && peer.remoteStream) {
        console.log('🔊 Attaching remote stream from call.peer.remoteStream');
        audioEl.srcObject = peer.remoteStream;
        audioEl.play().catch(e => console.warn('Audio play failed:', e));
        return;
      }

      // Final fallback: Try to get stream from RTCPeerConnection receivers
      if (peer && peer.instance) {
        const receivers = peer.instance.getReceivers();
        console.log('🔊 RTCPeerConnection receivers:', receivers.length);
        
        const audioReceivers = receivers.filter((r: RTCRtpReceiver) => r.track?.kind === 'audio');
        if (audioReceivers.length > 0) {
          const stream = new MediaStream(audioReceivers.map((r: RTCRtpReceiver) => r.track));
          console.log('🔊 Created stream from audio receivers, tracks:', stream.getTracks().length);
          audioEl.srcObject = stream;
          audioEl.play().catch(e => console.warn('Audio play failed:', e));
          
          // Log track info
          stream.getTracks().forEach((track, i) => {
            console.log(`🔊 Track ${i}: enabled=${track.enabled}, muted=${track.muted}, readyState=${track.readyState}`);
          });
        } else {
          console.log('🔊 No audio receivers found yet');
        }
      } else {
        console.log('🔊 No peer connection available yet');
      }
    } catch (e) {
      console.error('Error attaching remote stream:', e);
    }
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
  private isMuted: boolean = false;
  
  mute(shouldMute: boolean) {
    if (this.currentCall) {
      if (shouldMute) {
        this.currentCall.muteAudio();
      } else {
        this.currentCall.unmuteAudio();
      }
      this.isMuted = shouldMute;
    }
  }

  /**
   * Toggle mute state
   */
  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.mute(this.isMuted);
    return this.isMuted;
  }

  /**
   * Hold/unhold the current call
   */
  private isHeld: boolean = false;

  hold(shouldHold: boolean) {
    if (this.currentCall) {
      if (shouldHold) {
        this.currentCall.hold();
      } else {
        this.currentCall.unhold();
      }
      this.isHeld = shouldHold;
    }
  }

  /**
   * Toggle hold state
   */
  toggleHold(): boolean {
    this.isHeld = !this.isHeld;
    this.hold(this.isHeld);
    return this.isHeld;
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
   * Answer an incoming call from Telnyx
   * Note: For WebRTC inbound calls, the client needs to listen for telnyx.notification events
   * with type 'callUpdate' and call.state 'ringing', then call answerIncomingCall
   */
  async answerIncomingCall(callControlId?: string): Promise<void> {
    console.log('📞 Attempting to accept inbound call:', callControlId || 'current call');
    
    // For Telnyx, we need to find the call object and answer it
    // The call should already exist in our client's call list
    if (this.currentCall) {
      // Check if callControlId matches (if provided)
      if (callControlId && this.callControlId && this.callControlId !== callControlId) {
        console.warn('⚠️ CallControlId mismatch:', { expected: callControlId, actual: this.callControlId });
      }
      
      console.log('✓ Found active call (state: ' + this.currentCall.state + '), answering...');
      try {
        await this.currentCall.answer();
        this.callStartTime = new Date();
        this.emitStatus(CallState.CONNECTED);
        console.log('✅ Inbound WebRTC call answered successfully');
      } catch (error) {
        console.error('❌ Failed to answer inbound call:', error);
        throw error;
      }
    } else {
      console.error('❌ No active call found for callControlId:', callControlId);
      throw new Error('No active call to answer. The WebRTC client may not have received the call yet.');
    }
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
