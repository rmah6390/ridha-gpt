// netlify/functions/ask.js  (hybrid: personal + general Q&A)
import { SYSTEM_PROMPT, openai, buildContext } from "./_shared/rag.js";
export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }
    const { question = "" } = JSON.parse(event.body || "{}");
    const qLower = question.toLowerCase();

    // simple classifier: personal vs general
    const isPersonal = /ridha|résumé|resume|cv|about me|about ridha|experience|project|projects|skills|education|university|school|role|company|gpa/.test(qLower);

    if (!isPersonal) {
      // general knowledge answer (OpenAI)
      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          { role: "system", content: "You are a helpful assistant. Answer clearly in complete sentences." },
          { role: "user", content: question }
        ]
      });
      const answer = resp.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't produce an answer.";
      return json({ answer });
    }

    // personal: retrieve resume context then answer
    const { context } = await buildContext(question);
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` }
      ]
    });
    const answer = resp.choices?.[0]?.message?.content?.trim() || "I cannot confirm this from my resume.";
    return json({ answer });

  } catch (err) {
    console.error("ask.js error:", err);
    const msg = process.env.OPENAI_API_KEY ? "internal" : "missing OPENAI_API_KEY";
    return { statusCode: 500, body: JSON.stringify({ error: msg }) };
  }
};

function json(obj) {
  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) };
}
