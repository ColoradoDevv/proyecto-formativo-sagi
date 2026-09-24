import { useNavigate } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";


export default function AccessCards({ className = "", style, Icon, label, value, hasError = false, to }) {
    const navigate = useNavigate();

    return (
        <div
            onClick={() => navigate(to)}
            style={style}
            className={`rounded-2xl cursor-pointer shadow-(--shadow-elevation-4) hover:shadow-(--shadow-elevation-5) hover:-translate-y-1 bg-surface-hover hover:bg-gradient-to-br hover:from-surface-hover hover:to-surface-muted p-5 w-full flex flex-col gap-4 transition-all duration-200 border border-border animate-slide-up ${className}`}
        >
            <div className="flex items-start justify-between">
                {Icon && (
                    <span className="bg-surface-muted rounded-xl w-12 h-12 flex items-center justify-center text-text-primary shrink-0">
                        {Icon}
                    </span>
                )}
                <SlidersHorizontal size={20} className="text-text-secondary shrink-0" />
            </div>
            <div className="flex flex-col gap-1">
                <p className="text-text-primary leading-tight">{label}</p>
                <p className={`text-h1 font-heading ${hasError ? "text-text-muted" : "text-text-primary"}`}>
                    {hasError ? "—" : value}
                </p>
            </div>
        </div>
    );
}
