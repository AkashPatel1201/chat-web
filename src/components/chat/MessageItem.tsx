'use client';

import React, { useState } from 'react';
import { Message, User } from '@/types/chat';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Smile,
  Reply,
  MoreVertical,
  FileText,
  Download,
  Trash2,
  Copy,
  Check,
  Bot,
} from 'lucide-react';

interface MessageItemProps {
  message: Message;
  currentUser: User;
  onReact: (messageId: string, emoji: string) => void;
  onDelete?: (messageId: string) => void;
}

const COMMON_EMOJIS = ['👍', '❤️', '🔥', '🚀', '🎉', '👀'];

export function MessageItem({
  message,
  currentUser,
  onReact,
  onDelete,
}: MessageItemProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [copied, setCopied] = useState(false);

  const isCurrentUser = message.senderId === currentUser.id;
  const isBot = message.senderRole === 'BOT';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Render message formatting (code blocks, bold, etc.)
  const renderFormattedContent = (content: string) => {
    // Check for code blocks ```code```
    if (content.includes('```')) {
      const parts = content.split('```');
      return parts.map((part, index) => {
        if (index % 2 === 1) {
          return (
            <div
              key={index}
              className="my-2 p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 font-mono text-xs text-indigo-300 overflow-x-auto shadow-inner"
            >
              <pre>{part.trim()}</pre>
            </div>
          );
        }
        return <span key={index}>{renderInlineStyles(part)}</span>;
      });
    }
    return renderInlineStyles(content);
  };

  const renderInlineStyles = (text: string) => {
    return text.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {i > 0 && <br />}
        {line}
      </React.Fragment>
    ));
  };

  return (
    <div
      className={`group relative flex gap-3.5 px-4 py-2.5 transition-colors hover:bg-accent/40 rounded-xl ${
        isCurrentUser ? 'bg-primary/5' : ''
      }`}
    >
      {/* Left Avatar */}
      <div className="shrink-0 mt-0.5">
        {isBot ? (
          <div className="h-9 w-9 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Bot className="h-5 w-5" />
          </div>
        ) : (
          <Avatar
            src={message.senderAvatar}
            fallback={message.senderName}
            size="md"
            status={isCurrentUser ? 'online' : 'idle'}
          />
        )}
      </div>

      {/* Message Body */}
      <div className="flex-1 min-w-0">
        {/* Header: Sender Name, Role Badge, Timestamp */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-foreground hover:underline cursor-pointer">
            {message.senderName}
          </span>

          {message.senderRole && (
            <Badge
              variant={
                message.senderRole === 'ADMIN'
                  ? 'destructive'
                  : message.senderRole === 'BOT'
                  ? 'brand'
                  : 'secondary'
              }
              className="text-[9px] px-1.5 py-0 font-mono uppercase"
            >
              {message.senderRole}
            </Badge>
          )}

          <span className="text-[10px] text-muted-foreground font-mono">
            {message.timestamp}
          </span>

          {message.isEdited && (
            <span className="text-[9px] text-muted-foreground">(edited)</span>
          )}
        </div>

        {/* Content */}
        <div className="text-xs md:text-sm text-foreground/90 leading-relaxed break-words font-normal">
          {renderFormattedContent(message.content)}
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {message.attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2 p-2 rounded-xl bg-card border border-border/70 text-xs shadow-sm max-w-xs hover:border-primary/50 transition-colors"
              >
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="truncate flex-1">
                  <p className="font-medium truncate text-foreground">{att.name}</p>
                  <p className="text-[10px] text-muted-foreground">{att.size}</p>
                </div>
                <a
                  href={att.url}
                  download={att.name}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 rounded text-muted-foreground hover:text-foreground"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Reactions List */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.reactions.map((r, i) => {
              const hasReacted = r.users.includes(currentUser.id);
              return (
                <button
                  key={i}
                  onClick={() => onReact(message.id, r.emoji)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all border ${
                    hasReacted
                      ? 'bg-primary/20 border-primary text-primary font-bold shadow-sm'
                      : 'bg-card border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <span>{r.emoji}</span>
                  <span className="text-[10px]">{r.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Toolbar on Hover */}
      <div className="absolute right-4 top-2 hidden group-hover:flex items-center gap-0.5 rounded-xl border border-border/80 bg-card/95 shadow-lg backdrop-blur-md p-1 transition-all z-10">
        {/* Quick Emoji reaction trigger */}
        <div className="relative">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Add Reaction"
          >
            <Smile className="h-4 w-4" />
          </button>

          {showEmojiPicker && (
            <div className="absolute right-0 bottom-full mb-1 flex items-center gap-1 p-1.5 rounded-xl bg-card border border-border shadow-xl backdrop-blur-xl z-20 animate-in zoom-in-95">
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onReact(message.id, emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="p-1 hover:scale-125 transition-transform text-sm"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Copy text */}
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Copy Text"
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>

        {/* Delete if current user */}
        {isCurrentUser && onDelete && (
          <button
            onClick={() => onDelete(message.id)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete Message"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
