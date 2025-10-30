import { useEffect, useRef, useState } from "react";

const SUGGESTIONS = [
  "Give me a brief summary of Ridha.",
  "What are Ridha’s strongest technical skills?",
  "What are Ridha’s top 3 projects and what did he do on each?",
  "What roles is Ridha targeting next?",
];

function Bubble({ role, children }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 shadow
          ${isUser ? "bg-violet-600 text-white" : "bg-neutral-800 text-neutral-100"}`}
      >
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi, ask me anything about Ridha’s experience, projects, and skills."
    }
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
    <div className="min-h-screen bg-[#0b0b10] text-neutral-100">
      <header className="sticky top-0 z-10 border-b border-white/10 backdrop-blur bg-[#0b0b10]/80">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-violet-600 grid place-items-center font-semibold">R</div>
          <div>
            <h1 className="text-lg font-semibold">Ridha‑GPT</h1>
            <p className="text-xs text-neutral-400">
              A Personal Ai Assistant about Ridha Mahmood.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4">
        {/* suggestions */}
        <div className="flex flex-wrap gap-2 py-4">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="rounded-full border border-white/10 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 hover:border-violet-500 hover:text-violet-200 transition"
            >
              {s}
            </button>
          ))}
        </div>

        {/* chat */}
        <div
          ref={listRef}
          className="rounded-xl bg-neutral-900/60 border border-white/10 p-4 h-[56vh] overflow-y-auto"
        >
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role}>{m.content}</Bubble>
          ))}
          {loading && <Bubble role="assistant">Thinking…</Bubble>}
        </div>

        {/* input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
          className="sticky bottom-4 mt-4"
        >
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-neutral-900 px-3 py-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60"
            >
              Send
            </button>
          </div>
        </form>

        <footer className="py-6 text-center text-xs text-neutral-500">
          © {new Date().getFullYear()} Ridha Mahmood
        </footer>
      </main>
    </div>
  );
}
