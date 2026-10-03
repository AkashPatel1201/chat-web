'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Channel, DirectMessageConversation, Message, User } from '@/types/chat';
import { Sidebar } from './Sidebar';
import { MessageItem } from './MessageItem';
import { ChatInput } from './ChatInput';
import { SettingsModal } from './SettingsModal';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  FileCode,
  ShieldAlert,
} from 'lucide-react';

interface ChatViewProps {
  currentUser: User;
  onLogout: () => void;
}

const INITIAL_CHANNELS: Channel[] = [
  {
    id: 'general',
    name: 'general',
    description: 'Workspace-wide general discussion, updates, and welcoming newcomers',
    isPrivate: false,
    memberCount: 28,
    category: 'text',
  },
  {
    id: 'dev-talk',
    name: 'dev-talk',
    description: 'Next.js 16, NestJS, Tailwind v4, Prisma architecture and code discussions',
    isPrivate: false,
    memberCount: 16,
    category: 'text',
    unreadCount: 3,
  },
  {
    id: 'announcements',
    name: 'announcements',
    description: 'Official releases, system maintenance, and milestone updates',
    isPrivate: false,
    memberCount: 42,
    category: 'announcements',
  },
  {
    id: 'design-system',
    name: 'design-system',
    description: 'Shadcn UI components, typography, dark themes, and glassmorphism',
    isPrivate: false,
    memberCount: 9,
    category: 'text',
  },
  {
    id: 'random',
    name: 'random',
    description: 'Coffee breaks, tech memes, and watercooler banter ☕',
    isPrivate: false,
    memberCount: 24,
    category: 'text',
  },
];

const INITIAL_DMS: DirectMessageConversation[] = [
  {
    id: 'dm-ai',
    user: {
      id: 'bot-assistant',
      email: 'ai.assistant@chatflow.internal',
      name: 'ChatFlow AI Assistant',
      avatarUrl: null,
      role: 'BOT',
      status: 'online',
      statusMessage: 'Powered by Deep Learning & Next-Gen LLMs',
    },
    lastMessage: 'Hello! I can summarize discussions, write code, or answer questions.',
  },
  {
    id: 'dm-sarah',
    user: {
      id: 'user-sarah',
      email: 'sarah.chen@company.com',
      name: 'Sarah Chen',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      role: 'ADMIN',
      status: 'online',
      statusMessage: 'Reviewing Multi-SSO PRs 🚀',
    },
    lastMessage: 'The Google OAuth callback is completely hooked up!',
  },
  {
    id: 'dm-marcus',
    user: {
      id: 'user-marcus',
      email: 'marcus.vance@company.com',
      name: 'Marcus Vance',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      role: 'USER',
      status: 'idle',
      statusMessage: 'In a meeting until 3 PM',
    },
    lastMessage: 'Let me know when the build is ready.',
  },
];

