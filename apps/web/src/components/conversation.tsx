'use client';

import { MAX_BODY_CHARS } from '@lm/contracts';
import { useEffect, useRef, useState } from 'react';
import { initials } from '@/lib/format';
import { useConversation } from '@/lib/use-conversation';

export function Conversation({
  collaborationId,
  side,
  counterpartName
}: {
  collaborationId: string;
  side: 'brand' | 'creator';
  counterpartName: string;
}) {
  const { messages, pending, status, error, send, retry } = useConversation(collaborationId, side);
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length, pending.length]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(draft);
    setDraft('');
  }

  const remaining = MAX_BODY_CHARS - draft.length;

  return (
    <section className="convo">
      <header className="convo-head">
        <span className="av">{initials(counterpartName)}</span>
        <div>
          <div className="convo-name">{counterpartName}</div>
          <div className="convo-sub">
            {messages.length} message{messages.length === 1 ? '' : 's'}
          </div>
        </div>
      </header>

      <div className="convo-body">
        {messages.length === 0 && pending.length === 0 ? (
          <p className="convo-empty">
            Nothing here yet. Messages are kept with the assignment, so anything agreed in here stays
            attached to it.
          </p>
        ) : null}

        {messages.map((message) => (
          <article key={message.id} className={`bubble ${message.sender === side ? 'mine' : ''}`}>
            <div className="bubble-meta">
              {message.senderName} ·{' '}
              {new Date(message.createdAt).toLocaleTimeString('en-IE', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
            <div className="bubble-body">{message.body}</div>
          </article>
        ))}

        {pending.map((item) => (
          <article key={item.id} className="bubble mine pending" data-failed={item.state === 'failed' ? '1' : undefined}>
            <div className="bubble-meta">
              {item.state === 'failed' ? (
                <>
                  Not sent ·{' '}
                  <button type="button" className="bubble-retry" onClick={() => retry(item.id)}>
                    Try again
                  </button>
                </>
              ) : (
                'Sending'
              )}
            </div>
            <div className="bubble-body">{item.body}</div>
          </article>
        ))}

        <div ref={endRef} />
      </div>

      {error ? <div className="convo-error">{error}</div> : null}

      <form className="convo-compose" onSubmit={submit}>
        <input
          value={draft}
          maxLength={MAX_BODY_CHARS}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={status === 'live' ? 'Write a message' : 'Reconnecting, you can still type'}
        />
        {remaining < 200 ? <span className="convo-count">{remaining}</span> : null}
        <button className="btn" type="submit" disabled={draft.trim().length === 0}>
          Send
        </button>
      </form>
    </section>
  );
}
