import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ColorModeToggle from "./ColorModeToggle.component";
import { useColorMode } from "../../app/instanceAssets";
import { setColorModePreference } from "../../app/instanceTheme";

vi.mock("../../app/instanceAssets", () => ({ useColorMode: vi.fn() }));
vi.mock("../../app/instanceTheme", () => ({ setColorModePreference: vi.fn() }));

const settings = { default: "light", showToggle: true, togglePosition: "header" };

describe("ColorModeToggle", () => {
  beforeEach(() => vi.clearAllMocks());

  it("switches to the other mode from its configured placement", () => {
    useColorMode.mockReturnValue({ mode: "light", settings });
    render(<ColorModeToggle placement="header" />);
    const toggle = screen.getByRole("button", { name: "Dark mode" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(setColorModePreference).toHaveBeenCalledWith("dark");
  });

  it("switches back to light mode", () => {
    useColorMode.mockReturnValue({ mode: "dark", settings });
    render(<ColorModeToggle placement="header" />);
    const toggle = screen.getByRole("button", { name: "Dark mode" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(toggle);
    expect(setColorModePreference).toHaveBeenCalledWith("light");
  });

  it("renders nothing when hidden or placed elsewhere", () => {
    useColorMode.mockReturnValue({ mode: "light", settings: { ...settings, showToggle: false } });
    const { container, rerender } = render(<ColorModeToggle placement="header" />);
    expect(container).toBeEmptyDOMElement();
    useColorMode.mockReturnValue({ mode: "light", settings });
    rerender(<ColorModeToggle placement="footer" />);
    expect(container).toBeEmptyDOMElement();
  });
});
