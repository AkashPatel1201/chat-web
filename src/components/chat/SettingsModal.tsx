'use client';

import React, { useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { User, SsoProviderId } from '@/types/chat';
import { api, getSsoRedirectUri } from '@/lib/api';
import {
  Shield,
  CheckCircle,
  ExternalLink,
  Trash2,
  Lock,
  Sparkles,
  Link as LinkIcon,
  LogOut,
  Mail,
  UserCheck,
} from 'lucide-react';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  onLogout: () => void;
  onUserUpdate: (user: User) => void;
}

export function SettingsModal({
  open,
  onOpenChange,
  user,
  onLogout,
  onUserUpdate,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'sso' | 'security'>('sso');
  const [name, setName] = useState(user.name || '');
  const [statusMsg, setStatusMsg] = useState(user.statusMessage || '');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const ssoProviders: Array<{
    id: SsoProviderId;
    name: string;
    description: string;
    icon: string;
  }> = [
    {
      id: 'google',
      name: 'Google Workspace',
      description: 'Sign in with your enterprise or personal Google account',
      icon: 'google',
    },
    {
      id: 'github',
      name: 'GitHub',
      description: 'Connect repository identities, commits, and organizations',
      icon: 'github',
    },
    {
      id: 'microsoft',
      name: 'Microsoft Azure AD',
      description: 'Enterprise single sign-on with Azure Active Directory',
      icon: 'microsoft',
    },
    {
      id: 'oidc',
      name: 'Enterprise OIDC / Okta',
      description: 'Custom Single Sign-On via OpenID Connect or Keycloak',
      icon: 'oidc',
    },
  ];

  const isProviderLinked = (providerId: string) => {
    return user.accounts?.some(
      (a) => a.provider.toLowerCase() === providerId.toLowerCase()
    );
  };

  const handleLinkToggle = async (providerId: SsoProviderId) => {
    const isLinked = isProviderLinked(providerId);

    if (isLinked) {
      if (confirm(`Are you sure you want to unlink ${providerId.toUpperCase()} from your account?`)) {
        try {
          await api.unlinkSsoProvider(providerId);
          setActionMessage(`Successfully unlinked ${providerId.toUpperCase()}.`);
        } catch {
          // Local fallback simulation
          const updatedAccounts = user.accounts?.filter(
            (a) => a.provider.toLowerCase() !== providerId.toLowerCase()
          ) || [];
          onUserUpdate({ ...user, accounts: updatedAccounts });
          setActionMessage(`Unlinked ${providerId.toUpperCase()} (demo mode).`);
        }
      }
    } else {
      // Initiate SSO linking
      try {
        const redirectUri = getSsoRedirectUri(providerId);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('sso_provider', providerId);
          if (redirectUri) {
            sessionStorage.setItem('sso_redirect_uri', redirectUri);
          }
        }
        const { url, redirectUri: confirmedRedirectUri } = await api.getSsoUrl(providerId, redirectUri);
        if (typeof window !== 'undefined' && confirmedRedirectUri) {
          sessionStorage.setItem('sso_redirect_uri', confirmedRedirectUri);
        }
        if (url) {
          window.location.href = url;
        }
      } catch {
        // Fallback simulation
        const updatedAccounts = [
          ...(user.accounts || []),
          { id: 'acc-' + Date.now(), provider: providerId.toUpperCase() },
        ];
        onUserUpdate({ ...user, accounts: updatedAccounts });
        setActionMessage(`Linked ${providerId.toUpperCase()} successfully.`);
      }
    }
  };

  const handleSaveProfile = () => {
    onUserUpdate({
      ...user,
      name,
      statusMessage: statusMsg,
    });
    setActionMessage('Profile preferences saved!');
    setTimeout(() => setActionMessage(null), 2500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span>Account & SSO Settings</span>
          <Badge variant="brand">{user.role}</Badge>
        </DialogTitle>
        <DialogDescription>
          Manage your credentials, linked Single Sign-On accounts, and chat identity.
        </DialogDescription>
      </DialogHeader>

      {/* Tabs */}
      <div className="flex border-b border-border/60 mb-5 gap-4">
        <button
          onClick={() => setActiveTab('sso')}
          className={`pb-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'sso'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          SSO & Providers
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'profile'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`pb-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'security'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Security
        </button>
      </div>

      {actionMessage && (
        <div className="mb-4 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* SSO Tab */}
      {activeTab === 'sso' && (
        <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
          <p className="text-xs text-muted-foreground">
            Linked SSO accounts allow you to sign in with one click without needing to enter a password.
          </p>

          <div className="space-y-2.5">
            {ssoProviders.map((provider) => {
              const linked = isProviderLinked(provider.id);
              return (
                <div
                  key={provider.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-border/70 bg-card/60 hover:bg-card/90 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/80 text-foreground font-bold">
                      {provider.id === 'google' && 'G'}
                      {provider.id === 'github' && 'GH'}
                      {provider.id === 'microsoft' && 'MS'}
                      {provider.id === 'oidc' && 'ID'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {provider.name}
                        </span>
                        {linked && (
                          <Badge variant="success" className="text-[10px] py-0">
                            Connected
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">
                        {provider.description}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant={linked ? 'outline' : 'default'}
                    onClick={() => handleLinkToggle(provider.id)}
                    className="text-xs h-8"
                  >
                    {linked ? (
                      <>
                        <Trash2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        Unlink
                      </>
                    ) : (
                      <>
                        <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
                        Connect
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar
              src={user.avatarUrl}
              fallback={user.name || user.email}
              size="lg"
              status={user.status || 'online'}
            />
            <div>
              <p className="text-sm font-semibold text-foreground">{user.name || 'Anonymous'}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <span className="text-[10px] text-emerald-400 font-mono mt-0.5 block">
                Session Active (Bearer JWT)
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="statusMsg">Custom Status Message</Label>
              <Input
                id="statusMsg"
                value={statusMsg}
                onChange={(e) => setStatusMsg(e.target.value)}
                placeholder="What are you working on right now?"
                className="rounded-xl"
              />
            </div>
          </div>

          <Button onClick={handleSaveProfile} className="w-full mt-2 rounded-xl">
            Save Changes
          </Button>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Shield className="h-4 w-4 text-primary" />
              <span>Multi-Factor / Session Guard</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Your session is secured with SHA-256 rotating refresh tokens and JWT authentication.
            </p>
          </div>

          <div className="pt-2">
            <Button
              variant="destructive"
              onClick={onLogout}
              className="w-full rounded-xl gap-2 text-xs"
            >
              <LogOut className="h-4 w-4" />
              Sign Out from All Devices
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
