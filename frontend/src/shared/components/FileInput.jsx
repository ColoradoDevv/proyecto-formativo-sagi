import { useRef, useState, useMemo, useEffect } from "react";
import { Infinity as InfinityLoader } from "ldrs/react";
import { Upload, X, Move, FileText, FileSpreadsheet, File as FileIcon } from "lucide-react";
import { IconButton } from "@/shared";

const MAX_SIZE_MB = 5;

// Determina el tipo de un archivo para mostrar su icono/preview.
// Acepta tanto `File`/`Blob` (recien subidos) como strings (URLs ya
// persistidas, p.ej. "/media/materials/abc.png"). Sin esta rama, abrir
// la edicion de un consumible con imagen provocaba TypeError porque
// `stringUrl.type` es undefined y `.startsWith()` reventaba.
const getFileKind = (file) => {
    if (typeof file === "string") {
        if (/\.(jpe?g|png|gif|webp|svg|bmp)(\?|$)/i.test(file)) return "image";
        return "file";
    }
    if (file.type.startsWith("image/")) return "image";
    if (file.type === "application/pdf") return "pdf";
    if (
        file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.type === "application/vnd.ms-excel"
    ) return "xlsx";
    return "file";
};

const fileKindMeta = {
    pdf:  { icon: FileText,        label: "PDF"      },
    xlsx: { icon: FileSpreadsheet, label: "Excel"    },
    file: { icon: FileIcon,        label: "Archivo"  },
};

