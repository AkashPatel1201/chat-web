'use client';

import React, { useEffect, useState } from 'react';
import { User } from '@/types/chat';
import { authStorage, api } from '@/lib/api';
import { AuthCard } from '@/components/auth/AuthCard';
import { ChatView } from '@/components/chat/ChatView';
import { Loader2, MessageSquare, ShieldCheck, Sparkles, Zap, Sun, Moon } from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Initialize theme and check existing session
  useEffect(() => {
    // Force dark mode class on html/body for premium visual look
    document.documentElement.classList.add('dark');

    const checkSession = async () => {
      try {
        const storedUser = authStorage.getUser();
        if (storedUser) {
          setUser(storedUser);
          // Try validating / refreshing with backend
          try {
            const freshUser = await api.getMe();
            if (freshUser) setUser(freshUser);
          } catch {
            // keep cached user
          }
        }
      } catch (err) {
        console.warn('Session check failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  };

  const handleLoginSuccess = (authenticatedUser: User) => {
    setUser(authenticatedUser);
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 animate-pulse">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <p className="text-xs text-muted-foreground font-mono animate-pulse">
            Loading ChatFlow...
          </p>
        </div>
      </div>
    );
  }

  // If user is authenticated, render the rich Chat Application
  if (user) {
    return <ChatView currentUser={user} onLogout={handleLogout} />;
  }

  // Otherwise, render the Auth & SSO Login Screen
  return (
    <div className="min-h-screen w-full bg-background flex flex-col justify-between relative overflow-hidden select-none">
      {/* Dynamic Background Mesh Gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-br from-indigo-600/15 via-purple-600/15 to-transparent blur-3xl" />
        <div className="absolute top-[40%] -right-[15%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-tl from-cyan-600/10 via-blue-600/10 to-transparent blur-3xl" />
        <div className="absolute -bottom-[20%] left-[20%] w-[55vw] h-[55vw] rounded-full bg-gradient-to-tr from-pink-600/10 via-purple-600/10 to-transparent blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      {/* Navigation Bar */}
      <header className="relative z-20 w-full px-6 py-4 flex items-center justify-between border-b border-border/40 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 font-bold text-sm">
            CF
          </div>
          <div>
            <span className="text-base font-extrabold tracking-tight text-foreground flex items-center gap-1.5">
              ChatFlow
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-mono font-semibold">
                v2.0
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground font-medium mr-2">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Multi-SSO Ready
            </span>
            <span className="flex items-center gap-1">
              <Zap className="h-3.5 w-3.5 text-amber-400" /> Shadcn UI & Tailwind
            </span>
          </div>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors border border-border/50"
            title="Toggle theme"
          >
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Main Hero & Auth Section */}
      <main className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center px-4 sm:px-8 py-10 gap-12 max-w-7xl mx-auto w-full">
        {/* Left Hero Description */}
        <div className="flex-1 max-w-xl text-center lg:text-left space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>High Performance Collaborative Workspace</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.1]">
            Real-time chat,{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              seamlessly connected.
            </span>
          </h1>

          <p className="text-base text-muted-foreground leading-relaxed">
            Enterprise collaboration with Single Sign-On (Google, GitHub, Microsoft Azure AD, and OIDC) alongside classic email and password authentication. Built with Shadcn UI, Tailwind CSS, and Next.js.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm">
              <p className="text-lg font-bold text-foreground">Multi-SSO</p>
              <p className="text-xs text-muted-foreground">Google, GitHub, Azure & OIDC</p>
            </div>
            <div className="p-3.5 rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm">
              <p className="text-lg font-bold text-foreground">AI Copilot</p>
              <p className="text-xs text-muted-foreground">Smart assistant in channels & DMs</p>
            </div>
            <div className="p-3.5 rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm col-span-2 sm:col-span-1">
              <p className="text-lg font-bold text-foreground">Secure Auth</p>
              <p className="text-xs text-muted-foreground">JWT with rotating refresh tokens</p>
            </div>
          </div>
        </div>

        {/* Right Authentication Card */}
        <div className="w-full flex-1 flex justify-center">
          <AuthCard onSuccess={handleLoginSuccess} />
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full py-4 text-center text-xs text-muted-foreground border-t border-border/40 backdrop-blur-md">
        <span>© 2026 ChatFlow. Powered by Next.js, Shadcn UI, Tailwind CSS & NestJS API.</span>
      </footer>
    </div>
  );
}
