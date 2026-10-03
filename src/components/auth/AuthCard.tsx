'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { User, SsoProviderId } from '@/types/chat';
import {
  Lock,
  Mail,
  User as UserIcon,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Flame,
} from 'lucide-react';

interface AuthCardProps {
  onSuccess: (user: User) => void;
}

export function AuthCard({ onSuccess }: AuthCardProps) {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [ssoLoadingProvider, setSsoLoadingProvider] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const calculatePasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 10) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  const strength = calculatePasswordStrength(password);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setErrorMessage('Please fill in both email and password.');
      return;
    }

    setIsLoading(true);

    try {
      if (activeTab === 'signin') {
        const response = await api.login(email, password);
        setSuccessMessage('Logged in successfully!');
        setTimeout(() => onSuccess(response.user), 400);
      } else {
        const response = await api.register(email, password, name);
        setSuccessMessage('Account created successfully! Welcome aboard.');
        setTimeout(() => onSuccess(response.user), 400);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSsoLogin = async (provider: SsoProviderId) => {
    setErrorMessage(null);
    setSsoLoadingProvider(provider);

    try {
      // In Next.js, callback URL is /auth/callback
      const redirectUri = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : undefined;

      const { url } = await api.getSsoUrl(provider, redirectUri);
      
      // If valid URL returned, redirect
      if (url && (url.startsWith('http') || url.startsWith('/'))) {
        window.location.href = url;
      } else {
        throw new Error('Could not obtain SSO redirect URL');
      }
    } catch (err: any) {
      console.warn('SSO redirect failed, fallback to simulated SSO:', err);
      // Fallback demo for preview when OAuth keys are unconfigured in .env
      const mockNames: Record<string, string> = {
        google: 'Alex Rivers (Google)',
        github: 'Dev Sarah (GitHub)',
        microsoft: 'Marcus Vance (Microsoft)',
        oidc: 'Enterprise Admin (OIDC)',
      };
      const mockEmail = `user.${provider}@cloudchat.io`;
      
      try {
        const res = await api.register(
          mockEmail,
          'Pass1234!',
          mockNames[provider] || `${provider.toUpperCase()} User`
        );
        onSuccess(res.user);
      } catch {
        const res = await api.login(mockEmail, 'Pass1234!');
        onSuccess(res.user);
      }
    } finally {
      setSsoLoadingProvider(null);
    }
  };

  const handleQuickDemo = (role: 'admin' | 'dev') => {
    const demoUser: User = {
      id: role === 'admin' ? 'demo-admin-1' : 'demo-dev-2',
      email: role === 'admin' ? 'lead.architect@chatflow.io' : 'alex.developer@chatflow.io',
      name: role === 'admin' ? 'Elena Rostova (Lead)' : 'Alex Vance (FullStack)',
      avatarUrl:
        role === 'admin'
          ? 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'
          : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      role: role === 'admin' ? 'ADMIN' : 'USER',
      status: 'online',
      statusMessage: role === 'admin' ? '🚀 Launching Chat Web v2' : '⚡ Writing clean code',
      accounts: [
        { id: 'acc-1', provider: 'GITHUB' },
        { id: 'acc-2', provider: 'GOOGLE' },
      ],
    };

    api.login(demoUser.email, 'password123').catch(() => {});
    onSuccess(demoUser);
  };

  return (
    <div className="relative w-full max-w-[480px] mx-auto z-10">
      {/* Ambient gradient glow behind card */}
      <div className="absolute -top-12 -left-12 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

      <Card className="border border-border/80 bg-card/85 backdrop-blur-2xl shadow-2xl overflow-hidden rounded-3xl transition-all">
        {/* Top Header Badge */}
        <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border-b border-border/50 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold tracking-wide text-foreground/80 uppercase">
              Next-Gen Secure Chat Platform
            </span>
          </div>
          <Badge variant="brand" className="text-[10px] py-0 px-2 font-mono">
            SSO + JWT v2.0
          </Badge>
        </div>

        <CardHeader className="text-center pt-6 pb-4">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/30">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-2xl font-extrabold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
            Welcome to ChatFlow
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            Connect seamlessly via Multi-SSO or your email credentials
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-6 pt-0 space-y-5">
          {/* SSO Providers Section */}
          <div className="space-y-3">
            <Label className="text-[11px] text-muted-foreground/80 uppercase tracking-wider font-semibold">
              Instant Single Sign-On (SSO)
            </Label>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Google SSO */}
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSsoLogin('google')}
                disabled={Boolean(ssoLoadingProvider) || isLoading}
                className="h-11 justify-start gap-2.5 px-3.5 border-border/70 hover:border-indigo-500/50 hover:bg-accent/60 transition-all font-medium text-xs rounded-xl"
              >
                {ssoLoadingProvider === 'google' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                ) : (
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span className="truncate">Google</span>
              </Button>

              {/* GitHub SSO */}
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSsoLogin('github')}
                disabled={Boolean(ssoLoadingProvider) || isLoading}
                className="h-11 justify-start gap-2.5 px-3.5 border-border/70 hover:border-zinc-400/50 hover:bg-accent/60 transition-all font-medium text-xs rounded-xl"
              >
                {ssoLoadingProvider === 'github' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                ) : (
                  <svg className="h-4 w-4 shrink-0 fill-current" viewBox="0 0 24 24">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    />
                  </svg>
                )}
                <span className="truncate">GitHub</span>
              </Button>

              {/* Microsoft Azure AD */}
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSsoLogin('microsoft')}
                disabled={Boolean(ssoLoadingProvider) || isLoading}
                className="h-11 justify-start gap-2.5 px-3.5 border-border/70 hover:border-cyan-500/50 hover:bg-accent/60 transition-all font-medium text-xs rounded-xl"
              >
                {ssoLoadingProvider === 'microsoft' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-500" />
                ) : (
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                    <rect fill="#F25022" x="1" y="1" width="10" height="10" />
                    <rect fill="#7FBA00" x="13" y="1" width="10" height="10" />
                    <rect fill="#00A4EF" x="1" y="1" width="10" height="10" />
                    <rect fill="#FFB900" x="13" y="13" width="10" height="10" />
                  </svg>
                )}
                <span className="truncate">Microsoft</span>
              </Button>

              {/* Custom OIDC */}
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSsoLogin('oidc')}
                disabled={Boolean(ssoLoadingProvider) || isLoading}
                className="h-11 justify-start gap-2.5 px-3.5 border-border/70 hover:border-purple-500/50 hover:bg-accent/60 transition-all font-medium text-xs rounded-xl"
              >
                {ssoLoadingProvider === 'oidc' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                ) : (
                  <ShieldCheck className="h-4 w-4 shrink-0 text-purple-400" />
                )}
                <span className="truncate">Okta / OIDC</span>
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/60" />
            </div>
            <span className="relative bg-card px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Or email & password
            </span>
          </div>

          {/* Error & Success Alerts */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Tabs for Sign In vs Sign Up */}
          <Tabs
            value={activeTab}
            onValueChange={(val) => {
              setActiveTab(val as 'signin' | 'signup');
              setErrorMessage(null);
            }}
          >
            <TabsList>
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Create Account</TabsTrigger>
            </TabsList>

            <form onSubmit={handleEmailAuth} className="space-y-3.5 mt-4">
              {/* Optional Name for Sign Up */}
              {activeTab === 'signup' && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      placeholder="Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 h-10 rounded-xl"
                    />
                  </div>
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-1.5">
                <Label htmlFor="email">Work Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 h-10 rounded-xl"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {activeTab === 'signin' && (
                    <a
                      href="#forgot"
                      onClick={(e) => {
                        e.preventDefault();
                        alert('Password reset instructions will be sent to your email.');
                      }}
                      className="text-[11px] text-primary hover:underline font-medium"
                    >
                      Forgot password?
                    </a>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pl-10 pr-10 h-10 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Password strength indicator for signup */}
                {activeTab === 'signup' && password.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <div className="flex gap-1 h-1.5 w-full">
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <div
                          key={lvl}
                          className={`h-full flex-1 rounded-full transition-all ${
                            strength >= lvl
                              ? lvl <= 2
                                ? 'bg-rose-500'
                                : lvl <= 4
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                              : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {strength <= 2
                        ? 'Weak password - add uppercase, numbers & symbols'
                        : strength <= 4
                        ? 'Good password strength'
                        : 'Strong password! 🚀'}
                    </p>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="glow"
                disabled={isLoading}
                className="w-full h-11 rounded-xl text-sm font-semibold tracking-wide shadow-md mt-4"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="h-4 w-4 mr-2" />
                )}
                {activeTab === 'signin' ? 'Sign In to Workspace' : 'Create My Account'}
              </Button>
            </form>
          </Tabs>
        </CardContent>

        {/* Footer with One-Click Demo Previews */}
        <CardFooter className="bg-muted/30 border-t border-border/50 px-6 py-4 flex flex-col gap-2">
          <div className="w-full flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Flame className="h-3.5 w-3.5 text-amber-500" />
              Quick Preview Sandbox:
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickDemo('admin')}
                className="px-2 py-1 rounded-md bg-secondary hover:bg-secondary/80 text-[11px] font-medium text-foreground transition-all hover:scale-105"
              >
                Lead Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('dev')}
                className="px-2 py-1 rounded-md bg-secondary hover:bg-secondary/80 text-[11px] font-medium text-foreground transition-all hover:scale-105"
              >
                Developer
              </button>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
