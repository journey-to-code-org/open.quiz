import { useState } from "react";

import Button from "../../../../shared/Button/Button.component";

import {
  getQuizFeedbackPreference,
  setQuizFeedbackPreference,
} from "../../../../utils/quizFeedbackPreference";

export default function QuizFeedbackSetting({ onChange }) {
  const [feedbackPreference, setFeedbackPreference] = useState(() => getQuizFeedbackPreference());
  function toggleFeedbackPreference() {
    // Persist preference in localStorage and notify parent (if provided).
    setFeedbackPreference((current) => {
      const next = current === "immediate" ? "end" : "immediate";
      setQuizFeedbackPreference(next);
      onChange?.(next);
      return next;
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-neutral-600">
        Feedback: {feedbackPreference === "immediate" ? "Instant" : "At the end"}
      </span>
      <Button variant="quizSecondary" size="sm" onClick={toggleFeedbackPreference}>
        Toggle
      </Button>
    </div>
  );
}
