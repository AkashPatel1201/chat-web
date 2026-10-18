'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Channel, DirectMessageConversation, Message, Reaction, User } from '@/types/chat';
import { api } from '@/lib/api';
import { useChatSocket } from '@/hooks/useChatSocket';
import { socketClient } from '@/lib/socket';
import { Sidebar } from './Sidebar';
import { MessageItem } from './MessageItem';
import { ChatInput } from './ChatInput';
import { SettingsModal } from './SettingsModal';
import { CallOverlay } from './CallOverlay';
import { CallHistoryItem } from './CallHistoryItem';
import { useAgoraCall } from '@/hooks/useAgoraCall';
import type { CallHistoryEntry } from '@/hooks/useAgoraCall';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Hash,
  Users,
  Search,
  Phone,
  Video,
  Pin,
  Info,
  Menu,
  X,
  Sparkles,
  Bot,
  Circle,
  Plus,
  MessageSquare,
  UserPlus,
  Loader2,
  RefreshCw,
  Lock,
} from 'lucide-react';

interface ChatViewProps {
  currentUser: User;
  onLogout: () => void;
}

export function ChatView({ currentUser, onLogout }: ChatViewProps) {
  // Dynamic State
  const [channels, setChannels] = useState<Channel[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessageConversation[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<User[]>([]);
  
  const [activeChannelId, setActiveChannelId] = useState<string>('');
  const [activeDmId, setActiveDmId] = useState<string | null>(null);
  const [activeDmUser, setActiveDmUser] = useState<User | null>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [channelDetails, setChannelDetails] = useState<Channel | null>(null);
  
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const [userProfile, setUserProfile] = useState<User>(currentUser);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewDmOpen, setIsNewDmOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [selectedUsersToAdd, setSelectedUsersToAdd] = useState<string[]>([]);
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isPollingRef = useRef(false);

  // Agora Voice & Video RTC Call Manager
  const {
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
    callHistory,
    startDirectCall,
    startChannelCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
  } = useAgoraCall(currentUser);

  // Persisted call history loaded from the backend database
  const [persistedCallHistory, setPersistedCallHistory] = useState<CallHistoryEntry[]>([]);

  // Build merged feed: regular messages + call history entries sorted by time
  type FeedItem =
    | { kind: 'message'; item: Message; sortKey: number }
    | { kind: 'call'; item: CallHistoryEntry; sortKey: number };

  const mergedFeed = React.useMemo<FeedItem[]>(() => {
    const msgItems: FeedItem[] = messages.map((m) => ({
      kind: 'message',
      item: m,
      sortKey: new Date(m.timestamp).getTime() || 0,
    }));

    // Combine and strictly deduplicate call history by callId (preferring records with duration)
    const callMap = new Map<string, CallHistoryEntry>();
    for (const c of [...persistedCallHistory, ...callHistory]) {
      const existing = callMap.get(c.callId);
      if (!existing) {
        callMap.set(c.callId, c);
      } else if (c.durationSeconds && !existing.durationSeconds) {
        callMap.set(c.callId, c);
      }
    }
    const allCallHistory = Array.from(callMap.values());

    // Filter to only entries relevant to the active conversation
    const relevantCalls = allCallHistory.filter((c) => {
      if (activeDmId && c.isDirect && c.targetUser) {
        return c.targetUser.id === activeDmId;
      }
      if (activeChannelId && !c.isDirect && c.targetChannelName) {
        const currentChan = channels.find((ch) => ch.id === activeChannelId);
        return currentChan?.name === c.targetChannelName;
      }
      return false;
    });

    const callItems: FeedItem[] = relevantCalls.map((c) => ({
      kind: 'call',
      item: c,
      sortKey: new Date(c.timestamp).getTime() || 0,
    }));

    return [...msgItems, ...callItems].sort((a, b) => a.sortKey - b.sortKey);
  }, [messages, callHistory, persistedCallHistory, activeDmId, activeChannelId, channels]);
  // Auto scroll to bottom
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom();
  }, [mergedFeed]);

  // 1. Load initial workspace data (channels, DMs, users) once on mount
  useEffect(() => {
    let isMounted = true;

    const initWorkspace = async () => {
      try {
        setIsLoadingInitial(true);
        const [fetchedChannels, fetchedDms, fetchedUsers] = await Promise.all([
          api.getChannels().catch(() => []),
          api.getDirectMessageConversations().catch(() => []),
          api.getUsers().catch(() => []),
        ]);

        if (!isMounted) return;

        setChannels(fetchedChannels);
        setDirectMessages(fetchedDms);
        setRegisteredUsers(fetchedUsers);

        // Select the first channel by default if none is active
        setActiveChannelId((prev) => (!prev ? (fetchedChannels[0]?.id || '') : prev));
      } catch (err) {
        console.error('Error loading initial workspace data:', err);
      } finally {
        if (isMounted) setIsLoadingInitial(false);
      }
    };

    initWorkspace();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch messages + call history when the selected Channel or DM changes
  const fetchMessagesForActive = useCallback(async (silent = false) => {
    if (!activeChannelId && !activeDmId) return;

    if (!silent) setIsLoadingMessages(true);
    try {
      if (activeDmId) {
        const [dmMessages, rawCallHistory] = await Promise.all([
          api.getDirectMessages(activeDmId),
          api.getDirectCallHistory(activeDmId),
        ]);
        setMessages(dmMessages);
        // Map backend records → CallHistoryEntry shape used by CallHistoryItem
        const mapped: CallHistoryEntry[] = rawCallHistory.map((r: any) => ({
          id: r.id,
          callId: r.callId,
          callType: r.callType as 'voice' | 'video',
          isDirect: r.isDirect,
          status: r.status as any,
          targetUser: r.callerId === currentUser.id
            ? (r.recipient
                ? { id: r.recipient.id, name: r.recipient.name, email: r.recipient.email, avatarUrl: r.recipient.avatarUrl }
                : (activeDmId ? { id: activeDmId, name: activeDmUser?.name || 'User' } : undefined))
            : (r.caller
                ? { id: r.caller.id, name: r.caller.name, email: r.caller.email, avatarUrl: r.caller.avatarUrl }
                : (activeDmId ? { id: activeDmId, name: activeDmUser?.name || 'User' } : undefined)),
          timestamp: r.createdAt,
          durationSeconds: r.durationSeconds ?? undefined,
          isOutgoing: r.callerId === currentUser.id,
        }));
        setPersistedCallHistory(mapped);
      } else if (activeChannelId) {
        const currentChan = channels.find((c) => c.id === activeChannelId);
        const [chanMessages, details, rawCallHistory] = await Promise.all([
          api.getChannelMessages(activeChannelId),
          api.getChannelDetails(activeChannelId).catch(() => null),
          currentChan ? api.getChannelCallHistory(currentChan.name) : Promise.resolve([]),
        ]);
        setMessages(chanMessages);
        if (details) {
          setChannelDetails(details);
        }
        const mapped: CallHistoryEntry[] = rawCallHistory.map((r: any) => ({
          id: r.id,
          callId: r.callId,
          callType: r.callType as 'voice' | 'video',
          isDirect: false,
          status: r.status as any,
          targetChannelName: r.channelName ?? currentChan?.name,
          timestamp: r.createdAt,
          durationSeconds: r.durationSeconds ?? undefined,
          isOutgoing: r.callerId === currentUser.id,
        }));
        setPersistedCallHistory(mapped);
      }
    } catch (err) {
      console.error('Failed to load conversation messages:', err);
    } finally {
      if (!silent) setIsLoadingMessages(false);
    }
  }, [activeChannelId, activeDmId, channels, currentUser.id]);


  useEffect(() => {
    fetchMessagesForActive(false);
  }, [fetchMessagesForActive]);

  // Sync activeDmUser when activeDmId or users list changes
  useEffect(() => {
    if (activeDmId) {
      const target =
        registeredUsers.find((u) => u.id === activeDmId) ||
        directMessages.find((d) => d.id === activeDmId)?.user ||
        null;
      if (target) setActiveDmUser(target);
    }
  }, [activeDmId, registeredUsers, directMessages]);

  // Handle channel selection
  const handleSelectChannel = (channelId: string) => {
    setActiveChannelId(channelId);
    setActiveDmId(null);
    setActiveDmUser(null);
    setMobileSidebarOpen(false);
  };

  // Handle DM selection
  const handleSelectDm = (dmUserId: string) => {
    setActiveDmId(dmUserId);
    const target =
      registeredUsers.find((u) => u.id === dmUserId) ||
      directMessages.find((d) => d.id === dmUserId)?.user ||
      null;
    setActiveDmUser(target);
    setActiveChannelId('');
    setMobileSidebarOpen(false);
    setDirectMessages((prev) =>
      prev.map((d) => (d.id === dmUserId ? { ...d, unreadCount: 0 } : d)),
    );
  };

  // Create Channel
  const handleCreateChannel = async (newChan: {
    name: string;
    description: string;
    isPrivate: boolean;
    memberIds?: string[];
  }) => {
    try {
      const created = await api.createChannel({
        name: newChan.name,
        description: newChan.description,
        isPrivate: newChan.isPrivate,
        memberIds: newChan.memberIds,
      });
      setChannels((prev) => [...prev, created]);
      setActiveChannelId(created.id);
      setActiveDmId(null);
      setActiveDmUser(null);
      api.getChannelDetails(created.id).then(setChannelDetails).catch(() => {});
    } catch (err: any) {
      alert(err.message || 'Failed to create channel');
    }
  };

  // Add Members to Active Channel
  const handleAddMembersSubmit = async () => {
    if (!activeChannelId || selectedUsersToAdd.length === 0) return;
    setIsAddingMembers(true);
    try {
      const updated = await api.addChannelMembers(activeChannelId, selectedUsersToAdd);
      setChannelDetails(updated);
      setChannels((prev) =>
        prev.map((c) => (c.id === activeChannelId ? { ...c, memberCount: updated.memberCount } : c)),
      );
      setIsAddMemberOpen(false);
      setSelectedUsersToAdd([]);
      setAddMemberSearch('');
    } catch (err: any) {
      alert(err.message || 'Failed to add members');
    } finally {
      setIsAddingMembers(false);
    }
  };

  // Remove Member from Active Channel
  const handleRemoveMember = async (memberId: string) => {
    if (!activeChannelId) return;
    const member = channelDetails?.members?.find((m) => m.id === memberId);
    const confirmName = member?.name || member?.email || 'this member';
    if (!confirm(`Are you sure you want to remove ${confirmName} from #${currentChannel?.name}?`)) return;

    try {
      await api.removeChannelMember(activeChannelId, memberId);
      setChannelDetails((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          memberCount: Math.max(1, (prev.members?.length || 1) - 1),
          members: prev.members?.filter((m) => m.id !== memberId),
        };
      });
      setChannels((prev) =>
        prev.map((c) =>
          c.id === activeChannelId ? { ...c, memberCount: Math.max(1, c.memberCount - 1) } : c,
        ),
      );
    } catch (err: any) {
      alert(err.message || 'Failed to remove member');
    }
  };

  // Real-time WebSocket integration
  const { isConnected, typingUsers, emitTyping, emitStopTyping } = useChatSocket({
    currentUser: userProfile,
    activeChannelId,
    activeDmId,
    onNewMessage: useCallback(
      (newMsg: Message) => {
        // If message belongs to active channel
        if (activeChannelId && newMsg.channelId === activeChannelId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(() => scrollToBottom('smooth'), 50);
        }
        // If message belongs to active direct message conversation
        else if (
          activeDmId &&
          newMsg.recipientId &&
          ((newMsg.senderId === activeDmId && newMsg.recipientId === userProfile.id) ||
            (newMsg.senderId === userProfile.id && newMsg.recipientId === activeDmId))
        ) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(() => scrollToBottom('smooth'), 50);
        }

        // Always update DM conversations list last message preview
        if (newMsg.recipientId) {
          const otherUserId =
            newMsg.senderId === userProfile.id ? newMsg.recipientId : newMsg.senderId;

          setDirectMessages((prev) => {
            const exists = prev.some((d) => d.id === otherUserId);
            if (exists) {
              return prev.map((d) =>
                d.id === otherUserId
                  ? {
                      ...d,
                      lastMessage: newMsg.content,
                      lastMessageTime: newMsg.timestamp,
                      unreadCount:
                        activeDmId === otherUserId ? 0 : (d.unreadCount ?? 0) + 1,
                    }
                  : d,
              );
            }
            return prev;
          });
        }
      },
      [activeChannelId, activeDmId, userProfile?.id],
    ),
    onReactionUpdate: useCallback(
      ({ messageId, reactions }: { messageId: string; reactions: Reaction[] }) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)),
        );
      },
      [],
    ),
    onMessageDelete: useCallback(
      ({ messageId }: { messageId: string }) => {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      },
      [],
    ),
    onUserStatusChange: useCallback(
      ({ userId, status }: { userId: string; status: 'online' | 'offline' }) => {
        setRegisteredUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, status } : u)),
        );
        setDirectMessages((prev) =>
          prev.map((dm) =>
            dm.user.id === userId ? { ...dm, user: { ...dm.user, status } } : dm,
          ),
        );
        if (activeDmUser && activeDmUser.id === userId) {
          setActiveDmUser((prev) => (prev ? { ...prev, status } : null));
        }
      },
      [activeDmUser],
    ),
    onChannelMemberAdded: useCallback(
      ({ channelId, channel }: { channelId: string; channel?: Channel }) => {
        if (channel) {
          setChannels((prev) =>
            prev.map((c) => (c.id === channelId ? { ...c, memberCount: channel.memberCount } : c)),
          );
        }
        if (activeChannelId === channelId) {
          if (channel) {
            setChannelDetails(channel);
          } else {
            api.getChannelDetails(channelId).then(setChannelDetails).catch(() => {});
          }
        }
      },
      [activeChannelId],
    ),
    onChannelMemberRemoved: useCallback(
      ({ channelId, userId }: { channelId: string; userId: string }) => {
        if (userId === currentUser.id) {
          setChannels((prev) => prev.filter((c) => c.id !== channelId));
          if (activeChannelId === channelId) {
            setActiveChannelId((prev) => channels.find((c) => c.id !== channelId)?.id || '');
          }
        } else {
          setChannels((prev) =>
            prev.map((c) =>
              c.id === channelId ? { ...c, memberCount: Math.max(1, c.memberCount - 1) } : c,
            ),
          );
          if (activeChannelId === channelId) {
            setChannelDetails((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                memberCount: Math.max(1, (prev.members?.length || 1) - 1),
                members: prev.members?.filter((m) => m.id !== userId),
              };
            });
          }
        }
      },
      [activeChannelId, channels, currentUser.id],
    ),
    onChannelJoined: useCallback(({ channel }: { channel: Channel }) => {
      setChannels((prev) => {
        if (prev.some((c) => c.id === channel.id)) return prev;
        return [...prev, channel];
      });
    }, []),
    onChannelLeft: useCallback(
      ({ channelId }: { channelId: string }) => {
        setChannels((prev) => prev.filter((c) => c.id !== channelId));
        if (activeChannelId === channelId) {
          setActiveChannelId((prev) => channels.find((c) => c.id !== channelId)?.id || '');
        }
      },
      [activeChannelId, channels],
    ),
  });

  // Send message
  const handleSendMessage = async (content: string, attachments?: any[]) => {
    if (!content.trim() && (!attachments || attachments.length === 0)) return;

    setIsSending(true);
    try {
      if (activeDmId) {
        const sent = await api.sendDirectMessage(activeDmId, content, attachments);
        setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));

        // Refresh DMs list to show new message at top
        api.getDirectMessageConversations().then(setDirectMessages).catch(() => {});
      } else if (activeChannelId) {
        const sent = await api.sendChannelMessage(activeChannelId, content, attachments);
        setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      }
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    } finally {
      setIsSending(false);
      setTimeout(() => scrollToBottom('smooth'), 100);
    }
  };

  // Reaction
  const handleReact = async (messageId: string, emoji: string) => {
    try {
      const updatedReactions = await api.toggleReaction(messageId, emoji);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions: updatedReactions } : m))
      );
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    try {
      await api.deleteMessage(messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete message');
    }
  };

  // Start DM from modal
  const handleStartDirectMessage = (targetUser: User) => {
    setActiveDmId(targetUser.id);
    setActiveDmUser(targetUser);
    setActiveChannelId('');
    setIsNewDmOpen(false);

    // If not in directMessages list, add it
    if (!directMessages.some((d) => d.id === targetUser.id)) {
      setDirectMessages((prev) => [
        {
          id: targetUser.id,
          user: targetUser,
          unreadCount: 0,
          lastMessage: 'Conversation started',
          lastMessageTime: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
  };

  const currentChannel = channels.find((c) => c.id === activeChannelId);

  const filteredUsers = registeredUsers.filter((u) => {
    if (u.id === userProfile.id) return false;
    const query = userSearchQuery.toLowerCase();
    const nameMatch = u.name ? u.name.toLowerCase().includes(query) : false;
    const emailMatch = u.email.toLowerCase().includes(query);
    return nameMatch || emailMatch;
  });

  const filteredUsersToAdd = registeredUsers.filter((u) => {
    if (u.id === userProfile.id) return false;
    if (!addMemberSearch.trim()) return true;
    const query = addMemberSearch.toLowerCase();
    const nameMatch = u.name ? u.name.toLowerCase().includes(query) : false;
    const emailMatch = u.email.toLowerCase().includes(query);
    return nameMatch || emailMatch;
  });

  if (isLoadingInitial) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 animate-pulse">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <p className="text-xs text-muted-foreground font-mono animate-pulse">
            Connecting to ChatFlow backend...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Main Left Sidebar */}
      <div
        className={`fixed md:relative z-50 h-full transition-transform duration-300 md:translate-x-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <Sidebar
          channels={channels}
          activeChannelId={activeChannelId}
          onSelectChannel={handleSelectChannel}
          directMessages={directMessages}
          activeDmId={activeDmId}
          onSelectDm={handleSelectDm}
          currentUser={userProfile}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onLogout={() => {
            socketClient.disconnect();
            onLogout();
          }}
          onCreateChannel={handleCreateChannel}
          onOpenNewDm={() => {
            setUserSearchQuery('');
            setIsNewDmOpen(true);
          }}
          registeredUsers={registeredUsers}
        />
      </div>

      {/* Central Chat Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-background/50">
        {/* Top Channel / DM Header Bar */}
        <header className="h-14 border-b border-border/70 px-4 flex items-center justify-between bg-card/70 backdrop-blur-xl shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile menu trigger */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Direct Message Header */}
            {activeDmId && activeDmUser ? (
              <div className="flex items-center gap-2.5 truncate">
                <Avatar
                  src={activeDmUser.avatarUrl}
                  fallback={activeDmUser.name || activeDmUser.email}
                  size="sm"
                  status={activeDmUser.status || 'online'}
                />
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground truncate">
                      {activeDmUser.name || activeDmUser.email}
                    </span>
                    <Badge variant="brand" className="text-[9px] py-0 font-mono">
                      {activeDmUser.role}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {activeDmUser.statusMessage || activeDmUser.email}
                  </p>
                </div>
              </div>
            ) : currentChannel ? (
              /* Channel Header */
              <div className="truncate">
                <div className="flex items-center gap-2">
                  {currentChannel.isPrivate ? (
                    <Lock className="h-4 w-4 text-amber-400 shrink-0" />
                  ) : (
                    <Hash className="h-4 w-4 text-indigo-400 shrink-0" />
                  )}
                  <span className="font-bold text-sm text-foreground truncate">
                    {currentChannel.name}
                  </span>
                  {currentChannel.isPrivate && (
                    <Badge variant="outline" className="text-[9px] py-0 font-medium text-amber-400 border-amber-500/30 bg-amber-500/10 hidden sm:inline-flex">
                      Private
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] py-0 text-muted-foreground hidden sm:inline-flex">
                    {channelDetails?.memberCount || currentChannel.memberCount || 1} members
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
                  {currentChannel.description || 'Channel conversation'}
                </p>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Select a channel or direct message</span>
            )}
          </div>

          {/* Header Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Real-time WebSocket connection status badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium transition-all ${
                isConnected
                  ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 shadow-sm'
                  : 'bg-amber-500/10 border border-amber-500/25 text-amber-400'
              }`}
              title={isConnected ? 'WebSocket real-time streaming connected' : 'Connecting to WebSocket...'}
            >
              <span className="relative flex h-2 w-2">
                {isConnected && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                  }`}
                ></span>
              </span>
              <span className="hidden sm:inline font-semibold">
                {isConnected ? 'Realtime Live' : 'Connecting'}
              </span>
            </div>

            <button
              onClick={() => fetchMessagesForActive(false)}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Refresh Messages"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            {currentChannel && (
              <button
                onClick={() => {
                  setSelectedUsersToAdd([]);
                  setAddMemberSearch('');
                  setIsAddMemberOpen(true);
                }}
                className="p-2 rounded-xl text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                title={`Add Members to #${currentChannel.name}`}
              >
                <UserPlus className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => {
                if (activeDmId && activeDmUser) {
                  startDirectCall(activeDmUser, 'voice');
                } else if (currentChannel) {
                  startChannelCall(currentChannel, 'voice');
                }
              }}
              className="p-2 rounded-xl text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
              title={
                activeDmUser
                  ? `Voice Call ${activeDmUser.name || activeDmUser.email}`
                  : `Start Voice Call in #${currentChannel?.name || 'chat'}`
              }
            >
              <Phone className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                if (activeDmId && activeDmUser) {
                  startDirectCall(activeDmUser, 'video');
                } else if (currentChannel) {
                  startChannelCall(currentChannel, 'video');
                }
              }}
              className="p-2 rounded-xl text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
              title={
                activeDmUser
                  ? `HD Video Call ${activeDmUser.name || activeDmUser.email}`
                  : `Start Video Call in #${currentChannel?.name || 'chat'}`
              }
            >
              <Video className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowRightSidebar(!showRightSidebar)}
              className={`p-2 rounded-xl transition-colors ${
                showRightSidebar
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
              title="Details & Members"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Welcome Banner */}
          <div className="py-6 px-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent border border-border/60 mb-4">
            <div className="flex items-center gap-2 mb-1">
              {currentChannel?.isPrivate ? (
                <Lock className="h-5 w-5 text-amber-400" />
              ) : (
                <Sparkles className="h-5 w-5 text-indigo-400" />
              )}
              <h2 className="text-base font-bold text-foreground">
                {activeDmId && activeDmUser
                  ? `Direct message with ${activeDmUser.name || activeDmUser.email}`
                  : `Welcome to #${currentChannel?.name || 'chat'}`}
              </h2>
              {currentChannel?.isPrivate && (
                <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30 bg-amber-500/10">
                  Private Channel
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {activeDmId && activeDmUser
                ? 'Direct messages are private between you two and stored securely in PostgreSQL.'
                : currentChannel?.isPrivate
                ? 'This is a private channel. Only invited members can view discussions and messages.'
                : currentChannel?.description || 'Collaborate with your team in real time!'}
            </p>
            {currentChannel?.isPrivate && (
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="glow"
                  onClick={() => {
                    setSelectedUsersToAdd([]);
                    setAddMemberSearch('');
                    setIsAddMemberOpen(true);
                  }}
                  className="text-xs rounded-xl flex items-center gap-1.5"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Add Members to Private Channel
                </Button>
              </div>
            )}
          </div>

          {/* Loading indicator */}
          {isLoadingMessages && messages.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : mergedFeed.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              No messages yet in this conversation. Send the first message below!
            </div>
          ) : (
            mergedFeed.map((feedItem) =>
              feedItem.kind === 'call' ? (
                <CallHistoryItem
                  key={feedItem.item.id}
                  entry={feedItem.item}
                  currentUserId={currentUser.id}
                />
              ) : (
                <MessageItem
                  key={feedItem.item.id}
                  message={feedItem.item}
                  currentUser={userProfile}
                  onReact={handleReact}
                  onDelete={handleDeleteMessage}
                />
              )
            )
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Real-time Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="px-4 py-1.5 flex items-center gap-2 text-xs text-indigo-400 font-medium bg-card/50 border-t border-border/30 backdrop-blur-md animate-in fade-in duration-200">
            <div className="flex gap-1 items-center">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]"></span>
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]"></span>
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce"></span>
            </div>
            <span className="font-sans">
              {typingUsers.map((u) => u.name).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}

        {/* Chat Input */}
        <ChatInput
          placeholder={
            activeDmId && activeDmUser
              ? `Message @${activeDmUser.name || activeDmUser.email.split('@')[0]}...`
              : `Message #${currentChannel?.name || 'channel'}...`
          }
          onSendMessage={handleSendMessage}
          isAiResponding={isSending}
          onTyping={emitTyping}
          onStopTyping={emitStopTyping}
        />
      </main>

      {/* Right Details / Members Sidebar */}
      {showRightSidebar && (
        <aside className="w-72 border-l border-border/70 bg-card/90 backdrop-blur-xl h-full flex flex-col p-4 space-y-4 shrink-0 animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {activeDmId ? 'User Profile' : 'Channel Details'}
            </h3>
            <button
              onClick={() => setShowRightSidebar(false)}
              className="p-1 rounded text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* DM Profile Details */}
          {activeDmId && activeDmUser ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center text-center p-3 rounded-2xl bg-secondary/30 border border-border/50">
                <Avatar
                  src={activeDmUser.avatarUrl}
                  fallback={activeDmUser.name || activeDmUser.email}
                  size="lg"
                  status={activeDmUser.status || 'online'}
                  className="h-16 w-16 mb-2"
                />
                <h4 className="text-sm font-bold text-foreground">
                  {activeDmUser.name || activeDmUser.email.split('@')[0]}
                </h4>
                <p className="text-xs text-muted-foreground font-mono">{activeDmUser.email}</p>
                <Badge variant="brand" className="mt-2 text-[10px]">
                  {activeDmUser.role}
                </Badge>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-foreground">Status Message</span>
                <p className="text-xs text-muted-foreground">
                  {activeDmUser.statusMessage || 'Active in ChatFlow'}
                </p>
              </div>
            </div>
          ) : (
            /* Channel Details & Dynamic Members */
            <>
              {/* About Section */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-foreground">About #{currentChannel?.name}</span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {currentChannel?.description || 'No description provided.'}
                </p>
              </div>

              {/* Members List */}
              <div className="flex-1 overflow-y-auto space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-foreground">
                    Members ({channelDetails?.members?.length || 1})
                  </span>
                  <button
                    onClick={() => {
                      setSelectedUsersToAdd([]);
                      setAddMemberSearch('');
                      setIsAddMemberOpen(true);
                    }}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 font-semibold"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Add Members
                  </button>
                </div>

                <div className="space-y-1.5">
                  {/* Current User */}
                  <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-accent/40">
                    <Avatar
                      src={userProfile.avatarUrl}
                      fallback={userProfile.name || userProfile.email}
                      size="sm"
                      status="online"
                    />
                    <div className="truncate flex-1">
                      <p className="text-xs font-medium text-foreground truncate">
                        {userProfile.name || userProfile.email.split('@')[0]} (You)
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{userProfile.role}</p>
                    </div>
                  </div>

                  {/* Channel Members from Backend */}
                  {channelDetails?.members
                    ?.filter((m) => m.id !== userProfile.id)
                    .map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-1.5 rounded-lg hover:bg-accent/40 group"
                      >
                        <div className="flex items-center gap-2 truncate flex-1">
                          <Avatar
                            src={member.avatarUrl}
                            fallback={member.name || member.email}
                            size="sm"
                            status={member.status || 'online'}
                          />
                          <div className="truncate flex-1">
                            <p className="text-xs font-medium text-foreground truncate">
                              {member.name || member.email.split('@')[0]}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate font-mono">
                              {member.channelRole || member.role}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartDirectMessage(member)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-primary hover:bg-primary/20 rounded transition-all"
                            title="Message this teammate"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </button>
                          {(channelDetails?.currentUserRole === 'OWNER' ||
                            currentChannel?.createdById === userProfile.id) && (
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-destructive hover:bg-destructive/20 rounded transition-all"
                              title="Remove from channel"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}
        </aside>
      )}

      {/* Start Direct Message Modal */}
      <Dialog open={isNewDmOpen} onOpenChange={setIsNewDmOpen}>
        <DialogHeader>
          <DialogTitle>Start a Direct Message</DialogTitle>
          <DialogDescription>
            Search registered teammates and connect in a private 1-on-1 direct message conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="pl-9 rounded-xl text-xs"
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1 divide-y divide-border/30">
            {filteredUsers.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">
                No users found matching "{userSearchQuery}"
              </p>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleStartDirectMessage(user)}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-accent/60 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={user.avatarUrl}
                      fallback={user.name || user.email}
                      size="md"
                      status={user.status || 'offline'}
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground">
                          {user.name || user.email.split('@')[0]}
                        </span>
                        <Badge variant="brand" className="text-[9px] py-0 font-mono">
                          {user.role}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{user.email}</p>
                    </div>
                  </div>

                  <Button size="sm" variant="ghost" className="text-xs text-primary rounded-lg">
                    Message
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsNewDmOpen(false)}
            className="rounded-xl text-xs"
          >
            Cancel
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Add Members to Channel Modal */}
      <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-indigo-400" />
            <span>Add Members to #{currentChannel?.name}</span>
          </DialogTitle>
          <DialogDescription>
            {currentChannel?.isPrivate
              ? 'This is a private channel. Only invited members can view discussions and messages.'
              : 'Invite teammates from your workspace to this channel.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={addMemberSearch}
              onChange={(e) => setAddMemberSearch(e.target.value)}
              placeholder="Search teammates by name or email..."
              className="pl-9 rounded-xl text-xs"
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1 divide-y divide-border/30">
            {filteredUsersToAdd.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">
                No teammates found matching "{addMemberSearch}"
              </p>
            ) : (
              filteredUsersToAdd.map((u) => {
                const isMember = channelDetails?.members?.some((m) => m.id === u.id);
                const isSelected = selectedUsersToAdd.includes(u.id);

                return (
                  <div
                    key={u.id}
                    onClick={() => {
                      if (isMember) return;
                      setSelectedUsersToAdd((prev) =>
                        isSelected ? prev.filter((id) => id !== u.id) : [...prev, u.id],
                      );
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl transition-colors ${
                      isMember
                        ? 'opacity-60 cursor-default bg-secondary/20'
                        : isSelected
                        ? 'bg-primary/10 border border-primary/30 cursor-pointer'
                        : 'hover:bg-accent/60 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={u.avatarUrl}
                        fallback={u.name || u.email}
                        size="md"
                        status={u.status || 'offline'}
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-foreground">
                            {u.name || u.email.split('@')[0]}
                          </span>
                          <Badge variant="brand" className="text-[9px] py-0 font-mono">
                            {u.role}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{u.email}</p>
                      </div>
                    </div>

                    {isMember ? (
                      <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-md font-medium">
                        Already in channel
                      </span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="h-4 w-4 rounded border-border text-primary pointer-events-none"
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
            <span className="text-muted-foreground font-medium">
              {selectedUsersToAdd.length} member{selectedUsersToAdd.length === 1 ? '' : 's'} selected
            </span>
            {selectedUsersToAdd.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedUsersToAdd([])}
                className="text-xs text-primary hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setIsAddMemberOpen(false);
              setSelectedUsersToAdd([]);
              setAddMemberSearch('');
            }}
            className="rounded-xl text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="glow"
            onClick={handleAddMembersSubmit}
            disabled={selectedUsersToAdd.length === 0 || isAddingMembers}
            className="rounded-xl text-xs flex items-center gap-1.5"
          >
            {isAddingMembers ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Adding...
              </>
            ) : (
              <>
                <UserPlus className="h-3.5 w-3.5" />
                Add {selectedUsersToAdd.length > 0 ? `(${selectedUsersToAdd.length})` : ''} to Channel
              </>
            )}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Account & SSO Settings Modal */}
      <SettingsModal
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        user={userProfile}
        onLogout={onLogout}
        onUserUpdate={setUserProfile}
      />

      {/* Agora RTC Voice & Video Calling Interface */}
      <CallOverlay
        callStatus={callStatus}
        activeCall={activeCall}
        callDuration={callDuration}
        isAudioMuted={isAudioMuted}
        isVideoMuted={isVideoMuted}
        isScreenSharing={isScreenSharing}
        networkQuality={networkQuality}
        remoteUsers={remoteUsers}
        localVideoTrack={localVideoTrack}
        screenTrack={screenTrack}
        onAccept={acceptCall}
        onReject={rejectCall}
        onEnd={endCall}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={toggleScreenShare}
      />
    </div>
  );
}
