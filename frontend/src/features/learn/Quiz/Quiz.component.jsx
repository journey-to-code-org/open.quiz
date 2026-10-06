import { useId } from "react";
import Card from "../../../shared/Card/Card.component";
import LessonGuideCharacter from "../LessonGuideCharacter/LessonGuideCharacter.component";
import AnswerMark from "./AnswerMark/AnswerMark.component";
import ExpandableWhy from "./ExpandableWhy/ExpandableWhy.component";
import { getEncouragingPhrase, getEncouragingWord } from "./encouragingCopy";

function QuizComponent({
  question,
  questionNumber,
  totalQuestions,
  selectedChoiceIds = [],
  reviewAnswer,
  onChange,
  rightAnswerIcon,
  wrongAnswerIcon,
  characterImage,
  characterAlt = "Lesson guide",
  reviewMode = false,
}) {
  const allowsMultiple = question?.type === "multiSelect";
  const promptId = useId();

  function handleChoice(choiceId) {
    if (!allowsMultiple) {
      onChange([choiceId]);
      return;
    }

    if (selectedChoiceIds.includes(choiceId)) {
      onChange(selectedChoiceIds.filter((selectedChoiceId) => selectedChoiceId !== choiceId));
      return;
    }

    onChange([...selectedChoiceIds, choiceId]);
  }

  if (!question) {
    return null;
  }

  return (
    <div className="mt-8 space-y-6">
      <p className="text-small font-semibold text-primary">
        Question {questionNumber} of {totalQuestions}
      </p>
      <h2 id={promptId} className="font-heading text-h3 font-bold text-heading">
        {question.prompt}
      </h2>

      <div
        role={allowsMultiple ? "group" : "radiogroup"}
        aria-labelledby={promptId}
        className="space-y-3"
      >
        {question.choices.map((choice) => {
          const isSelected = selectedChoiceIds.includes(choice.id);
          const isCorrectChoice = reviewAnswer?.correctChoiceIds?.includes(choice.id);
          const variant =
            reviewAnswer && isSelected ? (reviewAnswer.isCorrect ? "success" : "danger") : "choice";
          const selectedMark =
            reviewAnswer && isSelected ? (isCorrectChoice ? "correct" : "incorrect") : null;

          return (
            <div key={choice.id} className="relative">
              {selectedMark ? (
                <AnswerMark
                  correct={selectedMark === "correct"}
                  imageSrc={selectedMark === "correct" ? rightAnswerIcon : wrongAnswerIcon}
                  className="pointer-events-none absolute -left-6 top-1/2 h-10 w-10 -translate-y-1/2 sm:-left-7 sm:h-12 sm:w-12"
                />
              ) : null}
              <Card
                variant={variant}
                interactive={!reviewAnswer}
                selected={!reviewAnswer && isSelected}
                onClick={reviewAnswer ? undefined : () => handleChoice(choice.id)}
                role={allowsMultiple ? "checkbox" : "radio"}
                aria-checked={isSelected}
                className="px-4 py-3 text-left text-base"
              >
                <div className="flex gap-3">
                  <span className="mt-0.5 font-semibold text-heading">
                    {choice.id.toUpperCase()}.
                  </span>
                  <span>{choice.label}</span>
                  {reviewAnswer && isCorrectChoice ? (
                    <span className="ml-auto text-sm font-semibold text-success">Correct</span>
                  ) : null}
                </div>
              </Card>
            </div>
          );
        })}
      </div>
      {reviewAnswer && reviewMode ? (
        <LessonGuideCharacter imageSrc={characterImage} imageAlt={characterAlt}>
          <div className="space-y-3">
            <ExpandableWhy explanation={reviewAnswer.explanation} />
          </div>
        </LessonGuideCharacter>
      ) : reviewAnswer ? (
        <LessonGuideCharacter
          imageSrc={characterImage}
          imageAlt={characterAlt}
          bubbleText={getEncouragingPhrase(reviewAnswer.isCorrect)}
        >
          <div className="space-y-3">
            <p className="font-semibold text-heading">
              {getEncouragingWord(reviewAnswer.isCorrect)}!
            </p>
            <ExpandableWhy explanation={reviewAnswer.explanation} />
          </div>
        </LessonGuideCharacter>
      ) : null}
    </div>
  );
}

export default QuizComponent;
