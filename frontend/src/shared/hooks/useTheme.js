import { useContext } from "react";
import { ThemeContext } from "@/shared/contexts/themeValue";

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme debe usarse dentro de un <ThemeProvider>");
    return ctx;
}
