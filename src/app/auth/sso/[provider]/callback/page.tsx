'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { authStorage, api, getSsoRedirectUri } from '@/lib/api';
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft, ShieldCheck, RefreshCw } from 'lucide-react';

const PROVIDER_METADATA: Record<
  string,
  { name: string; color: string; badge: string }
> = {
  google: {
    name: 'Google',
    color: '#EA4335',
    badge: 'OAuth 2.0 / OpenID Connect',
  },
  github: {
    name: 'GitHub',
    color: '#24292F',
    badge: 'OAuth 2.0 App',
  },
  microsoft: {
    name: 'Microsoft Azure AD',
    color: '#00A4EF',
    badge: 'Microsoft Entra ID',
  },
  oidc: {
    name: 'Enterprise OIDC',
    color: '#6366F1',
    badge: 'OpenID Connect 1.0',
  },
};

function SsoProviderCallbackContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const rawProvider = (params?.provider as string) || '';
  const provider = rawProvider.toLowerCase();
  const providerMeta = PROVIDER_METADATA[provider] || {
    name: provider ? provider.toUpperCase() : 'SSO Provider',
    color: '#3B82F6',
    badge: 'Single Sign-On',
  };

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
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
            throw new Error(`Authentication was cancelled or denied by ${providerMeta.name}.`);
          }
          setErrorDetails(errorDesc ? `Details: ${errorDesc}` : null);
          throw new Error(errorDesc || error);
        }

        const accessToken = searchParams.get('accessToken');
        const refreshToken = searchParams.get('refreshToken');
        const userId = searchParams.get('userId');
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        // Case 1: Backend redirected here with session JWT tokens already issued
        if (accessToken) {
          authStorage.setSession({
            accessToken,
            refreshToken: refreshToken || undefined,
            user: {
              id: userId || 'user-' + Date.now(),
              email: `${provider}.user@cloudchat.io`,
              name: `${providerMeta.name} Authenticated User`,
              avatarUrl: null,
              role: 'USER',
              status: 'online',
            },
          });

          // Fetch full profile if possible
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
          }, 600);
          return;
        }

        // Case 2: OAuth provider returned authorization code to this provider callback route
        if (code) {
          // Determine the exact redirect URI used for this provider
          const storedRedirectUri =
            typeof window !== 'undefined' ? sessionStorage.getItem('sso_redirect_uri') : null;
          const defaultRedirectUri = getSsoRedirectUri(provider);
          const effectiveRedirectUri = storedRedirectUri || defaultRedirectUri;

          // Exchange authorization code with backend API
          await api.exchangeSsoCode(
            provider,
            code,
            effectiveRedirectUri,
            state || undefined,
          );

          // Fetch full user profile
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
          }, 600);
          return;
        }

        throw new Error(
          `No authorization code or session tokens were provided in the ${providerMeta.name} callback.`,
        );
      } catch (err: any) {
        console.error(`SSO Callback error (${provider}):`, err);
        setStatus('error');
        setErrorMessage(
          err.message || 'Authentication failed. Please verify your SSO configuration and try again.',
        );
      }
    };

    handleAuth();
  }, [searchParams, provider, providerMeta.name]);

  const currentRedirectUri =
    typeof window !== 'undefined'
      ? getSsoRedirectUri(provider)
      : `/auth/sso/${provider}/callback`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-[100px] pointer-events-none opacity-20"
        style={{ backgroundColor: providerMeta.color }}
      />

      <div className="w-full max-w-md p-8 rounded-2xl border border-border bg-card/80 backdrop-blur-xl shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200 relative z-10">
        {status === 'loading' && (
          <>
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              <div
                className="absolute inset-0 rounded-full animate-ping opacity-75"
                style={{ backgroundColor: `${providerMeta.color}33` }}
              />
              <div
                className="relative flex items-center justify-center w-14 h-14 rounded-full border"
                style={{
                  backgroundColor: `${providerMeta.color}15`,
                  borderColor: `${providerMeta.color}50`,
                }}
              >
                <Loader2
                  className="h-7 w-7 animate-spin"
                  style={{ color: providerMeta.color }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                {providerMeta.badge}
              </div>
              <h2 className="text-xl font-bold text-foreground">
                Signing in with {providerMeta.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                Exchanging secure authorization code and issuing API session tokens...
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
              <h2 className="text-xl font-bold text-foreground">
                Connected via {providerMeta.name}!
              </h2>
              <p className="text-sm text-muted-foreground">
                Authorization confirmed. Launching your chat workspace...
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
              <h2 className="text-xl font-bold text-foreground">
                {providerMeta.name} Sign In Failed
              </h2>
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-left break-words">
                {errorMessage}
              </p>
              {errorDetails && (
                <p className="text-xs text-muted-foreground text-left bg-muted/50 p-2.5 rounded-lg border border-border font-mono break-all">
                  {errorDetails}
                </p>
              )}
            </div>

            <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border text-left space-y-1">
              <span className="font-semibold text-foreground block">
                Configured Redirect URI:
              </span>
              <code className="text-[11px] text-primary break-all select-all font-mono">
                {currentRedirectUri}
              </code>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => {
                  window.location.href = '/';
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all font-medium text-sm shadow-md cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Return to Sign In
              </button>
            </div>
          </>
        )}

        <div className="pt-2 border-t border-border/50 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-primary" />
          <span>Secured with OAuth 2.0 & HMAC-SHA256 State</span>
        </div>
      </div>
    </div>
  );
}

export default function SsoProviderCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      }
    >
      <SsoProviderCallbackContent />
    </Suspense>
  );
}
