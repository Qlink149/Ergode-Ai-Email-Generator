/**
 * FormattedText.jsx
 * -------------------
 * Renders `**bold**` markdown as actual bold text. The system prompt (and
 * anything copied from it - anchor_text/new_text on a proposal, the prompt
 * preview/full text on the Version History page) is written in markdown
 * and uses **bold** throughout, but every place that displayed it just
 * dropped the string into a plain <p>/<pre>, so the literal ** characters
 * showed up in the UI instead of the emphasis they were meant to convey.
 * This is deliberately NOT a full markdown renderer (no headers, lists,
 * links) - **bold** is the only syntax actually appearing in this data,
 * so a small regex split covers it without pulling in a markdown library
 * for one feature.
 */
export default function FormattedText({ text }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return part;
      })}
    </>
  );
}
