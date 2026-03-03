import { FormEvent } from "react";

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
    <section className="chat-panel">
      <h2>Room Chat</h2>
      <div className="chat-log">
        {messages.map((message) => (
          <article key={message.id} className="msg">
            <header>
              <strong>{message.user_id}</strong>
              <span>
                {new Date(message.sent_at_unix_ms).toLocaleTimeString()}
              </span>
            </header>
            <p>{message.body}</p>
          </article>
        ))}
      </div>
      <form className="composer" onSubmit={onSubmit}>
        <input
          aria-label="Message"
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Send a message"
          value={draft}
        />
        <button type="submit">Send</button>
      </form>
    </section>
  );
}
