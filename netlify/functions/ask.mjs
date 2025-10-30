import { SYSTEM_PROMPT, openai, buildContext } from "./_shared/rag.js";

// light post-processing: strip asterisks/backticks just in case
function clean(s) {
  return String(s || "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .trim();
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body)
  };
}

export const handler = async (event) => {
  try {
    if (!["GET", "POST"].includes(event.httpMethod)) return json(405, { error: "Method Not Allowed" });

    const qs = event.queryStringParameters || {};
    const payload = event.httpMethod === "POST" ? JSON.parse(event.body || "{}") : {};
    const question = String(payload.question || payload.q || qs.q || "").trim();
    if (!question) return json(400, { error: "Missing 'question'." });

    const { context } = await buildContext(question);

    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.25,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Profile Context:\n${context || "(none)"}\n\nUser Question:\n${question}` }
      ]
    });

    const answer = clean(r.choices?.[0]?.message?.content) || "I’m not able to answer right now.";
    return json(200, { answer });
  } catch (err) {
    console.error("ask error:", err);
    const msg = process.env.OPENAI_API_KEY ? `Internal error: ${err.message || String(err)}` : "Missing OPENAI_API_KEY";
    return json(500, { error: msg });
  }
};
