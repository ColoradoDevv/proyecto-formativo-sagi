import { useRef, useState, useMemo, useEffect } from "react";
import { Infinity as InfinityLoader } from "ldrs/react";
import { Upload, Pencil, X } from "lucide-react";
import { IconButton } from "@/shared";

const MAX_SIZE_MB = 2;

export default function ProfileFileInput({
    value = [],
    onChange,
    label,
    optional,
    required,
    description,
    placeholder = "Subir foto",
    className = "w-full h-58",
    error,
    accept = ".jpg,.jpeg,.png",
}) {
    const inputRef = useRef();
    const [isLoading, setIsLoading] = useState(false);
    const [sizeError, setSizeError] = useState(null);

    // Guarda el blob URL anterior para revocarlo DESPUÉS de que el nuevo render
    // ya pintó la imagen, evitando que la imagen quede rota entre renders.
    const prevBlobRef = useRef(null);

    const preview = useMemo(() => {
        const file = value[0];
        if (!file) return null;
        if (typeof file === "string") return file;
        if (!file.type?.startsWith("image/")) return null;
        return URL.createObjectURL(file);
    }, [value]);

    useEffect(() => {
        // Cuando el preview cambia, revocamos el blob anterior (si lo había).
        // El nuevo preview ya está pintado en este punto, así que es seguro.
        if (prevBlobRef.current) {
            URL.revokeObjectURL(prevBlobRef.current);
            prevBlobRef.current = null;
        }
        // Si el preview actual es un blob, lo guardamos para revocarlo después.
        if (preview && !preview.startsWith("/") && !preview.startsWith("http")) {
            prevBlobRef.current = preview;
        }
        // Al desmontar el componente, revocamos el blob activo.
        return () => {
            if (prevBlobRef.current) {
                URL.revokeObjectURL(prevBlobRef.current);
                prevBlobRef.current = null;
            }
        };
    }, [preview]);

    const handleFiles = async (files) => {
        const file = files[0];
        if (!file) return;

        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            setSizeError(`El archivo supera el tamaño máximo de ${MAX_SIZE_MB}MB`);
            if (inputRef.current) inputRef.current.value = "";
            return;
        }

        setSizeError(null);
        setIsLoading(true);
        await new Promise((r) => setTimeout(r, 400));
        onChange([file]);
        setIsLoading(false);
    };

    const remove = (e) => {
        e.stopPropagation();
        setSizeError(null);
        onChange([]);
    };

    const displayError = sizeError || error;

    return (
        <div className="flex flex-col items-center gap-1.5">
            {label && (
                <label className={`block place-self-start text-small mb-1 ${displayError ? "text-error" : "text-text-primary"}`}>
                    {label}
                    {required && <span className="text-error ml-1">*</span>}
                    {optional && <span className="text-text-muted ml-1">(opcional)</span>}
                </label>
            )}

            <div
                onClick={() => !isLoading && inputRef.current.click()}
                className={`
                    relative
                    border-2 border-dashed
                    ${displayError ? "border-error" : "border-border"}
                    overflow-hidden
                    w-full
                    cursor-pointer
                    group
                    transition-all
                    duration-[var(--duration-base)]
                    ${!preview && !isLoading ? "hover:border-brand hover:bg-background/45" : "hover:border-error-soft"}
                    ${className}
                `}
            >
                {isLoading ? (
                    <div className="w-full h-full flex items-center justify-center bg-surface-muted">
                        <InfinityLoader size="42" stroke="4" strokeLength="0.15" bgOpacity="0.1" speed="1.3" color="var(--semantic-brand)" />
                    </div>
                ) : preview ? (
                    <>
                        <img src={preview} className="w-full h-full object-contain" />
                        <div
                            className="
                                absolute inset-0
                                bg-background-inverse/50
                                opacity-0 group-hover:opacity-100
                                transition-opacity duration-[var(--duration-base)]
                                flex flex-col items-center justify-center gap-2
                            "
                        >
                            <button
                                type="button"
                                onClick={() => inputRef.current.click()}
                                className="flex cursor-pointer items-center gap-1.5 text-text-inverse text-small font-medium hover:opacity-80 transition-opacity"
                            >
                                <Pencil size={14} /> Cambiar
                            </button>
                            <button
                                type="button"
                                onClick={remove}
                                className="flex cursor-pointer items-center gap-1.5 text-error text-small font-medium hover:opacity-80 transition-opacity"
                            >
                                <X size={14} /> Eliminar
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-text-muted group-hover:text-brand transition-colors duration-[var(--duration-base)] p-2">
                        <IconButton className="p-2" variant="ghost" ariaLabel="Subir foto">
                            <Upload size={18} />
                        </IconButton>
                        <span className="text-small font-medium text-center leading-tight">
                            {placeholder}
                        </span>
                    </div>
                )}
            </div>

            <input
                ref={inputRef}
                type="file"
                hidden
                accept={accept}
                onChange={(e) => handleFiles(e.target.files)}
            />

            {description && (
                <p className="text-text-muted text-small text-center leading-tight w-full">
                    {description}
                </p>
            )}

            {displayError && <span className="text-error text-small text-center w-full">{displayError}</span>}
        </div>
    );
}