const INITIAL_MESSAGES: Record<string, Message[]> = {
  general: [
    {
      id: 'm-1',
      senderId: 'user-sarah',
      senderName: 'Sarah Chen',
      senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      senderRole: 'ADMIN',
      content: 'Hey everyone! Welcome to our new **ChatFlow** platform with Multi-SSO (Google, GitHub, Microsoft, OIDC) and Shadcn UI. 🚀',
      timestamp: 'Today at 10:14 AM',
      reactions: [
        { emoji: '🎉', count: 6, users: ['user-sarah'] },
        { emoji: '🚀', count: 4, users: [] },
      ],
    },
    {
      id: 'm-2',
      senderId: 'user-marcus',
      senderName: 'Marcus Vance',
      senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      senderRole: 'USER',
      content: 'The glassmorphic dark theme and micro-interactions look incredible! Great job team.',
      timestamp: 'Today at 10:18 AM',
      reactions: [{ emoji: '🔥', count: 3, users: [] }],
    },
    {
      id: 'm-3',
      senderId: 'bot-assistant',
      senderName: 'ChatFlow AI Assistant',
      senderRole: 'BOT',
      content:
        'Hello team! I am your workspace assistant. You can chat with me directly in DMs or mention me here. Try asking me to write a query, review code, or generate TypeScript types.',
      timestamp: 'Today at 10:20 AM',
      reactions: [{ emoji: '🤖', count: 5, users: [] }],
    },
  ],
  'dev-talk': [
    {
      id: 'm-4',
      senderId: 'user-sarah',
      senderName: 'Sarah Chen',
      senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      senderRole: 'ADMIN',
      content: 'Here is the code structure for our OAuth2 callback handling in NestJS:\n```typescript\n@Get(\'sso/:provider/callback\')\nasync handleCallback(@Param(\'provider\') providerId: string, @Query(\'code\') code: string) {\n  const { tokens, profile } = await this.ssoService.handleCodeExchange(providerId, code);\n  return this.authService.loginOrRegisterSso(profile, tokens);\n}\n```',
      timestamp: 'Today at 11:02 AM',
      reactions: [{ emoji: '👍', count: 4, users: [] }],
    },
  ],
  'dm-ai': [
    {
      id: 'm-ai-1',
      senderId: 'bot-assistant',
      senderName: 'ChatFlow AI Assistant',
      senderRole: 'BOT',
      content:
        '👋 Welcome! I am your AI copilot built right into ChatFlow. Send me any question, ask me to generate code, draft documentation, or summarize messages.',
      timestamp: 'Just now',
    },
  ],
};

