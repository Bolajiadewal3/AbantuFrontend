import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CarerIncidentGuide from "./CarerIncidentGuide";

describe("GUIDE-001 incident guide", () => {
  it("shows immediate-safety guidance", () => {
    render(<CarerIncidentGuide />);

    expect(
      screen.getByRole("heading", {
        name: "Immediate danger or urgent medical need",
      }),
    ).toBeTruthy();
    expect(screen.getByText(/Do not delay urgent help/)).toBeTruthy();
  });
});