import { useState } from "react";
import Button from "../../../../../shared/Button/Button.component";

function KnowledgeCheck({ content }) {
  const [selectedAnswer, setSelectedAnswer] = useState(null);

  const [submitted, setSubmitted] = useState(false);

  const isCorrect = selectedAnswer === content.correctResponse;

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">{content.question}</h3>

      <div className="space-y-2">
        {content.answerChoices.map((choice) => (
          <button
            key={choice.key}
            className={`block w-full rounded-lg border p-3 text-left ${
              selectedAnswer === choice.key ? "border-primary bg-primary/10" : "border-neutral-300"
            }`}
            onClick={() => setSelectedAnswer(choice.key)}
          >
            {choice.text}
          </button>
        ))}
      </div>

      {!submitted ? (
        <Button onClick={() => setSubmitted(true)} disabled={!selectedAnswer}>
          Check Answer
        </Button>
      ) : (
        <div className="space-y-2">
          <p className={isCorrect ? "text-success" : "text-danger"}>
            {isCorrect ? "✅ Correct!" : "❌ Not quite."}
          </p>

          <p>{content.explanation}</p>
        </div>
      )}
    </div>
  );
}

export default KnowledgeCheck;
