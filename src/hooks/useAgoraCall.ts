'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  IMicrophoneAudioTrack,
  ICameraVideoTrack,
  ILocalVideoTrack,
} from 'agora-rtc-sdk-ng';
import { api } from '@/lib/api';
import { socketClient } from '@/lib/socket';
import { User, Channel } from '@/types/chat';

export type CallType = 'voice' | 'video';
export type CallStatus = 'idle' | 'outgoing' | 'incoming' | 'connected' | 'ended';

export type CallHistoryStatus = 'outgoing' | 'incoming' | 'missed' | 'declined' | 'ended';

export interface CallHistoryEntry {
  id: string;
  callId: string;
  callType: CallType;
  isDirect: boolean;
  status: CallHistoryStatus;
  /** The other participant's info (null for channel calls) */
  targetUser?: { id: string; name?: string | null; email?: string; avatarUrl?: string | null };
  targetChannelName?: string;
  /** Timestamp when the call event occurred */
  timestamp: string;
  /** Duration in seconds (only set when status = 'ended') */
  durationSeconds?: number;
  /** Whether the current user was the caller */
  isOutgoing: boolean;
}

export interface ActiveCallInfo {
  callId: string;
  channelName: string;
  callType: CallType;
  isDirect: boolean;
  targetUser?: User | { id: string; name?: string; email?: string; avatarUrl?: string };
  targetChannel?: Channel;
  isIncoming?: boolean;
}

// Sound tone synthesizer using standard browser Web Audio API
class CallSoundSynthesizer {
  private ctx: AudioContext | null = null;
  private ringInterval: any = null;

  private initCtx() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => { });
    }
    return this.ctx;
  }

  // Play incoming ringtone (melodic dual-tone ring sequence)
  public startIncomingRingtone() {
    this.stop();
    const ctx = this.initCtx();
    if (!ctx) return;

    const playChime = () => {
      try {
        if (!this.ctx || this.ctx.state === 'closed') return;
        const now = this.ctx.currentTime;

        // Tone 1 (High bell)
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, now); // C5
        osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.3); // E5
        gain1.gain.setValueAtTime(0.18, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        osc1.connect(gain1);
        gain1.connect(this.ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.85);

        // Tone 2 (Soft echo)
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(783.99, now + 0.35); // G5
        gain2.gain.setValueAtTime(0.15, now + 0.35);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        osc2.connect(gain2);
        gain2.connect(this.ctx.destination);
        osc2.start(now + 0.35);
        osc2.stop(now + 1.25);
      } catch (e) {
        // Audio error ignore
      }
    };

    playChime();
    this.ringInterval = setInterval(playChime, 2500);
  }

  // Play outgoing ringback tone (standard phone line cadence)
  public startOutgoingRingtone() {
    this.stop();
    const ctx = this.initCtx();
    if (!ctx) return;

    const playBeep = () => {
      try {
        if (!this.ctx || this.ctx.state === 'closed') return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now); // Standard 440Hz dial tone
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.setValueAtTime(0.08, now + 1.0);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 1.25);
      } catch (e) { }
    };

    playBeep();
    this.ringInterval = setInterval(playBeep, 3000);
  }

  // Play end-call double beep
  public playEndBeep() {
    this.stop();
    const ctx = this.initCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    } catch (e) { }
  }

  public stop() {
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
  }
}

const soundSynth = new CallSoundSynthesizer();

