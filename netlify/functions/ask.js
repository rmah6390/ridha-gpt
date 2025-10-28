// netlify/functions/ask.js
import fs from "fs/promises";
import path from "path";
import url from "url";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { question = "" } = JSON.parse(event.body || "{}");
    const lower = question.toLowerCase();

    // Load resume.json to build context when needed
    const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..", "..");
    const resumePath = path.join(repoRoot, "frontend", "src", "data", "resume.json");
    const resume = JSON.parse(await fs.readFile(resumePath, "utf-8"));

    const skills = (resume.technical_skills?.programming_languages || resume.skills || []).join(", ");
    const exp = (resume.experience || [])
      .map(e => `${e.role} at ${e.company} (${e.start}–${e.end})`)
      .join("; ");
    const projects = (resume.projects || [])
      .map(p => `${p.name}${Array.isArray(p.details) ? ` — ${p.details[0]}` : p.desc ? ` — ${p.desc}` : ""}`)
      .join("; ");
    const education = (resume.education || [])
      .map(e => `${e.degree} at ${e.school} (${e.expected_graduation || e.year})`)
      .join("; ");

    const context = [
      resume.name && `Name: ${resume.name}`,
      resume.title && `Title: ${resume.title}`,
      skills && `Skills: ${skills}`,
      exp && `Experience: ${exp}`,
      projects && `Projects: ${projects}`,
      education && `Education: ${education}`
    ].filter(Boolean).join("\n");

    // Simple classifier: is this about Ridha (use resume) or general (use model’s knowledge)?
    const personalKeywords = [
      "ridha","résumé","resume","cv","experience","project","projects",
      "skills","education","gpa","university","school","role","job","about me","about ridha","your "
    ];
    const isPersonal = personalKeywords.some(k => lower.includes(k));

    const system = isPersonal
      ? `You are Ridha-GPT, a personal assistant that answers questions about Ridha Mahmood using ONLY the provided resume context.
Always respond in complete sentences. If the resume context does not contain the answer, say exactly: "I cannot confirm this from my resume."`
      : `You are a helpful assistant. Answer clearly and concisely in full sentences.`;

    const userContent = isPersonal
      ? `Resume context:\n${context}\n\nUser question: ${question}`
      : question;

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent }
      ]
    });

    const answer = resp.choices?.[0]?.message?.content?.trim()
      || (isPersonal ? "I cannot confirm this from my resume." : "Sorry, I couldn't produce an answer.");

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer }) };
  } catch (err) {
    console.error("ask.js error:", err);
    const msg = process.env.OPENAI_API_KEY ? "internal" : "missing OPENAI_API_KEY";
    return { statusCode: 500, body: JSON.stringify({ error: msg }) };
  }
};
