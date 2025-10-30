// netlify/functions/ask-stream.mjs
import { SYSTEM_PROMPT, openai, buildContext } from "./_shared/rag.mjs";

function sse(dataObj) {
  return `data: ${JSON.stringify(dataObj)}\n\n`;
}

export const handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    const payload = event.httpMethod === "POST" ? JSON.parse(event.body || "{}") : {};
    const question = String(payload.question || payload.q || qs.q || "").trim();

    if (!question) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "text/event-stream" },
        body: sse({ error: "Missing 'question'." })
      };
    }

    const { context } = await buildContext(question);

    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.25,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Profile Context:\n${context || "(none)"}\n\nUser Question:\n${question}` }
      ]
    });

    const answer = r.choices?.[0]?.message?.content?.trim() || "I’m not able to answer right now.";
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*"
      },
      body: sse({ answer })
    };
  } catch (err) {
    console.error("ask-stream error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/event-stream" },
      body: sse({ error: process.env.OPENAI_API_KEY ? "Internal error" : "Missing OPENAI_API_KEY" })
    };
  }
};
