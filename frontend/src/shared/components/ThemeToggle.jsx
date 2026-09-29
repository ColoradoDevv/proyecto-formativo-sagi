import { useRef, useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import clsx from "clsx";
import { Dropdown, DropdownContent, DropdownItem } from "./Dropdown";
import { IconButton } from "./IconButton";
import { useTheme } from "@/shared/hooks/useTheme";

const OPTIONS = [
    { value: "light",  label: "Claro",   Icon: Sun },
    { value: "dark",   label: "Oscuro",  Icon: Moon },
    { value: "system", label: "Sistema", Icon: Monitor },
];

const CURRENT_ICON = {
    light: Sun,
    dark: Moon,
    system: Monitor,
};

export default function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [open, setOpen] = useState(false);
    const triggerRef = useRef(null);

    const CurrentIcon = CURRENT_ICON[theme];
    const activeLabel = OPTIONS.find((o) => o.value === theme)?.label ?? "Sistema";

    return (
        <Dropdown open={open} onOpenChange={setOpen} triggerRef={triggerRef}>
            <IconButton
                ref={triggerRef}
                variant="ghost"
                hitSize={40}
                iconSize={20}
                ariaLabel="Cambiar tema"
                title={`Tema: ${activeLabel}`}
                onClick={() => setOpen((prev) => !prev)}
                isActive={open}
            >
                <CurrentIcon size={20} aria-hidden="true" />
            </IconButton>

            <DropdownContent align="right">
                {OPTIONS.map((option) => {
                    const { value, label, Icon } = option;
                    const isActive = theme === value;
                    return (
                        <DropdownItem
                            key={value}
                            onClick={() => setTheme(value)}
                            className={clsx(
                                "flex items-center gap-2 text-small",
                                isActive ? "text-brand font-medium" : "text-text-primary"
                            )}
                        >
                            <Icon size={16} aria-hidden="true" />
                            <span className="flex-1">{label}</span>
                            {isActive && <Check size={14} aria-hidden="true" />}
                        </DropdownItem>
                    );
                })}
            </DropdownContent>
        </Dropdown>
    );
}
