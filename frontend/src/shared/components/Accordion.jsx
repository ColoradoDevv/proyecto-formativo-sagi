import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function AccordionItem({ title, defaultOpen = false, open: openProp, onToggle, disableToggle = false, children }) {
    const [openInternal, setOpenInternal] = useState(defaultOpen);
    const open = openProp ?? openInternal;

    const toggle = () => {
        if (disableToggle) return;
        if (typeof onToggle === "function") {
            onToggle(!open);
            return;
        }
        if (openProp === undefined) {
            setOpenInternal((prev) => !prev);
        }
    };

    return (
        <section className="border border-border rounded-2xl overflow-hidden">
            <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                disabled={disableToggle}
                className="
                    w-full
                    flex
                    items-center
                    justify-between
                    gap-3
                    px-6
                    py-4
                    text-left
                    cursor-pointer
                    hover:bg-surface-muted
                    transition-colors
                "
            >
                <h2 className="text-text-primary font-heading">{title}</h2>
                <ChevronDown
                    size={18}
                    className={`shrink-0 transition-transform duration-[var(--duration-lazy)] ${open ? "rotate-180" : ""}`}
                />
            </button>

            <div
                aria-hidden={!open}
                className={`grid transition-[grid-template-rows,opacity] duration-[var(--duration-base)] ease-in-out ${
                    open
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0 pointer-events-none"
                }`}
            >
                <div className="overflow-hidden">
                    <div className="px-6 pb-6">
                        {children}
                    </div>
                </div>
            </div>
        </section>
    );
}
