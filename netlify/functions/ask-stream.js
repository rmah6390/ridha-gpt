import { SYSTEM_PROMPT, openai, buildContext } from "./_shared/rag.js";

export const handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    const payload = event.httpMethod === "POST" ? JSON.parse(event.body || "{}") : {};
    const question = String(payload.question || payload.q || qs.q || "").trim();
    if (!question) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "text/event-stream" },
        body: "data: " + JSON.stringify({ error: "Missing 'question'." }) + "\n\n"
      };
    }

    const lower = question.toLowerCase();
    const isPersonal =
      /\bridha\b|\brésumé\b|\bresume\b|\bcv\b|\bexperience\b|\bproject(s)?\b|\bskills?\b|\beducation\b|\buniversity\b|\bschool\b|\brole\b|\bcompany\b|\bgpa\b|\babout (me|ridha)\b/.test(lower);

    let answer;
    if (!isPersonal) {
      const r = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          { role: "system", content: "You are a helpful assistant. Answer clearly in complete sentences." },
          { role: "user", content: question }
        ]
      });
      answer = r.choices?.[0]?.message?.content?.trim() ?? "Sorry, I couldn’t generate an answer.";
    } else {
      const { context } = await buildContext(question);
      const r = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` }
        ]
      });
      answer = r.choices?.[0]?.message?.content?.trim() ?? "I cannot confirm this from my resume.";
    }

    // simple, single-chunk SSE so most UIs that expect /ask-stream still work
    const body = `data: ${JSON.stringify({ answer })}\n\n`;
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*"
      },
      body
    };
  } catch (err) {
    console.error("ask-stream error:", err);
    const body = `data: ${JSON.stringify({ error: process.env.OPENAI_API_KEY ? "Internal error" : "Missing OPENAI_API_KEY" })}\n\n`;
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/event-stream" },
      body
    };
  }
};
