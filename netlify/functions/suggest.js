export const handler = async () => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([
      "What are your strongest technical skills?",
      "What are the top three projects on your résumé and what did you solve?",
      "Summarize your experience in two sentences.",
      "What impact did you make in your last role?",
      "Which tools and frameworks do you use most?",
      "What roles are you targeting next?",
      "Tell me about a time you solved a hard problem.",
      "How does Ridha-GPT work?"
    ])
  };
};
