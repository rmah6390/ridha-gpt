// netlify/functions/ask.js
import { getAnswer } from './_shared/rag.js';

export async function handler(event) {
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
