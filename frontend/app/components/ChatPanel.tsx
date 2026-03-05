import { Send } from "lucide-react";
import { type FormEvent, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChatMessage } from "../types";

type ChatPanelProps = {
  canChat: boolean;
  currentUserId: string | null;
  currentUsername: string | null;
  draft: string;
  messages: ChatMessage[];
  onOpenAuth: () => void;
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ChatPanel({
  canChat,
  currentUserId,
  currentUsername,
  draft,
  messages,
  onOpenAuth,
  onDraftChange,
  onSubmit,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <section className="flex flex-col flex-1 min-h-0 pt-1">
      <div className="flex-1 overflow-y-auto rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5 shadow-inner">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full opacity-25">
            <p className="text-xs font-bold uppercase tracking-widest italic">Quiet in here...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {messages.map((message) => (
              <div
                key={message.id}
                className="group px-2 py-1 hover:bg-primary/5 rounded-lg transition-all text-[13px] leading-snug border border-transparent hover:border-primary/10"
              >
                <span className="font-bold text-primary mr-1.5 uppercase text-[10px] tracking-wider">
                  {message.username ??
                    (message.user_id === currentUserId && currentUsername
                      ? currentUsername
                      : message.user_id)}
                </span>
                <span className="text-foreground/90 break-words font-medium">{message.body}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form className="flex gap-2 mt-3 shrink-0" onSubmit={onSubmit}>
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
}
