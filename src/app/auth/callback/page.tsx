'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authStorage, api, getSsoRedirectUri } from '@/lib/api';
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft, ShieldCheck } from 'lucide-react';

/**
 * Safely parse provider from backend HMAC state token
 */
function extractProviderFromState(state: string | null): string | null {
  if (!state) return null;
  try {
    const base64 = state.replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = atob(base64);
    const parsed = JSON.parse(jsonStr);
    if (parsed.payload) {
      const payloadObj =
        typeof parsed.payload === 'string' ? JSON.parse(parsed.payload) : parsed.payload;
      return payloadObj.providerId || null;
    }
  } catch {
    // If not matching expected state format, silently fall back
  }
  return null;
}

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeProvider, setActiveProvider] = useState<string>('SSO');
  const hasExecutedRef = useRef(false);

  useEffect(() => {
    // Guard against React strict-mode double execution
    if (hasExecutedRef.current) return;
    hasExecutedRef.current = true;

    const handleAuth = async () => {
      try {
        const error = searchParams.get('error');
        const errorDesc = searchParams.get('error_description');

        if (error) {
          if (error === 'access_denied') {
            throw new Error('Access was cancelled or denied by the provider.');
          }
          throw new Error(errorDesc || error);
        }

        const accessToken = searchParams.get('accessToken');
        const refreshToken = searchParams.get('refreshToken');
        const userId = searchParams.get('userId');
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        // Resolve provider identity with 3-tier fallback
        const queryProvider = searchParams.get('provider');
        const storedProvider =
          typeof window !== 'undefined' ? sessionStorage.getItem('sso_provider') : null;
        const stateProvider = extractProviderFromState(state);

        const detectedProvider = (
          queryProvider ||
          storedProvider ||
          stateProvider ||
          'google'
        ).toLowerCase();

        setActiveProvider(
          detectedProvider.charAt(0).toUpperCase() + detectedProvider.slice(1),
        );

        // Case 1: Backend redirected here with session JWT tokens already issued
        if (accessToken) {
          authStorage.setSession({
            accessToken,
            refreshToken: refreshToken || undefined,
            user: {
              id: userId || 'user-' + Date.now(),
              email: `${detectedProvider}.user@cloudchat.io`,
              name: `${detectedProvider.toUpperCase()} Authenticated User`,
              avatarUrl: null,
              role: 'USER',
              status: 'online',
            },
          });

          // Fetch full user profile
          try {
            await api.getMe();
          } catch (e) {
            console.warn('Profile sync notice:', e);
          }

          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('sso_provider');
            sessionStorage.removeItem('sso_redirect_uri');
          }

          setStatus('success');
          setTimeout(() => {
            window.location.href = '/';
          }, 700);
          return;
        }

        // Case 2: OAuth provider returned authorization code to frontend
        if (code) {
          const redirectUri =
            (typeof window !== 'undefined' &&
              sessionStorage.getItem('sso_redirect_uri')) ||
            getSsoRedirectUri(detectedProvider) ||
            (typeof window !== 'undefined'
              ? `${window.location.origin}/auth/callback`
              : undefined);

          // Exchange code with backend API
          await api.exchangeSsoCode(
            detectedProvider,
            code,
            redirectUri,
            state || undefined,
          );

          // Ensure full profile is loaded
          try {
            await api.getMe();
          } catch (e) {
            console.warn('Profile load notice:', e);
          }

          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('sso_provider');
            sessionStorage.removeItem('sso_redirect_uri');
          }

          setStatus('success');
          setTimeout(() => {
            window.location.href = '/';
          }, 700);
          return;
        }

        throw new Error(
          'No authentication token or authorization code was found in the callback request.',
        );
      } catch (err: any) {
        console.error('SSO Callback error:', err);
        setStatus('error');
        setErrorMessage(
          err.message || 'Authentication failed. Please try signing in again.',
        );
      }
    };

    handleAuth();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md p-8 rounded-2xl border border-border bg-card/80 backdrop-blur-xl shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {status === 'loading' && (
          <>
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-75" />
              <div className="relative flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 border border-primary/30">
                <Loader2 className="h-7 w-7 text-primary animate-spin" />
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-foreground">
                Authenticating with {activeProvider}
              </h2>
              <p className="text-sm text-muted-foreground">
                Verifying authorization credentials and establishing your secure session...
              </p>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 animate-in zoom-in duration-300" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-foreground">Welcome Back!</h2>
              <p className="text-sm text-muted-foreground">
                Authentication verified. Directing to your workspace...
              </p>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive animate-in zoom-in duration-300" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">Sign In Unsuccessful</h2>
              <p className="text-sm text-muted-foreground bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-destructive break-words">
                {errorMessage}
              </p>
            </div>
            <button
              onClick={() => {
                window.location.href = '/';
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all font-medium text-sm shadow-md"
            >
              <ArrowLeft className="w-4 h-4" /> Return to Login
            </button>
          </>
        )}

        <div className="pt-2 border-t border-border/50 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-primary" />
          <span>Secured with OAuth 2.0 & End-to-End JWT</span>
        </div>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
