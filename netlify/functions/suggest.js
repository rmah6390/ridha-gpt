export const handler = async () => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([
      "What are your strongest technical skills?",
      "Tell me about your recent projects.",
      "What impact did you make in your last role?",
      "What roles are you targeting next?",
      "Where are you studying and when do you graduate?",
      "Can you summarize your experience in two sentences?",
      "How does Ridha-GPT work?",
      "What are you learning right now?"
    ])
  };
};
