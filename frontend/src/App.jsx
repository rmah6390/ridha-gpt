import { useEffect, useRef, useState } from "react";

const SUGGESTIONS = [
  "Give me a brief summary of Ridha.",
  "What are Ridha’s strongest technical skills?",
  "What projects has Ridha deployed recently?",
];

/* Turn URLs in text into clean clickable links:
   - pre-pass to split any glued '...apphttps://' / '...comhttps://'
   - trims trailing . ) ] , characters that often ride after links
*/
function linkify(input) {
  // NEW: ensure a space before any new https:// if it's glued to the prior token
  const text = String(input).replace(/([A-Za-z0-9._-])(https?:\/\/)/g, "$1 $2");

  const urlRegex = /((https?:\/\/|www\.)[^\s)]+)|(\b[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/[^\s)]*)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (!part) return null;
    const looksLikeUrl =
      /^(https?:\/\/|www\.)/i.test(part) || /\.[a-z]{2,}\//i.test(part);
    if (!looksLikeUrl) return <span key={i}>{part}</span>;
    // remove trailing punctuation such as ).,]
    let cleanText = part.replace(/[)\].,]+$/g, "");
    const href = cleanText.startsWith("http") ? cleanText : `https://${cleanText}`;
    return (
      <a
        key={i}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="underline decoration-violet-600 underline-offset-4 hover:text-violet-300"
      >
        {cleanText}
      </a>
    );
  });
}

function Bubble({ role, children }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={[
          "max-w-[85%] rounded-2xl px-4 py-3 text-[0.95rem] leading-6 shadow-lg",
          isUser ? "bg-violet-600 text-white" : "bg-[#101218] border border-white/10"
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! Ask me anything about Ridha’s experience, skills, and projects." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const ask = async (q) => {
    const question = q ?? input.trim();
    if (!question) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: question }]);
    setLoading(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question })
      });
      const data = await res.json();
      const answer = data.answer || data.error || "Sorry, I couldn’t answer that.";
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Sorry, something went wrong." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur bg-black/30 border-b border-white/10">
        <div className="mx-auto max-w-3xl px-4 py-5 text-center">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            <span className="px-3 py-1 rounded-lg bg-gradient-to-r from-[#5b21b6] to-[#6d28d9]">Ridha-GPT</span>
          </h1>
          <p className="mt-2 text-sm text-white/70">Ask about Ridha’s experiences and projects.</p>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4">
        {/* Suggestions (centered) */}
        <div className="w-full py-4">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="rounded-full border border-white/10 bg-[#101218] px-3 py-1.5 text-xs text-white/90 hover:border-violet-500 hover:text-violet-200 transition"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Chat */}
        <div ref={listRef} className="rounded-xl bg-[#0f1117]/60 border border-white/10 p-4 h-[58vh] overflow-y-auto shadow-xl">
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role}>
              <div className="whitespace-pre-wrap break-words">{linkify(m.content)}</div>
            </Bubble>
          ))}
          {loading && <Bubble role="assistant">Thinking…</Bubble>}
        </div>

        {/* Input */}
        <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="sticky bottom-4 mt-4">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#101218] px-3 py-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-white/40"
            />
            <button type="submit" disabled={loading} className="rounded-lg bg-[#6d28d9] px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-60">
              Send
            </button>
          </div>
        </form>

        <footer className="py-6 text-center text-xs text-white/50">© {new Date().getFullYear()} Ridha Mahmood</footer>
      </main>
    </div>
  );
}
