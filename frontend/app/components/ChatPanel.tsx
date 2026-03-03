import { FormEvent } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "../types";

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
  return (
    <section className="flex flex-col gap-3 h-full max-h-[400px]">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[10px] uppercase tracking-[0.15em] font-bold text-muted-foreground">Room Chat</h2>
        <span className="text-[10px] text-muted-foreground/60">{messages.length} messages</span>
      </div>
      
      <ScrollArea className="flex-1 rounded-xl border border-white/5 bg-black/20 p-3">
        <div className="flex flex-col gap-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center opacity-30">
              <p className="text-xs italic">No messages yet. Be the first!</p>
            </div>
          ) : (
            messages.map((message) => (
              <article key={message.id} className="group">
                <header className="flex items-baseline gap-2 mb-0.5">
                  <strong className="text-xs font-bold text-primary/90">{message.user_id}</strong>
                  <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    {new Date(message.sent_at_unix_ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </header>
                <p className="text-sm text-foreground/90 leading-relaxed bg-white/5 rounded-lg rounded-tl-none p-2 px-3 border border-white/5">
                  {message.body}
                </p>
              </article>
            ))
          )}
        </div>
      </ScrollArea>

      <form className="flex gap-2" onSubmit={onSubmit}>
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
