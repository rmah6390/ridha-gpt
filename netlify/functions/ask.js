import { SYSTEM_PROMPT, openai, buildContext } from "./_shared/rag.js";

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}

export const handler = async (event) => {
  try {
    if (!["GET", "POST"].includes(event.httpMethod)) return json(405, { error: "Method Not Allowed" });

    const qs = event.queryStringParameters || {};
    const payload = event.httpMethod === "POST" ? JSON.parse(event.body || "{}") : {};
    const question = String(payload.question || payload.q || qs.q || "").trim();
    if (!question) return json(400, { error: "Missing 'question'." });

    const lower = question.toLowerCase();
    const isPersonal = /\bridha\b|\brésumé\b|\bresume\b|\bcv\b|\bexperience\b|\bproject(s)?\b|\bskills?\b|\beducation\b|\buniversity\b|\bschool\b|\brole\b|\bcompany\b|\bgpa\b|\babout (me|ridha)\b/.test(lower);

    if (!isPersonal) {
      const r = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          { role: "system", content: "You are a helpful assistant. Answer clearly in complete sentences." },
          { role: "user", content: question }
        ]
      });
      const answer = r.choices?.[0]?.message?.content?.trim() ?? "Sorry, I couldn’t generate an answer.";
      return json(200, { answer, source: "general" });
    }

    const { context } = await buildContext(question);
    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` }
      ]
    });
    const answer = r.choices?.[0]?.message?.content?.trim() ?? "I cannot confirm this from my resume.";
    return json(200, { answer, source: "resume" });

  } catch (err) {
    console.error("ask error:", err);
    const msg = process.env.OPENAI_API_KEY ? `Internal error: ${err.message || String(err)}` : "Missing OPENAI_API_KEY";
    return json(500, { error: msg });
  }
};

