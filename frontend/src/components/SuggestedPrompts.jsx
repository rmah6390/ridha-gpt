// frontend/src/components/SuggestedPrompts.jsx
export default function SuggestedPrompts({ onPick }) {
  const prompts = [
    'Summarize my experience in a few sentences.',
    'What are my top 3 projects and what did I do on each?',
    'Which skills do I highlight most in my resume?'
  ];
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
      {prompts.map((p, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick(p)}
          style={{
            border: 'none',
            padding: '0.5rem 0.75rem',
            borderRadius: '999px',
            cursor: 'pointer',
            opacity: 0.95
          }}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
