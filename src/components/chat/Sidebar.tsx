'use client';

import React, { useState } from 'react';
import { Channel, DirectMessageConversation, User } from '@/types/chat';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Hash,
  Lock,
  Plus,
  Search,
  Settings,
  LogOut,
  Bot,
  MessageSquare,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Bell,
  AtSign,
  Compass,
} from 'lucide-react';

interface SidebarProps {
  channels: Channel[];
  activeChannelId: string;
  onSelectChannel: (channelId: string) => void;
  directMessages: DirectMessageConversation[];
  activeDmId: string | null;
  onSelectDm: (dmId: string) => void;
  currentUser: User;
  onOpenSettings: () => void;
  onLogout: () => void;
  onCreateChannel: (newChannel: { name: string; description: string; isPrivate: boolean }) => void;
}

export function Sidebar({
  channels,
  activeChannelId,
  onSelectChannel,
  directMessages,
  activeDmId,
  onSelectDm,
  currentUser,
  onOpenSettings,
  onLogout,
  onCreateChannel,
}: SidebarProps) {
  const [showChannels, setShowChannels] = useState(true);
  const [showDms, setShowDms] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddChannelOpen, setIsAddChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDms = directMessages.filter((dm) =>
    (dm.user.name || dm.user.email).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateChannelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    onCreateChannel({
      name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
      description: newChannelDesc.trim() || 'General discussion',
      isPrivate,
    });

    setNewChannelName('');
    setNewChannelDesc('');
    setIsPrivate(false);
    setIsAddChannelOpen(false);
  };

  return (
    <aside className="w-64 md:w-72 h-full flex flex-col bg-card/95 border-r border-border/70 select-none backdrop-blur-xl shrink-0">
      {/* Workspace Header */}
      <div className="h-14 border-b border-border/60 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 font-black text-sm">
            CF
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground leading-tight flex items-center gap-1.5">
              <span>ChatFlow Pro</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </h1>
            <p className="text-[10px] text-muted-foreground font-medium">Enterprise Hub</p>
          </div>
        </div>

        <button
          onClick={onOpenSettings}
          title="Workspace Settings"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {/* Quick Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search channels & DMs..."
            className="h-8 pl-8 text-xs rounded-lg bg-secondary/50 border-border/40 focus-visible:ring-1"
          />
        </div>
      </div>

      {/* Navigation Quick Links */}
      <div className="px-3 py-1.5 space-y-0.5 border-b border-border/40 text-xs">
        <button
          onClick={() => onSelectChannel('general')}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors font-medium text-xs"
        >
          <Bell className="h-3.5 w-3.5 text-indigo-400" />
          <span>Activity & Mentions</span>
        </button>
        <button
          onClick={() => onSelectChannel('dev-talk')}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors font-medium text-xs"
        >
          <Compass className="h-3.5 w-3.5 text-purple-400" />
          <span>Discover Channels</span>
        </button>
      </div>

      {/* Scrollable Channels & DMs List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {/* CHANNELS SECTION */}
        <div>
          <div className="flex items-center justify-between text-muted-foreground px-1 mb-1">
            <button
              onClick={() => setShowChannels(!showChannels)}
              className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider hover:text-foreground transition-colors"
            >
              {showChannels ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <span>Channels ({filteredChannels.length})</span>
            </button>
            <button
              onClick={() => setIsAddChannelOpen(true)}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Create Channel"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {showChannels && (
            <div className="space-y-0.5 mt-1">
              {filteredChannels.map((channel) => {
                const isActive = activeChannelId === channel.id && !activeDmId;
                return (
                  <button
                    key={channel.id}
                    onClick={() => onSelectChannel(channel.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-primary text-primary-foreground font-semibold shadow-sm shadow-indigo-500/20'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {channel.isPrivate ? (
                        <Lock className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <Hash className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      )}
                      <span className="truncate">{channel.name}</span>
                    </div>

                    {channel.unreadCount ? (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          isActive
                            ? 'bg-white text-indigo-700'
                            : 'bg-primary text-primary-foreground'
                        }`}
                      >
                        {channel.unreadCount}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* DIRECT MESSAGES SECTION */}
        <div>
          <div className="flex items-center justify-between text-muted-foreground px-1 mb-1">
            <button
              onClick={() => setShowDms(!showDms)}
              className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider hover:text-foreground transition-colors"
            >
              {showDms ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <span>Direct Messages</span>
            </button>
          </div>

          {showDms && (
            <div className="space-y-0.5 mt-1">
              {filteredDms.map((dm) => {
                const isActive = activeDmId === dm.id;
                const isBot = dm.user.role === 'BOT';

                return (
                  <button
                    key={dm.id}
                    onClick={() => onSelectDm(dm.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-primary text-primary-foreground font-semibold shadow-sm shadow-indigo-500/20'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isBot ? (
                        <div className="h-5 w-5 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center shrink-0">
                          <Bot className="h-3 w-3 text-white" />
                        </div>
                      ) : (
                        <Avatar
                          src={dm.user.avatarUrl}
                          fallback={dm.user.name || dm.user.email}
                          size="sm"
                          status={dm.user.status || 'offline'}
                          className="h-5 w-5"
                        />
                      )}
                      <span className="truncate">{dm.user.name}</span>
                    </div>

                    {isBot && (
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
                          isActive
                            ? 'bg-white/30 text-white'
                            : 'bg-indigo-500/20 text-indigo-400'
                        }`}
                      >
                        AI
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* User Footer Profile & Settings */}
      <div className="border-t border-border/70 p-2.5 bg-card/80">
        <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-accent/50 transition-colors">
          <div
            className="flex items-center gap-2.5 truncate cursor-pointer flex-1"
            onClick={onOpenSettings}
          >
            <Avatar
              src={currentUser.avatarUrl}
              fallback={currentUser.name || currentUser.email}
              size="md"
              status={currentUser.status || 'online'}
            />
            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground truncate">
                  {currentUser.name || currentUser.email.split('@')[0]}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase font-mono">
                  {currentUser.role}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">
                {currentUser.statusMessage || currentUser.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={onOpenSettings}
              title="Settings & Linked SSO"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Create Channel Modal */}
      <Dialog open={isAddChannelOpen} onOpenChange={setIsAddChannelOpen}>
        <DialogHeader>
          <DialogTitle>Create a new channel</DialogTitle>
          <DialogDescription>
            Channels are where your team collaborates on specific topics or projects.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateChannelSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="chanName">Channel Name</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                #
              </span>
              <Input
                id="chanName"
                placeholder="e.g. project-roadmap"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                className="pl-8 rounded-xl"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="chanDesc">Description (optional)</Label>
            <Input
              id="chanDesc"
              placeholder="What is this channel about?"
              value={newChannelDesc}
              onChange={(e) => setNewChannelDesc(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isPrivate"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="isPrivate" className="text-xs text-foreground font-medium cursor-pointer">
              Make channel private (only invited members)
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddChannelOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" variant="glow" className="rounded-xl text-xs">
              Create Channel
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </aside>
  );
}
