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
