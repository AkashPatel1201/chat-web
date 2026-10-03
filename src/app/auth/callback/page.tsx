'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authStorage, api } from '@/lib/api';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const accessToken = searchParams.get('accessToken');
        const refreshToken = searchParams.get('refreshToken');
        const userId = searchParams.get('userId');
        const error = searchParams.get('error');

        if (error) {
          throw new Error(searchParams.get('error_description') || error);
        }

        if (accessToken) {
          // Initialize session
          authStorage.setSession({
            accessToken,
            refreshToken: refreshToken || undefined,
            user: {
              id: userId || 'user-' + Date.now(),
              email: 'sso.user@company.com',
              name: 'SSO Authenticated User',
              avatarUrl: null,
              role: 'USER',
              status: 'online',
            },
          });

          // Fetch full user profile
          try {
            await api.getMe();
          } catch (e) {
            console.warn('Profile fetch after SSO failed, keeping initial state');
          }

          setStatus('success');
          setTimeout(() => {
            router.push('/');
          }, 800);
        } else {
          throw new Error('No access token received from authentication provider');
        }
      } catch (err: any) {
        console.error('SSO Callback error:', err);
        setStatus('error');
        setErrorMessage(err.message || 'Authentication failed');
      }
    };

    handleAuth();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md p-8 rounded-2xl border border-border bg-card/70 backdrop-blur-xl shadow-2xl text-center space-y-4">
        {status === 'loading' && (
          <>
            <div className="flex justify-center">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
            </div>
            <h2 className="text-xl font-bold">Completing SSO Sign In...</h2>
            <p className="text-sm text-muted-foreground">
              Exchanging secure credentials and setting up your workspace session.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex justify-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 animate-bounce" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Authentication Successful!</h2>
            <p className="text-sm text-muted-foreground">
              Redirecting you to your chat channels...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="flex justify-center">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <h2 className="text-xl font-bold text-destructive">Sign In Failed</h2>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all font-medium text-sm"
            >
              Back to Login
            </button>
          </>
        )}
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
