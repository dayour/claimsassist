// Color-palette theming. Every accent in the app flows through the CSS custom
// properties --bronze / --bronze-dim (and the sidebar uses --sidebar /
// --sidebar-2), so a theme is just an override block in index.css keyed on
// html[data-theme="<id>"]. This module is the single source of truth for the
// available themes and for applying / persisting the selection.

import { useCallback, useState } from "react";

export interface Theme {
  id: string;
  name: string;
  /** Two representative colors for the picker swatch (accent, sidebar). */
  swatch: [string, string];
}

export const THEMES: Theme[] = [
  { id: "bronze", name: "Bronze Night", swatch: ["#c2a161", "#1b1f2a"] },
  { id: "ocean", name: "Ocean", swatch: ["#38bdf8", "#0f2233"] },
  { id: "forest", name: "Forest", swatch: ["#4ade80", "#122620"] },
  { id: "violet", name: "Violet", swatch: ["#c084fc", "#1c1830"] },
  { id: "crimson", name: "Crimson", swatch: ["#fb7185", "#241519"] },
  { id: "graphite", name: "Graphite", swatch: ["#94a3b8", "#14181f"] },
];

const STORAGE_KEY = "claimstudio.theme";
const DEFAULT_THEME = "bronze";

function isValid(id: string | null | undefined): id is string {
  return !!id && THEMES.some((t) => t.id === id);
}

// localStorage can be unavailable or throw inside a sandboxed/partitioned
// iframe (the Power Apps player), so all access is best-effort.
export function getSavedTheme(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isValid(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

// Apply a theme to the document and persist it. Always updates the DOM even if
// persistence fails, so theming still works for the session.
export function applyTheme(id: string): string {
  const valid = isValid(id) ? id : DEFAULT_THEME;
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = valid;
  }
  try {
    localStorage.setItem(STORAGE_KEY, valid);
  } catch {
    // best-effort persistence
  }
  return valid;
}

// Single-instance hook. Keep this lifted to App and pass the value down so all
// consumers share one source of truth.
export function useTheme(): [string, (id: string) => void] {
  const [theme, setThemeState] = useState<string>(getSavedTheme);
  const setTheme = useCallback((id: string) => {
    setThemeState(applyTheme(id));
  }, []);
  return [theme, setTheme];
}
