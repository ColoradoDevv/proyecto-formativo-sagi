import { Check, X } from "lucide-react";

export default function StatusSwitch({
    checked = false,
    onChange,
    disabled = false,
    className,
    size = "md",
}){

    const handleToggle = () => {
        if(disabled) return;
        if (onChange){
            onChange(!checked);
        }
    };

    const sizes = {
        sm: "h-[var(--size-switch-sm-h)] w-[var(--size-switch-sm-w)]",
        md: "h-[var(--size-switch-md-h)] w-[var(--size-switch-md-w)]",
        lg: "h-[var(--size-switch-lg-h)] w-[var(--size-switch-lg-w)]",
    };

    const knobSizes = {
        sm: "h-[var(--size-switch-sm-knob)] w-[var(--size-switch-sm-knob)]",
        md: "h-[var(--size-switch-md-knob)] w-[var(--size-switch-md-knob)]",
        lg: "h-[var(--size-switch-lg-knob)] w-[var(--size-switch-lg-knob)]",
    };

    return(
        <button
            onClick={handleToggle}
            disabled={disabled}
            className={`
                relative items-center
                rounded-full transition-colors
                
                ${sizes[size]}
                ${checked ? "bg-brand" : "bg-surface-muted border"}
                ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                ${className}
            `}
        >
            <span
                className={`
                    absolute left-0.5 flex items-center justify-center
                    rounded-full bg-surface-hover sh
                    transition-transform
                    ${knobSizes[size]}
                    ${checked ? "translate-x-full" : "translate-x-0"}
                `}
            >
                {checked ? (
                    <Check size={12} className="text-brand"/>
                ) : (
                    <X size={12} className="text-text-muted"/>
                )}
            </span>
        </button>
    );
}
