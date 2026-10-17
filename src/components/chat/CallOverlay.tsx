'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { IAgoraRTCRemoteUser, ICameraVideoTrack, ILocalVideoTrack } from 'agora-rtc-sdk-ng';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  ScreenShare,
  Maximize2,
  Minimize2,
  Wifi,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ActiveCallInfo, CallStatus } from '@/hooks/useAgoraCall';

interface CallOverlayProps {
  callStatus: CallStatus;
  activeCall: ActiveCallInfo | null;
  callDuration: number;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  networkQuality: 'excellent' | 'good' | 'poor';
  remoteUsers: IAgoraRTCRemoteUser[];
  localVideoTrack: ICameraVideoTrack | null;
  screenTrack: ILocalVideoTrack | null;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
}

// Format duration in seconds to MM:SS
function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function CallOverlay({
  callStatus,
  activeCall,
  callDuration,
  isAudioMuted,
  isVideoMuted,
  isScreenSharing,
  networkQuality,
  remoteUsers,
  localVideoTrack,
  screenTrack,
  onAccept,
  onReject,
  onEnd,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
}: CallOverlayProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRefs = useRef<Map<string | number, HTMLDivElement>>(new Map());

  // Bind local video track to DOM container
  useEffect(() => {
    if (localVideoRef.current) {
      if (isScreenSharing && screenTrack) {
        screenTrack.play(localVideoRef.current);
      } else if (localVideoTrack && !isVideoMuted) {
        localVideoTrack.play(localVideoRef.current);
      }
    }
  }, [localVideoTrack, screenTrack, isScreenSharing, isVideoMuted, callStatus]);

  // Bind remote video tracks to their DOM containers
  useEffect(() => {
    remoteUsers.forEach((user) => {
      const container = remoteVideoRefs.current.get(user.uid);
      if (container && user.videoTrack) {
        user.videoTrack.play(container);
      }
    });
  }, [remoteUsers, callStatus]);

  if (callStatus === 'idle') return null;

  const targetName =
    activeCall?.targetUser?.name ||
    activeCall?.targetUser?.email?.split('@')[0] ||
    activeCall?.targetChannel?.name ||
    'User';

  const avatarFallback = targetName.slice(0, 2).toUpperCase();
  const avatarUrl = (activeCall?.targetUser as any)?.avatarUrl;

  // 1. INCOMING CALL MODAL
  if (callStatus === 'incoming') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-300">
        <div className="relative w-full max-w-sm rounded-3xl bg-card/95 border border-primary/20 p-8 shadow-2xl flex flex-col items-center text-center overflow-hidden">
          {/* Glowing Ambient Background */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

          {/* Animated Pulsing Ring Avatar */}
          <div className="relative mb-6">
            <span className="absolute -inset-3 rounded-full bg-emerald-500/20 animate-ping opacity-75" />
            <span className="absolute -inset-6 rounded-full bg-emerald-500/10 animate-pulse" />
            <Avatar
              src={avatarUrl}
              fallback={avatarFallback}
              className="h-28 w-28 text-2xl font-bold ring-4 ring-emerald-500/50 shadow-xl"
            />
            <div className="absolute bottom-0 right-0 p-2 rounded-full bg-emerald-500 text-white shadow-lg">
              {activeCall?.callType === 'video' ? (
                <Video className="h-4 w-4" />
              ) : (
                <Phone className="h-4 w-4" />
              )}
            </div>
          </div>

          <h3 className="text-xl font-bold text-foreground mb-1">{targetName}</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Incoming Agora {activeCall?.callType === 'video' ? 'HD Video Call' : 'Voice Call'}...
          </p>

          <div className="flex items-center gap-6 w-full justify-center">
            {/* Decline Button */}
            <button
              onClick={onReject}
              className="flex flex-col items-center gap-1.5 group cursor-pointer"
            >
              <div className="h-14 w-14 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-500 flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-all shadow-lg active:scale-95">
                <PhoneOff className="h-6 w-6" />
              </div>
              <span className="text-xs font-medium text-muted-foreground group-hover:text-rose-400">
                Decline
              </span>
            </button>

            {/* Accept Button */}
            <button
              onClick={onAccept}
              className="flex flex-col items-center gap-1.5 group cursor-pointer"
            >
              <div className="h-14 w-14 rounded-full bg-emerald-500 text-white flex items-center justify-center group-hover:bg-emerald-400 group-hover:scale-105 transition-all shadow-lg shadow-emerald-500/30 active:scale-95 animate-bounce">
                <Phone className="h-6 w-6" />
              </div>
              <span className="text-xs font-medium text-emerald-400 group-hover:text-emerald-300">
                Accept
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. OUTGOING CALL SCREEN
  if (callStatus === 'outgoing') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-300">
        <div className="relative w-full max-w-sm rounded-3xl bg-card/95 border border-border/80 p-8 shadow-2xl flex flex-col items-center text-center overflow-hidden">
          <div className="relative mb-6">
            <span className="absolute -inset-4 rounded-full bg-primary/20 animate-ping opacity-60" />
            <Avatar
              src={avatarUrl}
              fallback={avatarFallback}
              className="h-28 w-28 text-2xl font-bold ring-4 ring-primary/40 shadow-xl"
            />
          </div>

          <h3 className="text-xl font-bold text-foreground mb-1">{targetName}</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            Calling via Agora RTC ({activeCall?.callType === 'video' ? 'HD Video' : 'Voice'})...
          </p>

          <button
            onClick={onEnd}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-medium text-sm transition-all shadow-lg shadow-rose-500/25 active:scale-95 cursor-pointer"
          >
            <PhoneOff className="h-4 w-4" />
            Cancel Call
          </button>
        </div>
      </div>
    );
  }

  // 3. CALL ENDED SCREEN
  if (callStatus === 'ended') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-xs rounded-2xl bg-card border border-border/80 p-6 text-center shadow-xl">
          <div className="h-12 w-12 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto mb-3">
            <PhoneOff className="h-6 w-6" />
          </div>
          <h4 className="font-semibold text-sm text-foreground">Call Ended</h4>
          <p className="text-xs text-muted-foreground mt-1">Duration: {formatDuration(callDuration)}</p>
        </div>
      </div>
    );
  }

  // 4. ACTIVE CONNECTED CALL VIEW (Fullscreen or Minimized Floating Widget)
  const isVideo = activeCall?.callType === 'video' || isScreenSharing;

  // Minimized Widget mode (allows using chat while call continues in corner)
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 w-72 rounded-2xl bg-card/95 border border-border shadow-2xl p-3 backdrop-blur-xl animate-in slide-in-from-bottom-5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 truncate">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium text-xs text-foreground truncate">{targetName}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{formatDuration(callDuration)}</span>
          </div>
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Expand Call"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Small Video Preview if in video mode */}
        {isVideo && (
          <div className="relative h-28 w-full rounded-xl bg-black overflow-hidden mb-2">
            <div ref={localVideoRef} className="h-full w-full object-cover" />
          </div>
        )}

        {/* Minimized Controls */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={onToggleAudio}
            className={`p-2 rounded-full text-xs transition-colors cursor-pointer ${
              isAudioMuted ? 'bg-rose-500/20 text-rose-500' : 'bg-muted hover:bg-accent text-foreground'
            }`}
          >
            {isAudioMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onToggleVideo}
            className={`p-2 rounded-full text-xs transition-colors cursor-pointer ${
              isVideoMuted ? 'bg-rose-500/20 text-rose-500' : 'bg-muted hover:bg-accent text-foreground'
            }`}
          >
            {isVideoMuted ? <VideoOff className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onEnd}
            className="p-2 rounded-full bg-rose-500 hover:bg-rose-600 text-white transition-colors cursor-pointer"
          >
            <PhoneOff className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Full Call Overlay
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-2xl text-white select-none animate-in fade-in duration-300">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <h3 className="font-semibold text-base text-white">{targetName}</h3>
          </div>
          <Badge variant="outline" className="text-[11px] font-mono border-white/20 text-white/80">
            {formatDuration(callDuration)}
          </Badge>
          <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] hidden sm:inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            Agora SD-RTN™ Encrypted
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          {/* Network Quality Indicator */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70"
            title={`Network Quality: ${networkQuality}`}
          >
            <Wifi className={`h-3.5 w-3.5 ${networkQuality === 'poor' ? 'text-amber-400' : 'text-emerald-400'}`} />
            <span className="capitalize text-[11px] hidden sm:inline">{networkQuality}</span>
          </div>

          {/* Minimize Button */}
          <button
            onClick={() => setIsMinimized(true)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Minimize call to corner"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Video / Audio Stream Stage */}
      <div className="flex-1 relative p-4 flex items-center justify-center overflow-hidden">
        {isVideo ? (
          /* VIDEO CALL STAGE */
          <div className="relative h-full w-full max-w-6xl mx-auto flex items-center justify-center rounded-3xl overflow-hidden bg-slate-900 border border-white/10 shadow-2xl">
            {/* Remote Streams Grid or Single Remote View */}
            {remoteUsers.length > 0 ? (
              <div
                className={`h-full w-full grid gap-2 p-2 ${
                  remoteUsers.length === 1
                    ? 'grid-cols-1'
                    : remoteUsers.length <= 4
                    ? 'grid-cols-2'
                    : 'grid-cols-3'
                }`}
              >
                {remoteUsers.map((user) => (
                  <div
                    key={user.uid}
                    className="relative h-full w-full rounded-2xl bg-black overflow-hidden flex items-center justify-center border border-white/10"
                  >
                    <div
                      ref={(el) => {
                        if (el) remoteVideoRefs.current.set(user.uid, el);
                        else remoteVideoRefs.current.delete(user.uid);
                      }}
                      className="h-full w-full object-cover"
                    />
                    {!user.hasVideo && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-white/70">
                        <Avatar
                          fallback={String(user.uid).slice(0, 2).toUpperCase()}
                          className="h-20 w-20 text-xl font-bold ring-2 ring-primary/40 mb-2"
                        />
                        <span className="text-xs text-muted-foreground">Camera off</span>
                      </div>
                    )}
                    <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[11px] font-medium text-white flex items-center gap-1.5 border border-white/10">
                      <span>{String(user.uid) === activeCall?.targetUser?.id ? targetName : `User ${user.uid}`}</span>
                      {!user.hasAudio && <MicOff className="h-3 w-3 text-rose-400" />}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Waiting for remote video stream */
              <div className="flex flex-col items-center justify-center text-center p-8 text-white/60">
                <Avatar
                  src={avatarUrl}
                  fallback={avatarFallback}
                  className="h-24 w-24 text-2xl font-bold ring-4 ring-primary/30 mb-4 shadow-xl"
                />
                <h4 className="text-lg font-semibold text-white mb-1">{targetName}</h4>
                <p className="text-xs text-white/50 animate-pulse">Connecting video stream via Agora...</p>
              </div>
            )}

            {/* Local Video Stream (Floating PiP in bottom-right) */}
            <div className="absolute bottom-5 right-5 h-36 w-48 sm:h-44 sm:w-60 rounded-2xl bg-black border-2 border-white/20 shadow-2xl overflow-hidden z-20 group">
              <div
                ref={localVideoRef}
                className="h-full w-full object-cover transform -scale-x-100" // Mirror local selfie camera
              />
              {isVideoMuted && !isScreenSharing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 text-white/60">
                  <VideoOff className="h-6 w-6 text-white/40 mb-1" />
                  <span className="text-[10px]">Your camera is off</span>
                </div>
              )}
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] text-white/90">
                You {isScreenSharing && '(Screen)'}
              </div>
            </div>
          </div>
        ) : (
          /* VOICE CALL STAGE */
          <div className="flex flex-col items-center justify-center text-center max-w-md w-full">
            {/* Animated Audio Spectrum Waves */}
            <div className="relative mb-8 flex items-center justify-center">
              <span className="absolute -inset-8 rounded-full bg-indigo-500/10 animate-ping opacity-50" />
              <span className="absolute -inset-4 rounded-full bg-purple-500/20 animate-pulse" />

              <Avatar
                src={avatarUrl}
                fallback={avatarFallback}
                className="h-32 w-32 text-3xl font-bold ring-4 ring-primary/40 shadow-2xl"
              />
            </div>

            <h3 className="text-2xl font-bold text-white mb-2">{targetName}</h3>
            <p className="text-xs text-white/60 mb-6 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              High Fidelity Agora Audio Call
            </p>

            {/* Sound Wave Visualization bars */}
            <div className="flex items-center gap-1.5 h-10 mb-4">
              {[40, 75, 55, 95, 30, 85, 60, 100, 45, 70, 85, 40].map((height, i) => (
                <span
                  key={i}
                  className="w-1.5 bg-gradient-to-t from-indigo-500 to-purple-400 rounded-full transition-all duration-300 animate-pulse"
                  style={{
                    height: isAudioMuted ? '6px' : `${height}%`,
                    animationDelay: `${i * 120}ms`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Floating Control Bar */}
      <div className="pb-8 pt-4 flex items-center justify-center shrink-0">
        <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-slate-900/90 border border-white/15 backdrop-blur-xl shadow-2xl">
          {/* Mute Microphone */}
          <button
            onClick={onToggleAudio}
            className={`p-3.5 rounded-full transition-all cursor-pointer ${
              isAudioMuted
                ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isAudioMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>

          {/* Toggle Camera Video */}
          <button
            onClick={onToggleVideo}
            className={`p-3.5 rounded-full transition-all cursor-pointer ${
              isVideoMuted
                ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title={isVideoMuted ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isVideoMuted ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </button>

          {/* Screen Share */}
          <button
            onClick={onToggleScreenShare}
            className={`p-3.5 rounded-full transition-all cursor-pointer hidden sm:flex ${
              isScreenSharing
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
          >
            <ScreenShare className="h-5 w-5" />
          </button>

          {/* End Call Button */}
          <button
            onClick={onEnd}
            className="p-3.5 px-6 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-medium flex items-center gap-2 transition-all shadow-lg shadow-rose-500/40 active:scale-95 cursor-pointer ml-2"
            title="End Call"
          >
            <PhoneOff className="h-5 w-5" />
            <span className="text-sm font-semibold hidden sm:inline">End</span>
          </button>
        </div>
      </div>
    </div>
  );
}
