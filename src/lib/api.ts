import { User, AuthResponse, SsoProviderInfo } from '@/types/chat';

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

export const api = {
  baseUrl: API_BASE_URL,

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
      console.warn('API getSsoProviders failed, using default provider list', e);
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

  async getSsoUrl(provider: string, redirectUri?: string): Promise<{ url: string; state?: string }> {
    try {
      const url = new URL(`${API_BASE_URL}/auth/sso/${provider}/url`);
      if (redirectUri) {
        url.searchParams.set('redirectUri', redirectUri);
      }
      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Could not fetch backend SSO URL:', e);
    }

    // Fallback: direct to backend login redirect endpoint
    return {
      url: `${API_BASE_URL}/auth/sso/${provider}/login`,
    };
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Login failed. Please check your credentials.');
      }

      authStorage.setSession(data);
      return data;
    } catch (err: any) {
      // If backend is unreachable or connection refused, allow quick local fallback demo
      if (err.message && !err.message.includes('fetch') && !err.message.includes('Failed to fetch')) {
        throw err;
      }

      console.warn('Backend not responding to login, initializing local session for testing:', err);
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

  async register(email: string, password: string, name?: string): Promise<AuthResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Registration failed.');
      }

      authStorage.setSession(data);
      return data;
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch') && !err.message.includes('Failed to fetch')) {
        throw err;
      }

      console.warn('Backend not responding to register, creating local session for testing:', err);
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
        authStorage.setSession({ accessToken: token, user });
        return user;
      }
    } catch (e) {
      console.warn('Failed to fetch user from backend, using cached profile:', e);
    }

    return authStorage.getUser();
  },

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

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || `Failed to link ${provider}`);
    }

    return await res.json();
  },

  async unlinkSsoProvider(provider: string): Promise<{ success: boolean; message: string }> {
    const token = authStorage.getAccessToken();
    const res = await fetch(`${API_BASE_URL}/auth/sso/${provider}/unlink`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || `Failed to unlink ${provider}`);
    }

    return await res.json();
  }
};
