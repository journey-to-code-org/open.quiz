import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import QuizComponent from "../Quiz.component";
import AnswerMark from "./AnswerMark.component";

const question = {
  id: "question-1",
  prompt: "Pick one",
  type: "singleChoice",
  choices: [
    { id: "a", label: "Right" },
    { id: "b", label: "Wrong" },
  ],
};

function renderReview(selected, icons = {}) {
  return render(
    <QuizComponent
      question={question}
      questionNumber={1}
      totalQuestions={1}
      selectedChoiceIds={[selected]}
      reviewAnswer={{ isCorrect: selected === "a", correctChoiceIds: ["a"], explanation: "" }}
      onChange={() => {}}
      {...icons}
    />,
  );
}

describe("AnswerMark", () => {
  it("draws built-in badges when the theme supplies no images", () => {
    const { container } = render(
      <>
        <AnswerMark correct />
        <AnswerMark correct={false} />
      </>,
    );
    expect(screen.getByRole("img", { name: "Correct answer" }).tagName).toBe("svg");
    expect(screen.getByRole("img", { name: "Incorrect answer" }).tagName).toBe("svg");
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });

  it("uses theme images for correct and incorrect choices", () => {
    renderReview("a", { rightAnswerIcon: "/right.png", wrongAnswerIcon: "/wrong.png" });
    expect(screen.getByRole("img", { name: "Correct answer" })).toHaveAttribute(
      "src",
      "/right.png",
    );
  });

  it("marks a wrong selection with the incorrect image", () => {
    renderReview("b", { rightAnswerIcon: "/right.png", wrongAnswerIcon: "/wrong.png" });
    expect(screen.getByRole("img", { name: "Incorrect answer" })).toHaveAttribute(
      "src",
      "/wrong.png",
    );
    expect(screen.queryByRole("img", { name: "Correct answer" })).not.toBeInTheDocument();
  });

  it("falls back to the built-in badge in quizzes", () => {
    renderReview("b");
    expect(screen.getByRole("img", { name: "Incorrect answer" })).toHaveAttribute(
      "data-answer-mark",
      "incorrect",
    );
  });
});
