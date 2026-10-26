import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeContext";

function ThemeProbe() {
  const { theme, setTheme, isDark } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="dark-state">{String(isDark)}</span>
      <button onClick={() => setTheme("light")}>Light</button>
      <button onClick={() => setTheme("dark")}>Dark</button>
      <button onClick={() => setTheme("system")}>System</button>
    </div>
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  vi.restoreAllMocks();
});

describe("ThemeProvider", () => {
  it("uses explicit light and dark preferences regardless of the OS setting", async () => {
    localStorage.setItem("careapp_theme", "light");
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);

    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(false));
    expect(screen.getByTestId("dark-state").textContent).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true));
    expect(localStorage.getItem("careapp_theme")).toBe("dark");
  });

  it("tracks OS changes only while System mode is selected", async () => {
    let systemPrefersDark = false;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      get matches() { return systemPrefersDark; },
      media: "(prefers-color-scheme: dark)",
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
      addListener: () => undefined,
      removeListener: () => undefined,
      onchange: null,
      dispatchEvent: () => true,
    })));

    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "System" }));
    await waitFor(() => expect(screen.getByTestId("dark-state").textContent).toBe("false"));

    systemPrefersDark = true;
    for (const listener of listeners) listener({ matches: true } as MediaQueryListEvent);
    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true));

    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    systemPrefersDark = false;
    for (const listener of listeners) listener({ matches: false } as MediaQueryListEvent);
    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(false));
  });
});