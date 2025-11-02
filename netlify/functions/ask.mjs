import { SYSTEM_PROMPT, openai, buildContext } from "./_shared/rag.mjs";

// Strip stray markdown, normalize pronouns, and sanitize URL formatting
function cleanAndSanitize(s) {
  let out = String(s || "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .replace(/\bHe\b/g, "She")
    .replace(/\bhe\b/g, "she")
    .replace(/\bHis\b/g, "Her")
    .replace(/\bhis\b/g, "her");

  // Fix edge cases like ".https://", collapsed spaces, trailing punctuation on URLs,
  // and remove any "no specific links provided" phrasing.
  out = out
    .replace(/\.https:\/\//g, ". https://")
    .replace(/https:\/\/\s+/g, "https://")
    .replace(/(https?:\/\/[^\s)]+)[\.)]+(?=\s|$)/g, "$1")
    .replace(/no specific links provided.*$/i, "");

  return out.trim();
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
    if (!["GET", "POST"].includes(event.httpMethod)) {
      return json(405, { error: "Method Not Allowed" });
    }

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
        {
          role: "user",
          content: `Profile Context:\n${context || "(none)"}\n\nUser Question:\n${question}`
        }
      ]
    });

    const raw = r.choices?.[0]?.message?.content || "I’m not able to answer right now.";
    const answer = cleanAndSanitize(raw);
    return json(200, { answer });
  } catch (err) {
    console.error("ask error:", err);
    const msg = process.env.OPENAI_API_KEY
      ? `Internal error: ${err.message || String(err)}`
      : "Missing OPENAI_API_KEY";
    return json(500, { error: msg });
  }
};
