import { SYSTEM_PROMPT, openai, buildContext } from "./_shared/rag.js";

export const handler = async (event) => {
  try {
    const { question } = event.queryStringParameters || {};
    const body = event.body && !question ? JSON.parse(event.body) : null;
    const q = question ?? body?.question ?? body?.q ?? '';

    const answer = await getAnswer(q);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer })
    };
  } catch (err) {
    console.error('ASK FUNCTION ERROR:', err);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
}
