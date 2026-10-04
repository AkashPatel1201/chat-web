'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { socketClient } from '@/lib/socket';
import { Message, Reaction, User } from '@/types/chat';

interface UseChatSocketProps {
  currentUser: User | null;
  activeChannelId: string;
  activeDmId: string | null;
  onNewMessage: (message: Message) => void;
  onReactionUpdate: (data: { messageId: string; reactions: Reaction[] }) => void;
  onMessageDelete: (data: { messageId: string; channelId?: string }) => void;
  onUserStatusChange?: (data: { userId: string; status: 'online' | 'offline' }) => void;
}

export function useChatSocket({
  currentUser,
  activeChannelId,
  activeDmId,
  onNewMessage,
  onReactionUpdate,
  onMessageDelete,
  onUserStatusChange,
}: UseChatSocketProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ id: string; name: string }[]>([]);
  const typingTimersRef = useRef<Map<string, any>>(new Map());
  const lastTypingSentRef = useRef<number>(0);

  // Connect socket on mount / when currentUser changes
  useEffect(() => {
    if (!currentUser) return;

    socketClient.connect();

    const unsubConnection = socketClient.on('connection_change', (data) => {
      setIsConnected(data.isConnected);
    });

    return () => {
      unsubConnection();
    };
  }, [currentUser]);

  // Join channel room when activeChannelId changes
  useEffect(() => {
    if (!activeChannelId) return;

    socketClient.joinChannel(activeChannelId);

    return () => {
      socketClient.leaveChannel(activeChannelId);
      // Clear typing users on conversation switch
      setTypingUsers([]);
    };
  }, [activeChannelId]);

  // Clear typing users when activeDmId changes
  useEffect(() => {
    setTypingUsers([]);
  }, [activeDmId]);

  // Listen to incoming real-time socket events
  useEffect(() => {
    const unsubChannelMsg = socketClient.on('channel_message', (message) => {
      onNewMessage(message);
    });

    const unsubDmMsg = socketClient.on('direct_message', (message) => {
      onNewMessage(message);
    });

    const unsubReaction = socketClient.on('message_reaction_updated', (data) => {
      onReactionUpdate(data);
    });

    const unsubDelete = socketClient.on('message_deleted', (data) => {
      onMessageDelete(data);
    });

    const unsubStatus = socketClient.on('user_status', (data) => {
      if (onUserStatusChange) {
        onUserStatusChange(data);
      }
    });

    const unsubTyping = socketClient.on('typing', (data) => {
      // Don't show typing for self
      if (currentUser && data.userId === currentUser.id) return;

      const isCurrentConversation =
        (activeChannelId && data.channelId === activeChannelId) ||
        (activeDmId && data.recipientId === currentUser?.id && data.userId === activeDmId);

      if (!isCurrentConversation) return;

      const name = data.userName || 'Someone';

      setTypingUsers((prev: { id: string; name: string }[]) => {
        if (prev.some((u) => u.id === data.userId)) return prev;
        return [...prev, { id: data.userId, name }];
      });

      // Clear existing timer for this user if any
      const existingTimer = typingTimersRef.current.get(data.userId);
      if (existingTimer) clearTimeout(existingTimer);

      // Auto clear typing state after 3.5 seconds
      const newTimer = setTimeout(() => {
        setTypingUsers((prev: { id: string; name: string }[]) =>
          prev.filter((u) => u.id !== data.userId),
        );
        typingTimersRef.current.delete(data.userId);
      }, 3500);

      typingTimersRef.current.set(data.userId, newTimer);
    });

    const unsubStopTyping = socketClient.on('stop_typing', (data) => {
      const existingTimer = typingTimersRef.current.get(data.userId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        typingTimersRef.current.delete(data.userId);
      }
      setTypingUsers((prev: { id: string; name: string }[]) =>
        prev.filter((u) => u.id !== data.userId),
      );
    });

    return () => {
      unsubChannelMsg();
      unsubDmMsg();
      unsubReaction();
      unsubDelete();
      unsubStatus();
      unsubTyping();
      unsubStopTyping();
    };
  }, [
    currentUser,
    activeChannelId,
    activeDmId,
    onNewMessage,
    onReactionUpdate,
    onMessageDelete,
    onUserStatusChange,
  ]);

  // Clean up all timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of typingTimersRef.current.values()) {
        clearTimeout(timer);
      }
      typingTimersRef.current.clear();
    };
  }, []);

  // Send typing event throttled to at most once per 2 seconds
  const emitTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;

    if (activeChannelId) {
      socketClient.sendTyping(activeChannelId, undefined);
    } else if (activeDmId) {
      socketClient.sendTyping(undefined, activeDmId);
    }
  }, [activeChannelId, activeDmId]);

  const emitStopTyping = useCallback(() => {
    lastTypingSentRef.current = 0;
    if (activeChannelId) {
      socketClient.sendStopTyping(activeChannelId, undefined);
    } else if (activeDmId) {
      socketClient.sendStopTyping(undefined, activeDmId);
    }
  }, [activeChannelId, activeDmId]);

  return {
    isConnected,
    typingUsers,
    emitTyping,
    emitStopTyping,
  };
}
