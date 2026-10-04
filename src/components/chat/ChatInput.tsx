'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Send,
  Paperclip,
  Smile,
  Bold,
  Italic,
  Code,
  List,
  Mic,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { Attachment } from '@/types/chat';

interface ChatInputProps {
  placeholder?: string;
  onSendMessage: (content: string, attachments?: Attachment[]) => void;
  isAiResponding?: boolean;
  onTyping?: () => void;
  onStopTyping?: () => void;
}

const EMOJI_PALETTE = ['😀', '🔥', '🚀', '❤️', '🎉', '👍', '👀', '💡', '✨', '⚡', '💯', '🙌', '💻', '🥳', '😎', '🤖'];

export function ChatInput({
  placeholder = 'Type a message... (Shift + Enter for new line)',
  onSendMessage,
  isAiResponding,
  onTyping,
  onStopTyping,
}: ChatInputProps) {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if ((!text.trim() && attachments.length === 0) || isAiResponding) return;

    onStopTyping?.();
    onSendMessage(text.trim(), attachments.length > 0 ? attachments : undefined);
    setText('');
    setAttachments([]);
    setShowEmojiPicker(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInsertFormatting = (prefix: string, suffix: string = '') => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const selectedText = text.substring(start, end);
    const newText =
      text.substring(0, start) +
      prefix +
      (selectedText || 'text') +
      suffix +
      text.substring(end);

    setText(newText);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(
          start + prefix.length,
          end + prefix.length
        );
      }
    }, 0);
  };

  const handleAddEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: Attachment[] = Array.from(files).map((file, i) => ({
      id: 'att-' + Date.now() + '-' + i,
      name: file.name,
      url: URL.createObjectURL(file),
      size: `${(file.size / 1024).toFixed(1)} KB`,
      type: file.type.startsWith('image') ? 'image' : 'file',
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="relative p-4 border-t border-border/70 bg-card/60 backdrop-blur-xl">
      {/* File Attachments Previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 p-2 rounded-xl bg-card border border-border">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary text-xs text-foreground font-medium"
            >
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate max-w-[140px]">{att.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                className="p-0.5 rounded hover:bg-destructive/20 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Input Box */}
      <div className="relative rounded-2xl border border-border/80 bg-background/80 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-lg overflow-hidden">
        {/* Formatting Toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40 bg-muted/20 text-muted-foreground">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleInsertFormatting('**', '**')}
              title="Bold"
              className="p-1 rounded hover:bg-accent hover:text-foreground transition-colors"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleInsertFormatting('*', '*')}
              title="Italic"
              className="p-1 rounded hover:bg-accent hover:text-foreground transition-colors"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleInsertFormatting('```\n', '\n```')}
              title="Code Block"
              className="p-1 rounded hover:bg-accent hover:text-foreground transition-colors"
            >
              <Code className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleInsertFormatting('- ')}
              title="Bullet List"
              className="p-1 rounded hover:bg-accent hover:text-foreground transition-colors"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>

          <span className="text-[10px] text-muted-foreground/70 hidden sm:inline">
            Markdown supported
          </span>
        </div>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.trim()) {
              onTyping?.();
            } else {
              onStopTyping?.();
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          className="w-full resize-none bg-transparent px-3.5 py-2.5 text-xs md:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none max-h-36"
        />

        {/* Action Controls Footer */}
        <div className="flex items-center justify-between px-3 py-2 bg-muted/10 border-t border-border/30">
          <div className="flex items-center gap-1">
            {/* File Upload trigger */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Attach File"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            {/* Emoji picker trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Insert Emoji"
              >
                <Smile className="h-4 w-4" />
              </button>

              {showEmojiPicker && (
                <div className="absolute left-0 bottom-full mb-2 p-2 rounded-2xl bg-card border border-border shadow-2xl backdrop-blur-2xl z-30 grid grid-cols-4 gap-1.5 w-48 animate-in zoom-in-95">
                  {EMOJI_PALETTE.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleAddEmoji(emoji)}
                      className="p-2 text-base hover:scale-125 transition-transform rounded-lg hover:bg-accent flex items-center justify-center"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => alert('Voice memo recorded! (Mock demo)')}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Voice Message"
            >
              <Mic className="h-4 w-4" />
            </button>
          </div>

          {/* Send Button */}
          <Button
            type="button"
            size="sm"
            variant="glow"
            disabled={(!text.trim() && attachments.length === 0) || isAiResponding}
            onClick={handleSend}
            className="h-8 px-3.5 rounded-xl text-xs gap-1.5 font-semibold"
          >
            <span>Send</span>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
