'use client';

import React from 'react';
import { CallHistoryEntry } from '@/hooks/useAgoraCall';
import { Avatar } from '@/components/ui/avatar';
import {
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  Video,
  VideoOff,
  Clock,
  Hash,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';

interface CallHistoryItemProps {
  entry: CallHistoryEntry;
  currentUserId: string;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s > 0 ? ` ${s}s` : ''}`.trim();
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return ts;
  }
}

const STATUS_CONFIG = {
  ended: {
    label: 'Call ended',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/25',
    iconBg: 'bg-emerald-500/15',
  },
  missed: {
    label: 'Missed call',
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/25',
    iconBg: 'bg-red-500/15',
  },
  declined: {
    label: 'Call declined',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/25',
    iconBg: 'bg-amber-500/15',
  },
  outgoing: {
    label: 'Unanswered',
    color: 'text-slate-400',
    bg: 'bg-slate-500/10 border-slate-500/25',
    iconBg: 'bg-slate-500/15',
  },
  incoming: {
    label: 'Incoming call',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/25',
    iconBg: 'bg-indigo-500/15',
  },
} as const;

export function CallHistoryItem({ entry }: CallHistoryItemProps) {
  const cfg = STATUS_CONFIG[entry.status];
  const isVideo = entry.callType === 'video';

  const CallIcon =
    entry.status === 'missed'
      ? PhoneMissed
      : entry.status === 'declined'
      ? PhoneOff
      : entry.status === 'ended'
      ? isVideo
        ? Video
        : Phone
      : isVideo
      ? VideoOff
      : PhoneIncoming;

  const DirectionIcon = entry.isOutgoing ? ArrowUpRight : ArrowDownLeft;

  const displayName = entry.isDirect
    ? entry.targetUser?.name || entry.targetUser?.email?.split('@')[0] || 'Unknown'
    : `#${entry.targetChannelName || 'channel'}`;

  const avatarFallback = entry.isDirect
    ? entry.targetUser?.name || entry.targetUser?.email || '?'
    : entry.targetChannelName || 'C';

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 mx-2 my-1 rounded-2xl border ${cfg.bg} backdrop-blur-sm transition-all animate-in fade-in slide-in-from-bottom-1 duration-300`}
    >
      {/* Call type icon container */}
      <div
        className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${cfg.iconBg}`}
      >
        <CallIcon className={`h-5 w-5 ${cfg.color}`} />
      </div>

      {/* User / Channel avatar */}
      {entry.isDirect && entry.targetUser ? (
        <Avatar
          src={entry.targetUser.avatarUrl}
          fallback={avatarFallback}
          size="sm"
          className="shrink-0"
        />
      ) : (
        <div className="shrink-0 h-8 w-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
          <Hash className="h-4 w-4 text-indigo-400" />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {/* Direction arrow */}
          <DirectionIcon
            className={`h-3 w-3 shrink-0 ${entry.isOutgoing ? 'text-indigo-400' : 'text-emerald-400'}`}
          />
          <span className="text-xs font-bold text-foreground truncate">{displayName}</span>
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} shrink-0`}
          >
            {isVideo ? '📹 Video' : '🎙️ Voice'}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className={`font-semibold ${cfg.color}`}>{cfg.label}</span>
          {entry.durationSeconds != null && entry.durationSeconds > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(entry.durationSeconds)}
            </span>
          )}
        </div>
      </div>

      {/* Timestamp */}
      <span className="text-[10px] text-muted-foreground shrink-0 font-mono tabular-nums">
        {formatTimestamp(entry.timestamp)}
      </span>
    </div>
  );
}
