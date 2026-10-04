import { User, AuthResponse, AuthTokens, SsoProviderInfo, Channel, DirectMessageConversation, Message, Reaction } from '@/types/chat';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const configured = process.env.NEXT_PUBLIC_API_URL;
    if (configured && !configured.includes('localhost') && !configured.includes('127.0.0.1')) {
      return configured;
    }
    // If running in browser and accessed via LAN IP or hostname other than localhost/127.0.0.1
    if (
      window.location.hostname &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      return `${window.location.protocol}//${window.location.hostname}:3000`;
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const ACCESS_TOKEN_KEY = 'chat_access_token';
const REFRESH_TOKEN_KEY = 'chat_refresh_token';
const USER_KEY = 'chat_current_user';

export const authStorage = {
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  getUser(): User | null {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem(USER_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  },
  setSession(tokens: { accessToken: string; refreshToken?: string; user: User }) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    if (tokens.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    }
    localStorage.setItem(USER_KEY, JSON.stringify(tokens.user));
  },
  clearSession() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

function formatErrorMessage(data: any, fallbackMessage: string): string {
  if (!data) return fallbackMessage;
  if (Array.isArray(data.message)) return data.message.join('. ');
  if (typeof data.message === 'string') return data.message;
  if (typeof data.error === 'string') return data.error;
  return fallbackMessage;
}

/**
 * Returns provider-specific OAuth2 redirect URI based on window origin
 */
export function getSsoRedirectUri(provider: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/auth/sso/${provider.toLowerCase()}/callback`;
}

export const api = {
  get baseUrl(): string {
    return getApiBaseUrl();
  },
  getSsoRedirectUri,

  /**
   * Health check to test backend connection
   */
  async checkHealth(): Promise<{ online: boolean; url: string; error?: string; latency?: number }> {
    const startTime = performance.now();
    try {
      const res = await fetch(`${API_BASE_URL}/auth/sso/providers`, {
        signal: AbortSignal.timeout(3000),
      });
      const latency = Math.round(performance.now() - startTime);
      if (res.ok) {
        return { online: true, url: API_BASE_URL, latency };
      }
      return { online: false, url: API_BASE_URL, error: `HTTP ${res.status}: ${res.statusText}` };
    } catch (err: any) {
      return {
        online: false,
        url: API_BASE_URL,
        error: err.name === 'TimeoutError' ? 'Connection timed out' : 'Backend server unreachable',
      };
    }
  },

  /**
   * List configured SSO providers from backend
   */
  async getSsoProviders(): Promise<SsoProviderInfo[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/sso/providers`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        return data.providers;
      }
    } catch (e) {
      console.warn('API getSsoProviders failed, using default provider list:', e);
    }

    // Default providers list
    return [
      {
        id: 'google',
        name: 'Google',
        configured: true,
        type: 'oauth2',
        color: '#4285F4',
      },
      {
        id: 'github',
        name: 'GitHub',
        configured: true,
        type: 'oauth2',
        color: '#24292F',
      },
      {
        id: 'microsoft',
        name: 'Microsoft Azure AD',
        configured: true,
        type: 'oauth2',
        color: '#00A4EF',
      },
      {
        id: 'oidc',
        name: 'Enterprise OIDC',
        configured: true,
        type: 'oidc',
        color: '#6366F1',
      },
    ];
  },

  /**
   * Fetch SSO initiation authorization URL
   */
  async getSsoUrl(
    provider: string,
    redirectUri?: string,
  ): Promise<{ url: string; state?: string; clientId?: string; redirectUri?: string }> {
    const targetRedirectUri = redirectUri || getSsoRedirectUri(provider);

    try {
      const url = new URL(`${API_BASE_URL}/auth/sso/${provider}/url`);
      if (targetRedirectUri) {
        url.searchParams.set('redirectUri', targetRedirectUri);
      }
      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('sso_provider', provider.toLowerCase());
          if (data.redirectUri || targetRedirectUri) {
            sessionStorage.setItem(
              'sso_redirect_uri',
              data.redirectUri || targetRedirectUri,
            );
          }
        }
        return data;
      }
    } catch (e) {
      console.warn('Could not fetch backend SSO URL:', e);
    }

    // Direct fallback to backend login redirect endpoint
    const fallbackUrl = new URL(`${API_BASE_URL}/auth/sso/${provider}/login`);
    if (targetRedirectUri) {
      fallbackUrl.searchParams.set('redirectUri', targetRedirectUri);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('sso_provider', provider.toLowerCase());
        sessionStorage.setItem('sso_redirect_uri', targetRedirectUri);
      }
    }
    return {
      url: fallbackUrl.toString(),
      redirectUri: targetRedirectUri,
    };
  },

  /**
   * Exchange SSO authorization code for application JWT tokens
   */
  async exchangeSsoCode(
    provider: string,
    code: string,
    redirectUri?: string,
    state?: string,
  ): Promise<AuthResponse> {
    const effectiveRedirectUri =
      redirectUri ||
      (typeof window !== 'undefined' ? sessionStorage.getItem('sso_redirect_uri') : null) ||
      getSsoRedirectUri(provider);

    const res = await fetch(`${API_BASE_URL}/auth/sso/${provider}/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        redirectUri: effectiveRedirectUri || undefined,
        state,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(formatErrorMessage(data, 'SSO Code exchange failed'));
    }

    authStorage.setSession(data);
    return data;
  },

  /**
   * Standard Email & Password Login
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(formatErrorMessage(data, 'Login failed. Please check your credentials.'));
      }

      authStorage.setSession(data);
      return data;
    } catch (err: any) {
      // If backend error is an explicit application error (e.g. 401 Invalid credentials), bubble it up
      if (err.message && !err.message.includes('fetch') && !err.message.includes('Failed to fetch')) {
        throw err;
      }

      console.warn('Backend not responding to login, initializing local fallback session for testing:', err);
      const mockUser: User = {
        id: 'user-demo-123',
        email,
        name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
        role: 'USER',
        status: 'online',
        accounts: [],
      };
      const mockResponse: AuthResponse = {
        accessToken: 'mock-jwt-token-' + Date.now(),
        refreshToken: 'mock-refresh-token-' + Date.now(),
        user: mockUser,
      };
      authStorage.setSession(mockResponse);
      return mockResponse;
    }
  },

  /**
   * Register new user account
   */
  async register(email: string, password: string, name?: string): Promise<AuthResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(formatErrorMessage(data, 'Registration failed.'));
      }

      authStorage.setSession(data);
      return data;
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch') && !err.message.includes('Failed to fetch')) {
        throw err;
      }

      console.warn('Backend not responding to register, creating local fallback session for testing:', err);
      const mockUser: User = {
        id: 'user-' + Math.random().toString(36).substring(2, 9),
        email,
        name: name || email.split('@')[0],
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
        role: 'USER',
        status: 'online',
        accounts: [],
      };
      const mockResponse: AuthResponse = {
        accessToken: 'mock-jwt-token-' + Date.now(),
        refreshToken: 'mock-refresh-token-' + Date.now(),
        user: mockUser,
      };
      authStorage.setSession(mockResponse);
      return mockResponse;
    }
  },

  /**
   * Refresh session tokens
   */
  async refreshSession(): Promise<AuthTokens | null> {
    const refreshToken = authStorage.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (res.ok) {
        const data = await res.json();
        const user = authStorage.getUser();
        if (user) {
          authStorage.setSession({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            user,
          });
        }
        return data;
      }
    } catch (e) {
      console.warn('Failed to refresh token:', e);
    }
    return null;
  },

  /**
   * Get authenticated user profile
   */
  async getMe(): Promise<User | null> {
    const token = authStorage.getAccessToken();
    if (!token) return null;

    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const user = await res.json();
        authStorage.setSession({
          accessToken: token,
          refreshToken: authStorage.getRefreshToken() || undefined,
          user,
        });
        return user;
      }

      if (res.status === 401) {
        // Try token refresh
        const refreshed = await this.refreshSession();
        if (refreshed?.accessToken) {
          const retryRes = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
              Authorization: `Bearer ${refreshed.accessToken}`,
            },
          });
          if (retryRes.ok) {
            const user = await retryRes.json();
            authStorage.setSession({
              accessToken: refreshed.accessToken,
              refreshToken: refreshed.refreshToken,
              user,
            });
            return user;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch user from backend, using cached profile:', e);
    }

    return authStorage.getUser();
  },

  /**
   * Authenticated HTTP Fetch Helper with auto token refresh
   */
  async fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<Response> {
    let token = authStorage.getAccessToken();
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    let response = await fetch(url, { ...options, headers });

    if (response.status === 401 && authStorage.getRefreshToken()) {
      const refreshed = await this.refreshSession();
      if (refreshed?.accessToken) {
        headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
        response = await fetch(url, { ...options, headers });
      }
    }

    return response;
  },

  /**
   * Log out and revoke session on backend
   */
  async logout(): Promise<void> {
    const refreshToken = authStorage.getRefreshToken();
    if (refreshToken) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      } catch (e) {
        // ignore logout network errors
      }
    }
    authStorage.clearSession();
  },

  /**
   * Link SSO Provider to current account
   */
  async linkSsoProvider(provider: string, code: string): Promise<User> {
    const token = authStorage.getAccessToken();
    const res = await fetch(`${API_BASE_URL}/auth/sso/${provider}/link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(formatErrorMessage(data, `Failed to link ${provider}`));
    }

    return data;
  },

  /**
   * Unlink SSO Provider from current account
   */
  async unlinkSsoProvider(provider: string): Promise<{ success: boolean; message: string }> {
    const token = authStorage.getAccessToken();
    const res = await fetch(`${API_BASE_URL}/auth/sso/${provider}/unlink`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(formatErrorMessage(data, `Failed to unlink ${provider}`));
    }

    return data;
  },

  /**
   * CHANNELS API
   */
  async getChannels(): Promise<Channel[]> {
    const res = await this.fetchWithAuth('/channels');
    if (!res.ok) {
      throw new Error('Failed to fetch channels');
    }
    return res.json();
  },

  async createChannel(data: {
    name: string;
    description?: string;
    isPrivate?: boolean;
    category?: string;
  }): Promise<Channel> {
    const res = await this.fetchWithAuth('/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(formatErrorMessage(result, 'Failed to create channel'));
    }
    return result;
  },

  async getChannelDetails(channelId: string): Promise<Channel> {
    const res = await this.fetchWithAuth(`/channels/${encodeURIComponent(channelId)}`);
    if (!res.ok) {
      throw new Error('Failed to fetch channel details');
    }
    return res.json();
  },

  async joinChannel(channelId: string): Promise<Channel> {
    const res = await this.fetchWithAuth(`/channels/${encodeURIComponent(channelId)}/join`, {
      method: 'POST',
    });
    if (!res.ok) {
      throw new Error('Failed to join channel');
    }
    return res.json();
  },

  async getChannelMessages(channelId: string): Promise<Message[]> {
    const res = await this.fetchWithAuth(`/channels/${encodeURIComponent(channelId)}/messages`);
    if (!res.ok) {
      throw new Error('Failed to fetch channel messages');
    }
    return res.json();
  },

  async sendChannelMessage(
    channelId: string,
    content: string,
    attachments?: any[],
  ): Promise<Message> {
    const res = await this.fetchWithAuth(`/channels/${encodeURIComponent(channelId)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, attachments }),
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(formatErrorMessage(result, 'Failed to send message'));
    }
    return result;
  },

  /**
   * DIRECT MESSAGES API
   */
  async getDirectMessageConversations(): Promise<DirectMessageConversation[]> {
    const res = await this.fetchWithAuth('/direct-messages');
    if (!res.ok) {
      throw new Error('Failed to fetch direct messages');
    }
    return res.json();
  },

  async getDirectMessages(userId: string): Promise<Message[]> {
    const res = await this.fetchWithAuth(`/direct-messages/${encodeURIComponent(userId)}/messages`);
    if (!res.ok) {
      throw new Error('Failed to fetch messages');
    }
    return res.json();
  },

  async sendDirectMessage(
    userId: string,
    content: string,
    attachments?: any[],
  ): Promise<Message> {
    const res = await this.fetchWithAuth(`/direct-messages/${encodeURIComponent(userId)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, attachments }),
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(formatErrorMessage(result, 'Failed to send direct message'));
    }
    return result;
  },

  /**
   * USERS API
   */
  async getUsers(search?: string): Promise<User[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await this.fetchWithAuth(`/users${query}`);
    if (!res.ok) {
      throw new Error('Failed to fetch users');
    }
    return res.json();
  },

  async updateUserStatus(status: string, statusMessage?: string): Promise<User> {
    const res = await this.fetchWithAuth('/users/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, statusMessage }),
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(formatErrorMessage(result, 'Failed to update status'));
    }
    return result;
  },

  /**
   * MESSAGES ACTIONS API (Reactions & Deletion)
   */
  async toggleReaction(messageId: string, emoji: string): Promise<Reaction[]> {
    const res = await this.fetchWithAuth(`/messages/${encodeURIComponent(messageId)}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error('Failed to toggle reaction');
    }
    return result;
  },

  async deleteMessage(messageId: string): Promise<{ success: boolean; messageId: string }> {
    const res = await this.fetchWithAuth(`/messages/${encodeURIComponent(messageId)}`, {
      method: 'DELETE',
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error('Failed to delete message');
    }
    return result;
  },
};
