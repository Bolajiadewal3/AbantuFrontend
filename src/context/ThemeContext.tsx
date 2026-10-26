import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "dark" | "light" | "system";

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function readThemePreference(): ThemeMode {
  const storedTheme = localStorage.getItem("careapp_theme");
  return storedTheme === "dark" || storedTheme === "light" || storedTheme === "system"
    ? storedTheme
    : "dark";
}

function prefersDarkSystemTheme(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(readThemePreference);
  const [isDark, setIsDark] = useState<boolean>(() => {
    const preference = readThemePreference();
    return preference === "dark" || (preference === "system" && prefersDarkSystemTheme());
  });

  useEffect(() => {
    const root = document.documentElement;
    localStorage.setItem("careapp_theme", theme);

    const applyDark = (dark: boolean) => {
      setIsDark(dark);
      if (dark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    if (theme === "system") {
      const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
      if (!mediaQuery) {
        applyDark(false);
        return;
      }
      applyDark(mediaQuery.matches);

      const handler = (e: MediaQueryListEvent) => applyDark(e.matches);
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    } else {
      applyDark(theme === "dark");
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
