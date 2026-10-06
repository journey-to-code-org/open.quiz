/**
 * Quiz feedback mark. Themes may supply answerCorrect/answerIncorrect images;
 * otherwise a built-in round badge in the theme success/danger colors is drawn.
 */
export default function AnswerMark({ correct, imageSrc, className = "" }) {
  const label = correct ? "Correct answer" : "Incorrect answer";
  if (imageSrc) {
    return <img src={imageSrc} alt={label} className={`object-contain ${className}`} />;
  }
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 48 48"
      className={className}
      data-answer-mark={correct ? "correct" : "incorrect"}
    >
      <circle
        cx="24"
        cy="24"
        r="21"
        fill={correct ? "var(--color-success, #287a65)" : "var(--color-danger, #b42318)"}
        stroke="#ffffff"
        strokeWidth="3"
      />
      <path
        d={correct ? "M14 24.5 L21 31.5 L34 17.5" : "M16.5 16.5 L31.5 31.5 M31.5 16.5 L16.5 31.5"}
        fill="none"
        stroke="#ffffff"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
