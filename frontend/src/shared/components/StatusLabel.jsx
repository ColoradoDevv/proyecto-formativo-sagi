export default function StatusLabel({ children, required, optional, error, className = "" }) {
    return (
        <label className={`block text-small ${error ? "text-error" : "text-text-primary"} ${className}`}>
            {children}
            {required && <span className="text-error ml-1">*</span>}
        </label>
    );
}
