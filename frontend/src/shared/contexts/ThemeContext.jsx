import { useEffect, useState } from "react";
import { ThemeContext, getSystemPrefersDark, isValidTheme, readStoredTheme, STORAGE_KEY } from "@/shared/contexts/themeValue";

export function ThemeProvider({ children }) {
    const [theme, setThemeState] = useState(readStoredTheme);
    const [systemPrefersDark, setSystemPrefersDark] = useState(getSystemPrefersDark);

    const resolvedTheme = theme === "system" ? (systemPrefersDark ? "dark" : "light") : theme;

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", resolvedTheme);
    }, [resolvedTheme]);

    useEffect(() => {
        if (theme !== "system") return;
        if (typeof window === "undefined" || !window.matchMedia) return;

        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const handler = (event) => setSystemPrefersDark(event.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, [theme]);

    const setTheme = (next) => {
        if (!isValidTheme(next)) return;
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            /* storage no disponible — el tema solo vivirá en memoria */
        }
        setThemeState(next);
    };

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}
