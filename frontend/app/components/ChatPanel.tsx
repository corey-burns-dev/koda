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
    <section className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto rounded-lg border border-white/[0.05] bg-black/20 px-2 py-2">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full opacity-25">
            <p className="text-xs italic">No messages yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-0">
            {messages.map((message) => (
              <div
                key={message.id}
                className="group px-1.5 py-0.5 hover:bg-white/[0.03] rounded transition-colors text-xs leading-relaxed"
              >
                <span className="font-semibold text-primary/80 mr-1">
                  {message.username ??
                    (message.user_id === currentUserId && currentUsername
                      ? currentUsername
                      : message.user_id)}
                  :
                </span>
                <span className="text-foreground/80 break-words">{message.body}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form className="flex gap-1.5 mt-2 shrink-0" onSubmit={onSubmit}>
        <Input
          aria-label="Message"
          className="flex-1 h-8 text-xs bg-white/[0.04] border-white/[0.08] focus-visible:ring-primary/40 placeholder:text-muted-foreground/40"
          disabled={!canChat}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={canChat ? "Say something…" : "Sign in to chat"}
          value={draft}
        />
        {canChat ? (
          <Button
            aria-label="Send"
            type="submit"
            size="icon"
            className="h-8 w-8 shrink-0 bg-primary hover:bg-primary/90"
          >
            <Send size={14} />
          </Button>
        ) : (
          <Button
            aria-label="Sign in"
            type="button"
            size="sm"
            className="h-8 shrink-0 text-xs font-semibold"
            onClick={onOpenAuth}
          >
            Sign in
          </Button>
        )}
      </form>
    </section>
  );
}
