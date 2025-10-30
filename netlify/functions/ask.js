// netlify/functions/ask.js
import { SYSTEM_PROMPT, openai, buildContext } from "./_shared/rag.js";

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

    // Always build context; model will decide when to use it.
    const { context } = await buildContext(question);

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          "Profile Context:\n" +
          (context || "(none)") +
          "\n\nUser Question:\n" + question
      }
    ];

    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.25,
      messages
    });

    const answer = r.choices?.[0]?.message?.content?.trim() ?? "I’m not able to answer right now.";
    return json(200, { answer });

  } catch (err) {
    console.error("ask error:", err);
    const msg = process.env.OPENAI_API_KEY ? `Internal error: ${err.message || String(err)}` : "Missing OPENAI_API_KEY";
    return json(500, { error: msg });
  }
};
