import { createContext } from "react";

export const STORAGE_KEY = "sia-theme";

export const ThemeContext = createContext(null);

export function isValidTheme(value) {
    return value === "light" || value === "dark" || value === "system";
}

export function readStoredTheme() {
    try {
        const value = localStorage.getItem(STORAGE_KEY);
        return isValidTheme(value) ? value : "system";
    } catch {
        return "system";
    }
}

export function getSystemPrefersDark() {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
