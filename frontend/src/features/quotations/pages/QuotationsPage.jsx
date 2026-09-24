import { useEffect, useRef, useState } from "react";
import { FileText, Trash2, Upload, Link2Off } from "lucide-react";
import { Button, EditCard, FileInput, Input, Modal, showAlert } from "@/shared";
import { mediaUrl } from "@/shared/services/api";
import { usePermissions } from "@/shared/hooks/usePermissions";
import {
    getQuotations,
    uploadQuotation,
    deleteQuotation,
} from "../services/quotationService";

function fileNameOf(url) {
    if (!url) return "cotizacion.pdf";
    return String(url).split("/").pop() || "cotizacion.pdf";
}

function formatDate(value) {
    if (!value) return "—";
    try {
        return new Intl.DateTimeFormat("es-CO", {
            dateStyle: "medium",
        }).format(new Date(value));
    } catch {
        return "—";
    }
}

export default function QuotationsPage() {
    const { can, isSuper } = usePermissions();
    const canCreate = isSuper || can("create_quotation");
    const canDelete = isSuper || can("delete_quotation");

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [onlyAvailable, setOnlyAvailable] = useState(false);
    const [title, setTitle] = useState("");
    const [file, setFile] = useState([]);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState("");
    const searchTimer = useRef(null);

    const fetchItems = async (signal, opts = {}) => {
        setLoading(true);
        try {
            const data = await getQuotations({
                unassigned: opts.unassigned ?? onlyAvailable,
                search: opts.search ?? search,
                signal,
            });
            setItems(data);
        } catch (err) {
            if (err.name !== "AbortError") {
                showAlert({
                    icon: "error",
                    iconColor: "var(--color-error)",
                    title: "No se pudieron cargar las cotizaciones",
                    text: err.message,
                });
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        fetchItems(controller.signal);
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSearch = (value) => {
        setSearch(value);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            const controller = new AbortController();
            fetchItems(controller.signal, { search: value });
        }, 400);
    };

    const openUpload = () => {
        setTitle("");
        setFile([]);
        setUploadError("");
        setUploadOpen(true);
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        setUploadError("");
        const pdf = file[0];
        if (!(pdf instanceof File)) {
            setUploadError("Selecciona un archivo PDF.");
            return;
        }
        if (pdf.type !== "application/pdf") {
            setUploadError("Solo se permiten archivos PDF.");
            return;
        }
        if (pdf.size > 3 * 1024 * 1024) {
            setUploadError("El archivo no puede superar 3MB.");
            return;
        }
        setUploading(true);
        try {
            await uploadQuotation({ title, file: pdf });
            setUploadOpen(false);
            setTitle("");
            setFile([]);
            const controller = new AbortController();
            await fetchItems(controller.signal);
            await showAlert({
                icon: "success",
                iconColor: "var(--color-success)",
                title: "Cotización subida",
                text: "Quedó disponible para asignarla a materiales.",
            });
        } catch (err) {
            setUploadError(err.message || "No se pudo subir la cotización.");
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteQuotation(id);
            setItems((prev) => prev.filter((q) => q.id !== id));
        } catch (err) {
            showAlert({
                icon: "error",
                iconColor: "var(--color-error)",
                title: "No se pudo eliminar",
                text: err.message,
            });
        }
    };

    return (
        <div className="h-full text-text-primary flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-h2 text-text-primary font-heading">Cotizaciones</h2>
                    <p className="text-small text-text-muted">
                        Biblioteca de PDFs. Desde aquí se suben y luego se eligen en cada material.
                    </p>
                </div>
                {canCreate && (
                    <Button type="button" variant="primary" size="md" onClick={openUpload} className="shrink-0 whitespace-nowrap">
                        <Upload size={15} /> Subir cotización
                    </Button>
                )}
            </div>

            <Modal
                isOpen={uploadOpen}
                onClose={() => setUploadOpen(false)}
                title="Subir cotización"
                footer={
                    <>
                        <Button type="button" variant="secondary" size="md" onClick={() => setUploadOpen(false)} disabled={uploading}>
                            Cancelar
                        </Button>
                        <Button type="submit" form="quotation-upload-form" variant="primary" size="md" disabled={uploading}>
                            {uploading ? "Subiendo..." : <><Upload size={15} /> Subir</>}
                        </Button>
                    </>
                }
            >
                <form id="quotation-upload-form" noValidate onSubmit={handleUpload} className="flex flex-col gap-3">
                    <Input
                        label="Título"
                        name="title"
                        placeholder="Ej. Cotización ferretería — taladro (opcional, por defecto el nombre del archivo)"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        optional
                    />
                    <FileInput
                        label="Archivo PDF"
                        placeholder="Seleccionar PDF"
                        value={file}
                        onChange={setFile}
                        error={uploadError}
                        accept="application/pdf"
                        multiple={false}
                        maxFiles={1}
                        maxSizeMB={3}
                        required
                        className="w-full h-14 rounded-2xl"
                    />
                </form>
            </Modal>

            <EditCard title={`Biblioteca (${items.length})`} cols={1}>
                <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                        placeholder="Buscar por título o archivo…"
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="flex-1"
                    />
                    <label className="flex items-center gap-2 text-small text-text-secondary cursor-pointer whitespace-nowrap">
                        <input
                            type="checkbox"
                            checked={onlyAvailable}
                            onChange={(e) => {
                                setOnlyAvailable(e.target.checked);
                                const controller = new AbortController();
                                fetchItems(controller.signal, { unassigned: e.target.checked });
                            }}
                            className="w-5 h-5 accent-text-primary"
                        />
                        Solo disponibles
                    </label>
                </div>

                {loading ? (
                    <p className="text-small text-text-muted text-center py-6">Cargando cotizaciones…</p>
                ) : items.length === 0 ? (
                    <p className="text-small text-text-muted text-center py-6">
                        No hay cotizaciones. Sube la primera con el botón “Subir cotización”.
                    </p>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {items.map((q) => (
                            <li
                                key={q.id}
                                className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface-hover px-3 py-2"
                            >
                                <FileText size={18} className="text-brand shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-small font-medium text-text-primary truncate">
                                        {q.title || fileNameOf(q.url)}
                                    </p>
                                    <p className="text-small text-text-muted truncate">
                                        {fileNameOf(q.url)} · {formatDate(q.uploaded_at)} ·{" "}
                                        {q.material ? `Asignada: ${q.material_name ?? "material"}` : "Disponible"}
                                    </p>
                                </div>
                                <a
                                    href={mediaUrl(q.url)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-small text-brand hover:underline underline-offset-2 shrink-0"
                                >
                                    Ver
                                </a>
                                {q.material ? (
                                    <span
                                        title="Está asignada a un material: desasígnela editando el material"
                                        className="flex items-center gap-1 text-small text-text-muted shrink-0"
                                    >
                                        <Link2Off size={13} /> Asignada
                                    </span>
                                ) : (
                                    canDelete && (
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(q.id)}
                                            aria-label="Eliminar cotización"
                                            className="shrink-0 text-error hover:opacity-70 transition-opacity p-1"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    )
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </EditCard>
        </div>
    );
}