export default function FileInput({
    value = [],
    onChange,
    label,
    placeholder,
    className = "w-24 h-24",
    multiple = false,
    error,
    required,
    description,
    optional,
    accept = "image/*,application/pdf",
    maxFiles = 12,
    maxSizeMB = MAX_SIZE_MB,
}) {
    const inputRef = useRef();
    const [isLoading, setIsLoading] = useState(false);
    const [dragIndex, setDragIndex] = useState(null);
    const [localError, setLocalError] = useState(null);

    const previews = useMemo(
        () => value.map((file) => {
            const kind = getFileKind(file);
            if (kind !== "image") return null;
            // Para File/Blob generamos una blob URL; para strings (URL ya
            // persistida en backend) la devolvemos tal cual.
            return typeof file === "string" ? file : URL.createObjectURL(file);
        }),
        [value],
    );

    useEffect(() => {
        return () => {
            previews.forEach((url) => {
                // Solo revocamos las blob URLs que nosotros mismos creamos;
                // las URLs remotas (string) no se revocan — algunos navegadores
                // lanzan InvalidStateError si se llama revokeObjectURL sobre
                // una URL no-blob.
                if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
            });
        };
    }, [previews]);

    const handleFiles = async (files) => {
        const list = Array.from(files);

        const oversized = list.filter((f) => f.size > maxSizeMB * 1024 * 1024);
        const validFiles = list.filter((f) => f.size <= maxSizeMB * 1024 * 1024);

        if (oversized.length > 0) {
            setLocalError(
                oversized.length === 1
                    ? `"${oversized[0].name}" supera el tamaño máximo de ${maxSizeMB}MB`
                    : `${oversized.length} archivos superan el tamaño máximo de ${maxSizeMB}MB`
            );
        } else {
            setLocalError(null);
        }

        if (validFiles.length === 0) {
            if (inputRef.current) inputRef.current.value = "";
            return;
        }

        setIsLoading(true);
        await new Promise((r) => setTimeout(r, 500));
        const data = multiple ? [...value, ...validFiles] : [validFiles[0]];
        onChange(data.slice(0, maxFiles));
        setIsLoading(false);
        if (inputRef.current) inputRef.current.value = "";
    };

    const remove = (i) => {
        setLocalError(null);
        const copy = [...value];
        copy.splice(i, 1);
        onChange(copy);
    };

    const reorder = (from, to) => {
        const copy = [...value];
        const [m] = copy.splice(from, 1);
        copy.splice(to, 0, m);
        onChange(copy);
    };

    const displayError = localError || error;
    const atLimit = value.length >= maxFiles;

    return (
        <div className="flex flex-col gap-1 ">
            {label && (
                <label className={`
                        block
                        place-self-start
                        text-small
                        mb-1
                        ${displayError ? "text-error" : "text-text-primary"}
                    `}>
                        {label}
                        {required && <span className="text-error ml-1">*</span>}
                </label>
            )}

            <div className="flex items-center flex-wrap gap-2">
                {value.map((file, i) => {
                    const kind = getFileKind(file);
                    const meta = fileKindMeta[kind] || fileKindMeta.file;
                    const Icon = meta.icon;

                    return (
                        <div
                            key={i}
                            draggable
                            onDragStart={() => setDragIndex(i)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => reorder(dragIndex, i)}
                            className={`
                                relative
                                border border-border
                                overflow-hidden
                                group
                                bg-surface-hover
                                transition-shadow
                                rounded-2xl
                                duration-[var(--duration-base)]
                                hover:shadow-elevation-2
                                cursor-grab
                                active:cursor-grabbing
                                ${className}
                            `}
                        >
                            {kind === "image" ? (
                                <img src={previews[i]} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center gap-2 bg-surface-muted px-3 ">
                                    <Icon size={20} className="text-brand shrink-0" />
                                    <div className="flex flex-col min-w-0 text-left">
                                        <span className="text-small font-medium text-brand">{meta.label}</span>
                                        <span className="truncate text-small text-text-muted">
                                            {typeof file === "string"
                                                ? file.split("/").pop() || file
                                                : file.name}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div
                                className="
                                    absolute inset-0
                                    bg-background-inverse/40
                                    opacity-0 group-hover:opacity-100
                                    transition-opacity duration-[var(--duration-base)]
                                "
                            />

                            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--duration-base)]">
                                {multiple && value.length > 1 && (
                                    <span
                                        className="
                                            w-[var(--size-icon-sm)] h-[var(--size-icon-sm)]
                                            flex items-center justify-center
                                            bg-surface-hover
                                            rounded-[var(--radius-full)]
                                            text-text-primary
                                            shadow-elevation-1
                                        "
                                        title="Arrastra para reordenar"
                                    >
                                        <Move size={12} />
                                    </span>
                                )}
                                <button
                                    type="button"
                                    aria-label="Eliminar archivo"
                                    onClick={() => remove(i)}
                                    className="
                                        w-[var(--size-icon-sm)] h-[var(--size-icon-sm)]
                                        flex items-center justify-center
                                        bg-surface-hover
                                        rounded-[var(--radius-full)]
                                        text-error
                                        shadow-elevation-1
                                        hover:bg-error-soft
                                        transition-colors
                                        duration-[var(--duration-fast)]
                                    "
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    );
                })}

                {!atLimit && (
                    <div
                        onClick={() => !isLoading && inputRef.current.click()}
                        className={`
                            relative
                            border-2 border-dashed
                            ${displayError ? "border-error" : "border-border"}
                            rounded-[var(--radius-md)]
                            flex items-center justify-center
                            cursor-pointer
                            transition-all
                            
                            duration-[var(--duration-base)]
                            hover:border-brand hover:bg-background/45
                            ${className}
                        `}
                    >
                        {isLoading ? (
                            <InfinityLoader
                                size="36"
                                stroke="4"
                                strokeLength="0.15"
                                bgOpacity="0.1"
                                speed="1.3"
                                color="var(--semantic-brand)"
                            />
                        ) : (
                            <div className="w-full h-full flex flex-rows items-center justify-center gap-1.5 text-text-muted group-hover:text-brand transition-colors duration-[var(--duration-base)] rounded-2xl p-2">
                                <IconButton className="p-2" variant="ghost" ariaLabel="Subir archivo">
                                    <Upload size={18} />
                                </IconButton>
                                <span className="text-small font-medium text-center leading-tight">
                                    {placeholder}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                <input
                    ref={inputRef}
                    type="file"
                    hidden
                    multiple={multiple}
                    accept={accept}
                    onChange={(e) => handleFiles(e.target.files)}
                />
            </div>

            {multiple && maxFiles && (
                <span className="text-text-muted text-small">
                    {value.length}/{maxFiles} archivos
                </span>
            )}

            {description && (
                <p className="text-text-muted text-small text-center leading-tight w-full">
                    {description}
                </p>
            )}
            {displayError && <span className="text-error text-small text-center w-full">{displayError}</span>}
        </div>
    );
}