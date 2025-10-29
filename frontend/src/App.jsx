// frontend/src/App.jsx
import { useState, useRef } from 'react';
import SuggestedPrompts from './components/SuggestedPrompts.jsx';

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        "Hi, I'm Ridha-GPT. Ask me anything about my resume, and I'll answer based on the details I have."
    }
  ]);
  const [input, setInput] = useState('');
  const sendingRef = useRef(false);

  async function send(questionMaybe) {
    if (sendingRef.current) return; // prevent double-sends
    const q = (questionMaybe ?? input).trim();
    if (!q) return;

    sendingRef.current = true;
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setInput('');

    try {
      const res = await fetch('/.netlify/functions/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q })
      });

      // even on 500, try to parse body for consistency
      let data = {};
      try { data = await res.json(); } catch {}

      const answer =
        data?.answer ??
        (res.ok
          ? 'Sorry, something went wrong while I was trying to answer that.'
          : 'Sorry, the server returned an error trying to answer that.');

      setMessages((m) => [...m, { role: 'assistant', content: answer }]);
      if (data?._metrics?.server_ms != null) {
        console.log('server_ms =', data._metrics.server_ms);
      }
    } catch (e) {
      console.error(e);
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'Sorry, something went wrong while I was trying to answer that.' }
      ]);
    } finally {
      sendingRef.current = false;
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: 'min(900px, 95vw)', padding: '1.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem' }}>Ridha-GPT — A Personal AI Assistant</h1>
        <p style={{ opacity: 0.85, marginTop: '0.4rem' }}>
          Built to answer questions about Ridha’s experience using only the resume data.
        </p>

        {/* Suggested questions */}
        <SuggestedPrompts onPick={(p) => send(p)} />

        {/* Chat region */}
        <div
          style={{
            marginTop: '1rem',
            borderRadius: '16px',
            padding: '1rem',
            background: 'rgba(255,255,255,0.05)'
          }}
        >
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: '0.75rem', display: 'flex' }}>
              <div
                style={{
                  maxWidth: '80%',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '12px',
                  background: m.role === 'user' ? 'rgba(140, 84, 255, 0.2)' : 'rgba(255,255,255,0.06)'
                }}
              >
                <div style={{ opacity: 0.75, fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                  {m.role === 'user' ? 'YOU' : 'RIDHA-GPT'}
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Input row */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question here..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            style={{
              flex: 1,
              padding: '0.75rem 0.9rem',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.06)',
              color: 'inherit'
            }}
          />
          <button
            type="button"
            onClick={() => send()}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(140, 84, 255, 0.25)',
              color: 'inherit',
              cursor: 'pointer'
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
