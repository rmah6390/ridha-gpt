import { useEffect, useMemo, useRef, useState } from 'react';
import { ask, getSuggestions } from './lib/api.js';

const initialGreeting = "Hi, I'm Ridha-GPT. Ask me anything about my résumé, and I'll answer based on the details I have.";

function MessageBubble({ role, content }) {
  const isUser = role === 'user';
  const bubbleStyles = isUser
    ? 'bg-accent text-white ml-auto'
    : 'bg-surface text-purple-100 border border-white/5';

  return (
    <div
      className={`max-w-xl w-fit rounded-3xl px-5 py-3 shadow-lg ${bubbleStyles}`}
      style={{ wordBreak: 'break-word' }}
    >
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
    </div>
  );
}

function SuggestionChips({ suggestions, onSelect, disabled }) {
  if (!suggestions.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onSelect(suggestion)}
          disabled={disabled}
          className="rounded-full border border-accent/40 bg-surface/80 px-4 py-2 text-xs font-medium text-purple-100 shadow-sm transition hover:border-accent hover:bg-accent/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState([{ role: 'assistant', content: initialGreeting }]);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const scrollAnchorRef = useRef(null);

  useEffect(() => {
    async function loadSuggestions() {
      try {
        const data = await getSuggestions();
        setSuggestions(data.slice(0, 8));
      } catch (error) {
        console.error('Failed to load suggestions', error);
      }
    }

    loadSuggestions();
  }, []);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const canSubmit = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  const submitQuestion = async (questionText) => {
    const question = questionText?.trim() ?? input.trim();
    if (!question) return;

    setInput('');
    setLoading(true);

    setMessages((prev) => [...prev, { role: 'user', content: question }]);

    try {
      const answer = await ask(question);
      setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    } catch (error) {
      console.error('Failed to get answer', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, something went wrong while I was trying to answer that.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    submitQuestion();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSubmit) {
        submitQuestion();
      }
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-white/5 bg-surface/60 px-6 py-5 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 text-center">
          <h1 className="text-2xl font-semibold text-white">Ridha-GPT — your résumé assistant</h1>
          <p className="text-sm text-purple-200/80">
            Built to answer questions about Ridha&apos;s experience using only the résumé data.
          </p>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto flex h-full max-w-4xl flex-col gap-4 px-4 py-6">
          <div className="flex-1 space-y-4 overflow-y-auto rounded-3xl border border-white/5 bg-surface/40 p-5 shadow-inner scrollbar-thin">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className="flex w-full">
                <div className={message.role === 'user' ? 'ml-auto' : 'mr-auto'}>
                  <p className="mb-2 text-xs uppercase tracking-wide text-purple-300/60">
                    {message.role === 'user' ? 'You' : 'Ridha-GPT'}
                  </p>
                  <MessageBubble role={message.role} content={message.content} />
                </div>
              </div>
            ))}
            <div ref={scrollAnchorRef} />
          </div>

          <SuggestionChips suggestions={suggestions} onSelect={submitQuestion} disabled={loading} />

          <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-surface/60 p-4 shadow-xl">
            <label htmlFor="question" className="text-xs font-semibold uppercase tracking-wide text-purple-200/70">
              Ask a question
            </label>
            <textarea
              id="question"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your question here..."
              rows={3}
              className="w-full resize-none rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-sm text-white placeholder:text-purple-200/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/60"
            />
            <div className="flex items-center justify-between text-xs text-purple-200/70">
              <span>{loading ? 'Thinking…' : 'Press Enter to send, Shift+Enter for a new line.'}</span>
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-accentMuted disabled:cursor-not-allowed disabled:opacity-60"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