export function useAgoraCall(currentUser: User | null) {
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [activeCall, setActiveCall] = useState<ActiveCallInfo | null>(null);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(false);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [networkQuality, setNetworkQuality] = useState<'excellent' | 'good' | 'poor'>('good');
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);

  // Track current call's start time for duration calculation
  const callStartTimeRef = useRef<number | null>(null);

  /** Append a new entry to call history AND persist it to the backend */
  const addCallHistoryEntry = useCallback((entry: CallHistoryEntry) => {
    setCallHistory((prev) => [...prev, entry]);
    // Map 'incoming' (frontend-only transient state) to 'missed' before persisting
    const backendStatus = entry.status === 'incoming' ? 'missed' : entry.status;
    // Fire-and-forget persist to backend (non-blocking)
    api.saveCallHistory({
      callId: entry.callId,
      callType: entry.callType,
      status: backendStatus,
      isDirect: entry.isDirect,
      recipientId: entry.isDirect ? entry.targetUser?.id : undefined,
      channelName: !entry.isDirect ? entry.targetChannelName : undefined,
      durationSeconds: entry.durationSeconds,
    }).catch(() => { /* silently ignore backend errors */ });
  }, []);

  // Agora Client and Tracks refs
  const agoraClientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const screenTrackRef = useRef<ILocalVideoTrack | null>(null);
  const timerRef = useRef<any>(null);
  const agoraSdkRef = useRef<any>(null);

  // Load Agora SDK dynamically on client
  useEffect(() => {
    if (typeof window === 'undefined') return;
    import('agora-rtc-sdk-ng').then((module) => {
      agoraSdkRef.current = module.default || module;
      // Set Agora SDK log level to warning to avoid console noise
      if (agoraSdkRef.current?.setLogLevel) {
        agoraSdkRef.current.setLogLevel(2);
      }
    });
  }, []);

  // Timer for active call duration
  useEffect(() => {
    if (callStatus === 'connected') {
      setCallDuration(0);
      callStartTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (callStatus === 'idle') {
        setCallDuration(0);
        callStartTimeRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  // Clean up Agora tracks and client
  const cleanupAgora = useCallback(async () => {
    soundSynth.stop();

    if (localAudioTrackRef.current) {
      try {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current.close();
      } catch (e) { }
      localAudioTrackRef.current = null;
    }

    if (localVideoTrackRef.current) {
      try {
        localVideoTrackRef.current.stop();
        localVideoTrackRef.current.close();
      } catch (e) { }
      localVideoTrackRef.current = null;
    }

    if (screenTrackRef.current) {
      try {
        screenTrackRef.current.stop();
        screenTrackRef.current.close();
      } catch (e) { }
      screenTrackRef.current = null;
    }

    if (agoraClientRef.current) {
      try {
        await agoraClientRef.current.leave();
      } catch (e) { }
      agoraClientRef.current = null;
    }

    setRemoteUsers([]);
    setIsAudioMuted(false);
    setIsVideoMuted(false);
    setIsScreenSharing(false);
  }, []);

  // Join Agora Channel
  const joinAgoraChannel = useCallback(
    async (channelName: string, callType: CallType) => {
      if (!agoraSdkRef.current) {
        const mod = await import('agora-rtc-sdk-ng');
        agoraSdkRef.current = mod.default || mod;
      }
      const AgoraRTC = agoraSdkRef.current;

      try {
        // 1. Fetch Agora token and App ID from backend
        const tokenData = await api.getAgoraToken(channelName, 'publisher');
        const appId = tokenData.appId || process.env.NEXT_PUBLIC_AGORA_APP_ID || '';
        const token = tokenData.token; // Can be string or null for App ID only mode

        if (!appId) {
          throw new Error('Agora App ID is not configured. Please check your environment variables.');
        }

        // 2. Initialize Agora RTC client
        const client: IAgoraRTCClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        agoraClientRef.current = client;

        // Set up event listeners for remote users
        client.on('user-published', async (user, mediaType) => {
          await client.subscribe(user, mediaType);

          if (mediaType === 'audio') {
            // Wrap in async try/catch to handle browser autoplay policy
            // (NotAllowedError) and play/pause race conditions gracefully.
            (async () => {
              try {
                await user.audioTrack?.play();
              } catch (e: any) {
                // Autoplay was blocked or interrupted — not a fatal error.
                // The track will resume once the user interacts with the page.
                console.warn('Remote audio autoplay blocked:', e?.message ?? e);
              }
            })();
          }

          setRemoteUsers((prev) => {
            const exists = prev.some((u) => u.uid === user.uid);
            if (exists) {
              return prev.map((u) => (u.uid === user.uid ? user : u));
            }
            return [...prev, user];
          });
        });

        client.on('user-unpublished', (user, mediaType) => {
          if (mediaType === 'audio') {
            user.audioTrack?.stop();
          }
          setRemoteUsers((prev) => prev.map((u) => (u.uid === user.uid ? user : u)));
        });

        client.on('user-left', (user) => {
          setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
        });

        client.on('network-quality', (stats) => {
          if (stats.downlinkNetworkQuality <= 2) {
            setNetworkQuality('excellent');
          } else if (stats.downlinkNetworkQuality <= 4) {
            setNetworkQuality('good');
          } else {
            setNetworkQuality('poor');
          }
        });

        // 3. Join the Agora channel
        const uid = currentUser?.id || String(Math.floor(Math.random() * 100000));
        await client.join(appId, channelName, token, uid);

        // 4. Create and publish local tracks
        const tracksToPublish: any[] = [];

        // Audio track (Mic)
        try {
          const micTrack = await AgoraRTC.createMicrophoneAudioTrack({
            AEC: true, // Acoustic Echo Cancellation
            ANS: true, // Automatic Noise Suppression
            AGC: true, // Automatic Gain Control
          });
          localAudioTrackRef.current = micTrack;
          tracksToPublish.push(micTrack);
        } catch (audioErr) {
          console.warn('Microphone permission denied or device not found:', audioErr);
        }

        // Video track (Camera) if video call
        if (callType === 'video') {
          try {
            const camTrack = await AgoraRTC.createCameraVideoTrack({
              encoderConfig: '720p_2',
            });
            localVideoTrackRef.current = camTrack;
            tracksToPublish.push(camTrack);
          } catch (videoErr) {
            console.warn('Camera permission denied or device not found:', videoErr);
          }
        }

        if (tracksToPublish.length > 0) {
          await client.publish(tracksToPublish);
        }

        soundSynth.stop();
        setCallStatus('connected');
      } catch (err: any) {
        console.error('Failed to join Agora channel:', err);
        soundSynth.playEndBeep();
        cleanupAgora();
        setCallStatus('ended');
        setTimeout(() => setCallStatus('idle'), 2500);
        throw err;
      }
    },
    [currentUser, cleanupAgora],
  );

  // Listen to incoming WebSocket call events
  useEffect(() => {
    if (!currentUser) return;

    // Incoming Call from another user
    const unsubIncoming = socketClient.on('call_incoming', (data) => {
      if (callStatus !== 'idle') {
        // Already in a call, reject as busy
        socketClient.rejectCall(data.callerId, data.callId, 'busy');
        return;
      }

      setActiveCall({
        callId: data.callId,
        channelName: data.channelName,
        callType: data.callType,
        isDirect: true,
        targetUser: {
          id: data.callerId,
          name: data.callerName,
          email: data.callerEmail,
        },
        isIncoming: true,
      });

      setCallStatus('incoming');
      soundSynth.startIncomingRingtone();
    });

    // Caller receives acceptance from recipient
    const unsubAccepted = socketClient.on('call_accepted', async (data) => {
      soundSynth.stop();
      if (activeCall && data.callId === activeCall.callId) {
        try {
          await joinAgoraChannel(data.channelName, activeCall.callType);
        } catch (err) {
          console.error('Could not connect call after accept:', err);
        }
      }
    });

    // Call was rejected by recipient
    const unsubRejected = socketClient.on('call_rejected', (data) => {
      soundSynth.playEndBeep();
      // Record declined call in history
      setActiveCall((currentCall) => {
        if (currentCall) {
          addCallHistoryEntry({
            id: `hist_${Date.now()}`,
            callId: currentCall.callId,
            callType: currentCall.callType,
            isDirect: currentCall.isDirect,
            status: 'declined',
            targetUser: currentCall.targetUser
              ? {
                  id: currentCall.targetUser.id,
                  name: currentCall.targetUser.name,
                  email: currentCall.targetUser.email,
                  avatarUrl: currentCall.targetUser.avatarUrl,
                }
              : undefined,
            targetChannelName: currentCall.targetChannel?.name,
            timestamp: new Date().toISOString(),
            isOutgoing: !currentCall.isIncoming,
          });
        }
        return currentCall;
      });
      setCallStatus('ended');
      cleanupAgora();
      setTimeout(() => {
        setCallStatus('idle');
        setActiveCall(null);
      }, 2500);
    });

    // Call was ended by either party
    const unsubEnded = socketClient.on('call_ended', () => {
      soundSynth.playEndBeep();
      // Record ended call in history
      const durationSecs = callStartTimeRef.current
        ? Math.round((Date.now() - callStartTimeRef.current) / 1000)
        : undefined;
      setActiveCall((currentCall) => {
        if (currentCall) {
          addCallHistoryEntry({
            id: `hist_${Date.now()}`,
            callId: currentCall.callId,
            callType: currentCall.callType,
            isDirect: currentCall.isDirect,
            status: 'ended',
            targetUser: currentCall.targetUser
              ? {
                  id: currentCall.targetUser.id,
                  name: currentCall.targetUser.name,
                  email: currentCall.targetUser.email,
                  avatarUrl: currentCall.targetUser.avatarUrl,
                }
              : undefined,
            targetChannelName: currentCall.targetChannel?.name,
            timestamp: new Date().toISOString(),
            durationSeconds: durationSecs,
            isOutgoing: !currentCall.isIncoming,
          });
        }
        return currentCall;
      });
      setCallStatus('ended');
      cleanupAgora();
      setTimeout(() => {
        setCallStatus('idle');
        setActiveCall(null);
      }, 1500);
    });

    return () => {
      unsubIncoming();
      unsubAccepted();
      unsubRejected();
      unsubEnded();
    };
  }, [currentUser, callStatus, activeCall, joinAgoraChannel, cleanupAgora]);

  // Start 1-on-1 direct call to another user
  const startDirectCall = useCallback(
    (targetUser: User, type: CallType) => {
      if (!currentUser) return;

      const sortedIds = [currentUser.id, targetUser.id].sort();
      const channelName = `dm_${sortedIds[0].slice(0, 8)}_${sortedIds[1].slice(0, 8)}_${Date.now()}`;
      const callId = `call_${Date.now()}`;

      const callInfo: ActiveCallInfo = {
        callId,
        channelName,
        callType: type,
        isDirect: true,
        targetUser,
        isIncoming: false,
      };

      setActiveCall(callInfo);
      setCallStatus('outgoing');
      soundSynth.startOutgoingRingtone();

      socketClient.startCall(targetUser.id, channelName, type, callId);
    },
    [currentUser],
  );

  // Start or join a group call in a Channel room
  const startChannelCall = useCallback(
    async (channel: Channel, type: CallType) => {
      if (!currentUser) return;

      const channelName = `channel_${channel.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 30)}`;
      const callId = `call_chan_${Date.now()}`;

      const callInfo: ActiveCallInfo = {
        callId,
        channelName,
        callType: type,
        isDirect: false,
        targetChannel: channel,
        isIncoming: false,
      };

      setActiveCall(callInfo);
      setCallStatus('outgoing');

      try {
        await joinAgoraChannel(channelName, type);
        socketClient.joinChannelCall(channel.id, channelName, type);
      } catch (err) {
        console.error('Failed to start channel call:', err);
      }
    },
    [currentUser, joinAgoraChannel],
  );

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!activeCall) return;

    soundSynth.stop();
    setCallStatus('outgoing');

    try {
      if (activeCall.targetUser?.id) {
        socketClient.acceptCall(
          activeCall.targetUser.id,
          activeCall.channelName,
          activeCall.callId,
        );
      }
      await joinAgoraChannel(activeCall.channelName, activeCall.callType);
    } catch (err) {
      console.error('Failed to accept call:', err);
    }
  }, [activeCall, joinAgoraChannel]);

  // Reject incoming call
  const rejectCall = useCallback(
    (reason = 'declined') => {
      if (!activeCall) return;
      soundSynth.stop();

      if (activeCall.targetUser?.id) {
        socketClient.rejectCall(activeCall.targetUser.id, activeCall.callId, reason);
      }

      // Record missed/declined incoming call in history
      addCallHistoryEntry({
        id: `hist_${Date.now()}`,
        callId: activeCall.callId,
        callType: activeCall.callType,
        isDirect: activeCall.isDirect,
        status: activeCall.isIncoming ? 'missed' : 'declined',
        targetUser: activeCall.targetUser
          ? {
              id: activeCall.targetUser.id,
              name: activeCall.targetUser.name,
              email: activeCall.targetUser.email,
              avatarUrl: activeCall.targetUser.avatarUrl,
            }
          : undefined,
        targetChannelName: activeCall.targetChannel?.name,
        timestamp: new Date().toISOString(),
        isOutgoing: !activeCall.isIncoming,
      });

      setCallStatus('idle');
      setActiveCall(null);
    },
    [activeCall, addCallHistoryEntry],
  );

  // End current active or outgoing call
  const endCall = useCallback(() => {
    soundSynth.playEndBeep();

    if (activeCall) {
      const durationSecs = callStartTimeRef.current
        ? Math.round((Date.now() - callStartTimeRef.current) / 1000)
        : undefined;

      // Record in call history
      addCallHistoryEntry({
        id: `hist_${Date.now()}`,
        callId: activeCall.callId,
        callType: activeCall.callType,
        isDirect: activeCall.isDirect,
        // If we called out and no one answered (outgoing, no connection), mark as outgoing
        status: callStartTimeRef.current ? 'ended' : 'outgoing',
        targetUser: activeCall.targetUser
          ? {
              id: activeCall.targetUser.id,
              name: activeCall.targetUser.name,
              email: activeCall.targetUser.email,
              avatarUrl: activeCall.targetUser.avatarUrl,
            }
          : undefined,
        targetChannelName: activeCall.targetChannel?.name,
        timestamp: new Date().toISOString(),
        durationSeconds: durationSecs,
        isOutgoing: !activeCall.isIncoming,
      });

      if (activeCall.isDirect && activeCall.targetUser?.id) {
        socketClient.endCall({
          recipientId: activeCall.targetUser.id,
          callId: activeCall.callId,
          channelName: activeCall.channelName,
        });
      } else if (activeCall.targetChannel?.id) {
        socketClient.endCall({
          channelId: activeCall.targetChannel.id,
          callId: activeCall.callId,
          channelName: activeCall.channelName,
        });
        socketClient.leaveChannelCall(
          activeCall.targetChannel.id,
          activeCall.channelName,
        );
      }
    }

    cleanupAgora();
    setCallStatus('ended');
    setTimeout(() => {
      setCallStatus('idle');
      setActiveCall(null);
    }, 1200);
  }, [activeCall, cleanupAgora, addCallHistoryEntry]);

  // Toggle Microphone Mute
  const toggleAudio = useCallback(() => {
    if (localAudioTrackRef.current) {
      const nextState = !isAudioMuted;
      localAudioTrackRef.current.setEnabled(!nextState);
      setIsAudioMuted(nextState);
    }
  }, [isAudioMuted]);

  // Toggle Camera Video
  const toggleVideo = useCallback(async () => {
    if (!agoraClientRef.current) return;
    const AgoraRTC = agoraSdkRef.current;

    if (localVideoTrackRef.current) {
      const nextState = !isVideoMuted;
      localVideoTrackRef.current.setEnabled(!nextState);
      setIsVideoMuted(nextState);
    } else {
      // User started call in voice mode and now wants to turn camera on!
      try {
        const camTrack = await AgoraRTC.createCameraVideoTrack({
          encoderConfig: '720p_2',
        });
        localVideoTrackRef.current = camTrack;
        await agoraClientRef.current.publish([camTrack]);
        setIsVideoMuted(false);
        if (activeCall) {
          setActiveCall((prev) => (prev ? { ...prev, callType: 'video' } : null));
        }
      } catch (err) {
        console.warn('Could not activate camera track:', err);
      }
    }
  }, [isVideoMuted, activeCall]);

  // Toggle Screen Sharing
  const toggleScreenShare = useCallback(async () => {
    if (!agoraClientRef.current) return;
    const AgoraRTC = agoraSdkRef.current;

    if (isScreenSharing && screenTrackRef.current) {
      try {
        await agoraClientRef.current.unpublish([screenTrackRef.current]);
        screenTrackRef.current.stop();
        screenTrackRef.current.close();
        screenTrackRef.current = null;
        setIsScreenSharing(false);

        // Resume camera track if available
        if (localVideoTrackRef.current && !isVideoMuted) {
          await agoraClientRef.current.publish([localVideoTrackRef.current]);
        }
      } catch (err) {
        console.error('Error stopping screen share:', err);
      }
    } else {
      try {
        const screenTrack = await AgoraRTC.createScreenVideoTrack(
          { encoderConfig: '1080p_1' },
          'disable',
        );

        // If user clicks browser stop sharing button
        const activeScreenTrack = Array.isArray(screenTrack) ? screenTrack[0] : screenTrack;
        screenTrackRef.current = activeScreenTrack;

        activeScreenTrack.on('track-ended', () => {
          toggleScreenShare();
        });

        // If camera track was published, unpublish it temporarily
        if (localVideoTrackRef.current) {
          await agoraClientRef.current.unpublish([localVideoTrackRef.current]);
        }

        await agoraClientRef.current.publish([activeScreenTrack]);
        setIsScreenSharing(true);
      } catch (err) {
        console.warn('Screen sharing cancelled or failed:', err);
      }
    }
  }, [isScreenSharing, isVideoMuted]);

  return {
    callStatus,
    activeCall,
    callDuration,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    networkQuality,
    remoteUsers,
    localAudioTrack: localAudioTrackRef.current,
    localVideoTrack: localVideoTrackRef.current,
    screenTrack: screenTrackRef.current,
    callHistory,
    startDirectCall,
    startChannelCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
  };
}
