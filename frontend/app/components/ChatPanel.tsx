import { Send } from "lucide-react";
import { type FormEvent, memo, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChatMessage, PresenceUser, Reaction, TypingUser } from "../types";

const PRESET_EMOJIS = ["👍", "❤️", "😂", "🔥", "👀", "✅"];

type ChatPanelProps = {
  canChat: boolean;
  currentUserId: string | null;
  currentUsername: string | null;
  draft: string;
  messages: ChatMessage[];
  presenceUsers: PresenceUser[];
  reactionsById: Record<string, Reaction[]>;
  typingUsers: TypingUser[];
  onOpenAuth: () => void;
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
};

export const ChatPanel = memo(function ChatPanel({
  canChat,
  currentUserId,
  currentUsername,
  draft,
  messages,
  presenceUsers,
  reactionsById,
  typingUsers,
  onOpenAuth,
  onDraftChange,
  onSubmit,
  onToggleReaction,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);

  useEffect(() => {
    if (messages.length === 0) {
      previousMessageCountRef.current = 0;
      return;
    }

    bottomRef.current?.scrollIntoView({
      behavior: previousMessageCountRef.current === 0 ? "auto" : "smooth",
    });
    previousMessageCountRef.current = messages.length;
  }, [messages]);

  const typingLabel = buildTypingLabel(typingUsers);

  return (
    <section className="flex flex-col flex-1 min-h-0 pt-1">
      {/* Presence bar */}
      {presenceUsers.length > 0 && (
        <div className="flex items-center gap-1.5 px-1 pb-1.5 flex-wrap">
          {presenceUsers.map((u) => (
            <span
              key={u.user_id}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              {u.username}
            </span>
          ))}
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5 shadow-inner">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full opacity-25">
            <p className="text-xs font-bold uppercase tracking-widest italic">Quiet in here...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {messages.map((message) => {
              const reactions = reactionsById[message.id] ?? [];
              return (
                <div
                  key={message.id}
                  className="group relative px-2 py-1 hover:bg-primary/5 rounded-lg transition-all text-[13px] leading-snug border border-transparent hover:border-primary/10"
                >
                  <span className="font-bold text-primary mr-1.5 uppercase text-[10px] tracking-wider">
                    {message.username ??
                      (message.user_id === currentUserId && currentUsername
                        ? currentUsername
                        : message.user_id)}
                  </span>
                  <span className="text-foreground/90 wrap-break-word font-medium">
                    {message.body}
                  </span>

                  {/* Reaction chips */}
                  {reactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {reactions.map((r) => (
                        <button
                          key={r.emoji}
                          type="button"
                          onClick={() => onToggleReaction(message.id, r.emoji)}
                          className={`flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-md border transition-colors ${
                            r.reacted_by_me
                              ? "bg-primary/20 border-primary/40 text-primary"
                              : "bg-muted/40 border-border/40 text-muted-foreground hover:bg-primary/10"
                          }`}
                        >
                          {r.emoji}
                          <span className="font-bold text-[10px]">{r.count}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Emoji picker on hover — pure CSS, always in DOM */}
                  {canChat && (
                    <div className="absolute right-2 top-0.5 flex gap-0.5 bg-background border border-border/60 rounded-lg px-1.5 py-1 shadow-md z-10 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
                      {PRESET_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => onToggleReaction(message.id, emoji)}
                          className="text-base hover:scale-125 transition-transform leading-none"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Typing indicator */}
      <div className="h-4 px-1 mt-0.5">
        {typingLabel && (
          <p className="text-[10px] text-muted-foreground/60 italic font-medium">{typingLabel}</p>
        )}
      </div>

      {/* Input */}
      <form className="flex gap-2 mt-1 shrink-0" onSubmit={onSubmit}>
        <Input
          aria-label="Message"
          className="flex-1 h-9 text-xs bg-muted/40 border-border/40 focus-visible:ring-primary/40 placeholder:text-muted-foreground/40 rounded-xl"
          disabled={!canChat}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={canChat ? "Type a message..." : "Sign in to join the conversation"}
          value={draft}
        />
        {canChat ? (
          <Button
            aria-label="Send"
            type="submit"
            size="icon"
            className="h-9 w-9 shrink-0 bg-primary hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/10"
          >
            <Send size={16} />
          </Button>
        ) : (
          <Button
            aria-label="Sign in"
            type="button"
            size="sm"
            className="h-9 shrink-0 text-xs font-bold uppercase tracking-widest px-4 rounded-xl"
            onClick={onOpenAuth}
          >
            Join
          </Button>
        )}
      </form>
    </section>
  );
});

ChatPanel.displayName = "ChatPanel";

function buildTypingLabel(users: TypingUser[]): string {
  if (users.length === 0) return "";
  if (users.length === 1) return `${users[0].username} is typing…`;
  if (users.length === 2) return `${users[0].username} and ${users[1].username} are typing…`;
  return `${users[0].username} and ${users.length - 1} others are typing…`;
}
