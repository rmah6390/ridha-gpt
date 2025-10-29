import { useState } from 'react';
import SuggestedPrompts from './components/SuggestedPrompts.jsx';

export default function App() {
  const [input, setInput] = useState('');

  async function send(question) {
    const q = (question ?? input).trim();
    if (!q) return;
    // your existing send logic (fetch /.netlify/functions/ask etc.)
    // ...
  }

  return (
    <div>
      {/* ... your chat history UI ... */}

      <SuggestedPrompts onPick={(p) => { setInput(p); /* or: send(p) */ }} />

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question here..."
          style={{ flex: 1 }}
        />
        <button type="button" onClick={() => send()}>
          Send
        </button>
      </div>
    </div>
  );
}
