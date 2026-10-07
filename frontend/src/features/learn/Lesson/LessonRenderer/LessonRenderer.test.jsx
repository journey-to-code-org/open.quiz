import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import LessonRenderer from "./LessonRenderer.component";
import { lessonBlockRenderers } from "../../../../contentPackages/examples/openquiz-introduction";

const moduleData = {
  tables: [
    {
      tableId: "platform-layers",
      title: "Platform layers",
      headers: ["Layer", "Responsibility"],
      rows: [["Core", "Accounts and learning flow"]],
    },
  ],
};

describe("LessonRenderer", () => {
  it("renders every supported lesson content type", async () => {
    const user = userEvent.setup();

    // Start with one content type and reuse the same render for the rest of the supported types.
    const { rerender } = render(
      <LessonRenderer content={{ type: "paragraph", text: "Paragraph text" }} />,
    );

    expect(screen.getByText("Paragraph text")).toBeInTheDocument();

    rerender(<LessonRenderer content={{ type: "characterIntro", text: "Meet Nova" }} />);
    expect(screen.queryByText("Meet Nova")).not.toBeInTheDocument();

    rerender(
      <LessonRenderer
        content={{ type: "characterIntro", text: "Meet Nova" }}
        blockRenderers={lessonBlockRenderers}
      />,
    );
    expect(screen.getByText("Meet Nova")).toBeInTheDocument();

    rerender(
      <LessonRenderer content={{ type: "formula", text: "Income - Expenses = Cash Flow" }} />,
    );
    expect(screen.getByText("Income - Expenses = Cash Flow")).toBeInTheDocument();

    rerender(<LessonRenderer content={{ type: "callout", text: "Remember this" }} />);
    expect(screen.getByText("Key Takeaway")).toBeInTheDocument();
    expect(screen.getByText("Remember this")).toBeInTheDocument();

    rerender(
      <LessonRenderer
        content={{ type: "unorderedList", intro: "Track these:", items: ["Income", "Expenses"] }}
      />,
    );
    expect(screen.getByText("Track these:")).toBeInTheDocument();
    expect(screen.getByRole("list")).toHaveTextContent("Income");

    // Knowledge checks need a little interaction before their feedback is shown.
    rerender(
      <LessonRenderer
        content={{
          type: "knowledgeCheck",
          question: "What should you track?",
          answerChoices: [{ key: "a", text: "Expenses" }],
          correctResponse: "a",
          explanation: "Track expenses.",
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Expenses" }));
    await user.click(screen.getByRole("button", { name: "Check Answer" }));
    expect(screen.getByText("✅ Correct!")).toBeInTheDocument();

    // Tables render generic columns and rows from module data.
    rerender(
      <LessonRenderer
        content={{ type: "table", tableId: "platform-layers" }}
        module={moduleData}
      />,
    );
    expect(screen.getByRole("table", { name: "Platform layers" })).toHaveTextContent(
      "CoreAccounts and learning flow",
    );
  });

  it("renders safe fallbacks for missing or unknown content", () => {
    // Missing content should show the normal empty fallback.
    const { rerender } = render(<LessonRenderer />);
    expect(screen.getByText("No content found")).toBeInTheDocument();

    // Unknown future content types should fail quietly instead of showing raw content data.
    rerender(<LessonRenderer content={{ type: "future-block" }} />);
    expect(screen.queryByText("No content found")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("future-block");
  });
});
