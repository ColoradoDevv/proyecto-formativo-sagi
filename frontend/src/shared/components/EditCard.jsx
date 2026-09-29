export default function EditCard({ title, children, className = "", cols = 2 }) {
    const colsClass = {
        1: "sm:grid-cols-1",
        2: "sm:grid-cols-2",
        3: "sm:grid-cols-3",
    }[cols] ?? "sm:grid-cols-2";

    return (
        <div className={`flex flex-col gap-3 p-4 rounded-2xl border border-border bg-surface-hover animate-fade-in ${className}`}>
            <h3 className={`text-medium font-heading border-b border-border pb-2`}>{title}</h3>
            <div className={`grid grid-cols-1 ${colsClass} gap-x-6 gap-y-3`}>
                {children}
            </div>
        </div>
    );
}
