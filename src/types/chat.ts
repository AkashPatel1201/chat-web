export type UserRole = 'USER' | 'ADMIN' | 'MODERATOR' | 'BOT';

export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status?: UserStatus;
  statusMessage?: string;
  accounts?: Array<{
    id: string;
    provider: string;
    createdAt?: string;
  }>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
  expiresIn?: number;
}

export interface AuthResponse extends AuthTokens {
  user: User;
}

export type SsoProviderId = 'google' | 'github' | 'microsoft' | 'oidc';

export interface SsoProviderInfo {
  id: SsoProviderId;
  name: string;
  configured: boolean;
  type: string;
  icon?: string;
  color?: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  users: string[]; // user IDs
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  size: string;
  type: 'image' | 'file' | 'code';
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderRole?: UserRole;
  content: string;
  timestamp: string;
  reactions?: Reaction[];
  attachments?: Attachment[];
  replyCount?: number;
  isEdited?: boolean;
  channelId?: string;
  recipientId?: string;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  unreadCount?: number;
  memberCount: number;
  category: 'text' | 'voice' | 'announcements';
  createdAt?: string;
  members?: Array<User & { channelRole?: string; joinedAt?: string }>;
}

export interface DirectMessageConversation {
  id: string;
  user: User;
  unreadCount?: number;
  lastMessage?: string;
  lastMessageTime?: string;
}
