export const handler = async () => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([
      "Summarize my experience in a few sentences.",
      "What are the top 3 projects on my résumé and what did I do on each?",
      "Which skills do I highlight most in my resume?",
      "What impact did I make in my last role?",
      "What roles am I targeting next?",
      "What are my strongest technical skills?",
      "How does Ridha-GPT work?"
    ])
  };
};
