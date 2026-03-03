import { type FormEvent, useEffect, useRef } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChatMessage } from "../types";

type ChatPanelProps = {
  draft: string;
  messages: ChatMessage[];
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ChatPanel({
  draft,
  messages,
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
      <div className="flex-1 overflow-y-auto rounded-xl border border-white/5 bg-black/20 p-3">
        <div className="flex flex-col gap-1">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center opacity-30">
              <p className="text-xs italic">No messages yet. Be the first!</p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="group leading-relaxed py-0.5 px-2 hover:bg-white/5 rounded transition-colors text-sm">
                <span className="font-bold text-primary/90 mr-1.5">{message.user_id}:</span>
                <span className="text-foreground/90 break-words">
                  {message.body}
                </span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <form className="flex gap-2 mt-3 shrink-0" onSubmit={onSubmit}>
        <Input
          aria-label="Message"
          className="flex-1 bg-white/5 border-white/10 focus-visible:ring-primary/50"
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Send a message..."
          value={draft}
        />
        <Button aria-label="Send" type="submit" size="icon" className="shrink-0 bg-primary hover:bg-primary/90">
          <Send size={16} />
        </Button>
      </form>
    </section>
  );
}