export function ChatView({ currentUser, onLogout }: ChatViewProps) {
  const [channels, setChannels] = useState<Channel[]>(INITIAL_CHANNELS);
  const [directMessages, setDirectMessages] = useState<DirectMessageConversation[]>(INITIAL_DMS);
  const [activeChannelId, setActiveChannelId] = useState<string>('general');
  const [activeDmId, setActiveDmId] = useState<string | null>(null);
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>(INITIAL_MESSAGES);
  const [userProfile, setUserProfile] = useState<User>(currentUser);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeKey = activeDmId || activeChannelId;
  const currentMessages = messagesMap[activeKey] || [];

  const currentChannel = channels.find((c) => c.id === activeChannelId);
  const currentDm = directMessages.find((dm) => dm.id === activeDmId);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, isAiResponding]);

  const handleSelectChannel = (channelId: string) => {
    setActiveChannelId(channelId);
    setActiveDmId(null);
    setMobileSidebarOpen(false);
  };

  const handleSelectDm = (dmId: string) => {
    setActiveDmId(dmId);
    setMobileSidebarOpen(false);
  };

  const handleCreateChannel = (newChan: { name: string; description: string; isPrivate: boolean }) => {
    const id = newChan.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const created: Channel = {
      id,
      name: newChan.name,
      description: newChan.description,
      isPrivate: newChan.isPrivate,
      memberCount: 1,
      category: 'text',
    };
    setChannels((prev) => [...prev, created]);
    setActiveChannelId(id);
    setActiveDmId(null);
  };

  const handleSendMessage = (content: string, attachments?: any[]) => {
    const newMessage: Message = {
      id: 'm-' + Date.now(),
      senderId: userProfile.id,
      senderName: userProfile.name || userProfile.email.split('@')[0],
      senderAvatar: userProfile.avatarUrl || undefined,
      senderRole: userProfile.role,
      content,
      timestamp: 'Just now',
      attachments,
      reactions: [],
    };

    setMessagesMap((prev) => ({
      ...prev,
      [activeKey]: [...(prev[activeKey] || []), newMessage],
    }));

    // Trigger AI response if chatting with AI Assistant or DM
    if (activeDmId === 'dm-ai' || content.toLowerCase().includes('@ai')) {
      setIsAiResponding(true);

      setTimeout(() => {
        let aiReply = "I received your message! How can I assist you with your project today?";

        if (content.toLowerCase().includes('sso') || content.toLowerCase().includes('login')) {
          aiReply = "Multi-SSO is fully operational! We support **Google OAuth2**, **GitHub OAuth**, **Microsoft Azure AD**, and **Generic OIDC**. You can connect or disconnect providers in your Account Settings at any time.";
        } else if (content.toLowerCase().includes('tailwind') || content.toLowerCase().includes('css')) {
          aiReply = "We are using **Tailwind CSS v4** along with custom Shadcn-inspired tokens for smooth animations, glassmorphism blur filters, and accessible dark mode.";
        } else if (content.toLowerCase().includes('code') || content.toLowerCase().includes('typescript')) {
          aiReply = "Here is a clean snippet for your chat handler:\n```typescript\nexport const sendMessage = async (payload: { channelId: string; content: string }) => {\n  return await fetch('/api/chat/messages', {\n    method: 'POST',\n    body: JSON.stringify(payload)\n  });\n};\n```";
        }

        const botMsg: Message = {
          id: 'ai-reply-' + Date.now(),
          senderId: 'bot-assistant',
          senderName: 'ChatFlow AI Assistant',
          senderRole: 'BOT',
          content: aiReply,
          timestamp: 'Just now',
          reactions: [{ emoji: '✨', count: 1, users: ['bot-assistant'] }],
        };

        setMessagesMap((prev) => ({
          ...prev,
          [activeKey]: [...(prev[activeKey] || []), botMsg],
        }));

        setIsAiResponding(false);
      }, 1200);
    }
  };

  const handleReact = (messageId: string, emoji: string) => {
    setMessagesMap((prev) => {
      const messages = prev[activeKey] || [];
      const updated = messages.map((m) => {
        if (m.id !== messageId) return m;

        const reactions = m.reactions ? [...m.reactions] : [];
        const existingIdx = reactions.findIndex((r) => r.emoji === emoji);

        if (existingIdx > -1) {
          const r = reactions[existingIdx];
          const hasUser = r.users.includes(userProfile.id);

          if (hasUser) {
            // Remove user reaction
            const newUsers = r.users.filter((uid) => uid !== userProfile.id);
            if (newUsers.length === 0) {
              reactions.splice(existingIdx, 1);
            } else {
              reactions[existingIdx] = { ...r, count: r.count - 1, users: newUsers };
            }
          } else {
            // Add user reaction
            reactions[existingIdx] = {
              ...r,
              count: r.count + 1,
              users: [...r.users, userProfile.id],
            };
          }
        } else {
          // New emoji reaction
          reactions.push({ emoji, count: 1, users: [userProfile.id] });
        }

        return { ...m, reactions };
      });

      return { ...prev, [activeKey]: updated };
    });
  };

  const handleDeleteMessage = (messageId: string) => {
    setMessagesMap((prev) => ({
      ...prev,
      [activeKey]: (prev[activeKey] || []).filter((m) => m.id !== messageId),
    }));
  };

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
          onLogout={onLogout}
          onCreateChannel={handleCreateChannel}
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

            {/* Title & Topic */}
            {activeDmId && currentDm ? (
              <div className="flex items-center gap-2.5 truncate">
                <Avatar
                  src={currentDm.user.avatarUrl}
                  fallback={currentDm.user.name || currentDm.user.email}
                  size="sm"
                  status={currentDm.user.status || 'online'}
                />
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground truncate">
                      {currentDm.user.name}
                    </span>
                    <Badge variant="brand" className="text-[9px] py-0">
                      {currentDm.user.role}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {currentDm.user.statusMessage || currentDm.user.email}
                  </p>
                </div>
              </div>
            ) : currentChannel ? (
              <div className="truncate">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-indigo-400 shrink-0" />
                  <span className="font-bold text-sm text-foreground truncate">
                    {currentChannel.name}
                  </span>
                  <Badge variant="outline" className="text-[10px] py-0 text-muted-foreground hidden sm:inline-flex">
                    {currentChannel.memberCount} members
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
                  {currentChannel.description}
                </p>
              </div>
            ) : null}
          </div>

          {/* Header Controls */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => alert('Starting secure voice call... (Demo simulation)')}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Voice Call"
            >
              <Phone className="h-4 w-4" />
            </button>
            <button
              onClick={() => alert('Starting HD video conference... (Demo simulation)')}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Video Call"
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
              title="Channel Details & Members"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Welcome Banner at Top of Conversation */}
          <div className="py-6 px-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent border border-border/60 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-5 w-5 text-indigo-400" />
              <h2 className="text-base font-bold text-foreground">
                {activeDmId && currentDm
                  ? `Direct conversation with ${currentDm.user.name}`
                  : `Welcome to #${currentChannel?.name}`}
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              {activeDmId && currentDm
                ? 'Messages in direct conversations are private between you two.'
                : currentChannel?.description || 'Start collaborating with your teammates!'}
            </p>
          </div>

          {/* Render Messages */}
          {currentMessages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              No messages yet. Send the first message below!
            </div>
          ) : (
            currentMessages.map((msg) => (
              <MessageItem
                key={msg.id}
                message={msg}
                currentUser={userProfile}
                onReact={handleReact}
                onDelete={handleDeleteMessage}
              />
            ))
          )}

          {/* AI Typing Indicator */}
          {isAiResponding && (
            <div className="flex items-center gap-3 px-4 py-2 text-xs text-muted-foreground animate-pulse">
              <div className="h-7 w-7 rounded-xl bg-purple-600/30 flex items-center justify-center text-purple-300">
                <Bot className="h-4 w-4 animate-bounce" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-purple-300">AI Assistant</span>
                <span>is generating response...</span>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-purple-400 animate-ping" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <ChatInput
          placeholder={
            activeDmId && currentDm
              ? `Message @${currentDm.user.name}...`
              : `Message #${currentChannel?.name}...`
          }
          onSendMessage={handleSendMessage}
          isAiResponding={isAiResponding}
        />
      </main>

      {/* Right Details / Members Sidebar */}
      {showRightSidebar && (
        <aside className="w-72 border-l border-border/70 bg-card/90 backdrop-blur-xl h-full flex flex-col p-4 space-y-4 shrink-0 animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Channel Details
            </h3>
            <button
              onClick={() => setShowRightSidebar(false)}
              className="p-1 rounded text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* About Section */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-foreground">About</span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {currentChannel?.description || 'Active direct message conversation with end-to-end security.'}
            </p>
          </div>

          {/* Pinned Items */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
              <Pin className="h-3.5 w-3.5 text-amber-500" />
              <span>Pinned Notes</span>
            </div>
            <div className="p-2.5 rounded-xl bg-secondary/50 border border-border/50 text-xs text-muted-foreground">
              Remember to test Multi-SSO endpoints before submitting your pull requests.
            </div>
          </div>

          {/* Online Members List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            <span className="text-[11px] font-semibold text-foreground block">
              Active Members
            </span>
            <div className="space-y-2">
              {/* Current user */}
              <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-accent/40">
                <Avatar
                  src={userProfile.avatarUrl}
                  fallback={userProfile.name || userProfile.email}
                  size="sm"
                  status="online"
                />
                <div className="truncate flex-1">
                  <p className="text-xs font-medium text-foreground truncate">
                    {userProfile.name} (You)
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">{userProfile.role}</p>
                </div>
              </div>

              {/* Bot */}
              <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-accent/40">
                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="truncate flex-1">
                  <p className="text-xs font-medium text-foreground truncate">AI Assistant</p>
                  <p className="text-[10px] text-purple-400 font-mono">AUTOMATED BOT</p>
                </div>
              </div>

              {/* Teammates */}
              {directMessages.filter((d) => d.id !== 'dm-ai').map((dm) => (
                <div key={dm.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-accent/40">
                  <Avatar
                    src={dm.user.avatarUrl}
                    fallback={dm.user.name || dm.user.email}
                    size="sm"
                    status={dm.user.status || 'offline'}
                  />
                  <div className="truncate flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{dm.user.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{dm.user.statusMessage || dm.user.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      )}

      {/* Account & SSO Settings Modal */}
      <SettingsModal
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        user={userProfile}
        onLogout={onLogout}
        onUserUpdate={setUserProfile}
      />
    </div>
  );
}
