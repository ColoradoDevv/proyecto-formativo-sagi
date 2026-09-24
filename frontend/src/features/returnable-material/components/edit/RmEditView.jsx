import { useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, IconButton, StatusBadge, showAlert, cancelAlert, FileInput, usePermissions } from "@/shared";
import { mediaUrl } from "@/shared/services/api";
import { Undo2, Pencil, ImageOff, FileText, Trash2, Plus } from "lucide-react";
import useRm from "../../hooks/useRm";
import { getBrands, getCategories, getStates, getUsers, getInventories, createBrand, createInventory, createCategory } from "@/shared/services/selectServices";
import { rmEditSchema } from "../../schemas/rmSchema";
import { updateRM, deleteTechnicalSheet } from "../../services/returnableService";
import { QuotationPicker } from "@/features/quotations";
import ReturnableForm from "../ReturnableForm";
import { getReturnableCategoryOptions } from "../../utils/returnableCategoryRules";
import { TailChase } from "ldrs/react";
import "ldrs/react/TailChase.css";
import { useEffect } from "react";

// ── Componente externo ────────────────────────────────────────────────────────
export default function RmEditView() {
    const { id } = useParams();
    const { RM, loading, error } = useRm(id);
    const { isSuper, can } = usePermissions();
    // El "+" inline solo aparece con su permiso de crear.
    const canCreateBrand = isSuper || can("create_brand");
    const canCreateInventory = isSuper || can("create_inventory");
    const canCreateCategory = isSuper || can("create_category");

    const [categories, setCategories] = useState([]);
    const [brands,     setBrands]     = useState([]);
    const [states,     setStates]     = useState([]);
    const [users,      setUsers]      = useState([]);
    const [inventories, setInventories] = useState([]);

    useEffect(() => { getCategories().then(setCategories); }, []);
    useEffect(() => { getBrands().then(setBrands);         }, []);
    useEffect(() => { getStates().then(setStates);         }, []);
    useEffect(() => { getUsers().then(setUsers).catch(() => setUsers([])); }, []);
    useEffect(() => { getInventories().then(setInventories).catch(() => setInventories([])); }, []);

    const handleCreateBrand = async (name) => {
        const option = await createBrand(name);
        setBrands((prev) => [...prev, option]);
        return option;
    };
    const handleCreateInventory = async (name) => {
        const option = await createInventory(name);
        setInventories((prev) => [...prev, option]);
        return option;
    };
    const handleCreateCategory = async (name) => {
        const option = await createCategory(name);
        // Las categorias se gestionan via el CRUD de la pestana Categorias;
        // este handler existe por simetria y para uso futuro via CreateOptionButton.
        setCategories((prev) => {
            if (prev.some((c) => String(c.id) === String(option.id))) return prev;
            return [...prev, option];
        });
        return option;
    };

    if (loading)
        return (
            <div className="h-full flex items-center justify-center">
                <TailChase size="40" speed="1.75" color="var(--semantic-text-primary)" />
            </div>
        );

    if (error) return <p>Error al cargar material: {error.message}</p>;

    return (
        <RmEditForm
            RM={RM}
            categories={categories}
            brands={brands}
            states={states}
            users={users}
            inventories={inventories}
            onCreateBrand={canCreateBrand ? handleCreateBrand : null}
            onCreateInventory={canCreateInventory ? handleCreateInventory : null}
            onCreateCategory={canCreateCategory ? handleCreateCategory : null}
        />
    );
}

// ── Componente interno ────────────────────────────────────────────────────────
function RmEditForm({ RM, categories, brands, states, users, inventories, onCreateBrand, onCreateInventory, onCreateCategory }) {
    const navigate      = useNavigate();
    const photoInputRef = useRef();

    const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png"];
    const ALLOWED_REMOTE_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png"];

    const isSafeRemoteImageUrl = (value) => {
        try {
            const parsed = new URL(value, window.location.origin);
            const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
            const path = parsed.pathname.toLowerCase();
            const hasAllowedExtension = ALLOWED_REMOTE_IMAGE_EXTENSIONS.some((ext) => path.endsWith(ext));
            return isHttp && hasAllowedExtension;
        } catch {
            return false;
        }
    };

    const sanitizePreviewSrc = (value) => {
        if (!value || typeof value !== "string") return null;
        if (value.startsWith("blob:")) return value;
        return isSafeRemoteImageUrl(value) ? value : null;
    };

    const [photoPreview, setPhotoPreview] = useState(sanitizePreviewSrc(RM.image ?? null));
    const [photoFile,    setPhotoFile]    = useState(null);
    const [submitting,   setSubmitting]   = useState(false);

    // Fichas existentes (vienen del backend como [{ id, url }])
    const [existingSheets, setExistingSheets] = useState(RM.technical_sheets ?? []);
    // Fichas nuevas que el usuario quiere agregar en este PATCH
    const [newSheets, setNewSheets] = useState([]);

    const parseDimensions = (str) => {
        if (!str) return { width: "", length: "", depth: "" };
        const p = String(str).split("x");
        return { width: p[0] ?? "", length: p[1] ?? "", depth: p[2] ?? "" };
    };
    const dimensions = parseDimensions(RM.dimensions);

    const [formData, setFormData] = useState({
        name:         RM.name ?? "",
        model:        RM.model ?? "",
        senaPlate:    RM.sena_plate ?? "",
        serial:       RM.serial ?? "",
        category:     RM.category?.id != null ? String(RM.category.id) : "",
        brand:        RM.brand?.id != null ? String(RM.brand.id) : "",
        // Inventario: id como string. Vacio = sin asignar.
        inventory:     RM.inventory?.id != null ? String(RM.inventory.id) : "",
        description:  RM.description ?? "",
        state:        RM.state ?? "",
        quantity:     RM.quantity != null ? String(RM.quantity) : "",
        location:     RM.location ?? "",
        unitPrice:    RM.unit_price != null ? String(RM.unit_price) : "",
        totalPrice:   RM.total_price != null ? String(RM.total_price) : "",
        purchaseDate: RM.purchase_date ?? "",
        entryDate: RM.entry_date ?? "",
        // Cotizaciones asignadas (IDs de la biblioteca; desmarcar libera).
        quotations: Array.isArray(RM.quotations) ? RM.quotations.map((q) => String(q.id)) : [],
        // Cuentadantes (M2M): pre-cargar desde la lista del backend. Si el
        // backend devolvio el compat `user` (singular), caemos a ese valor.
        cuentadantes: Array.isArray(RM.cuentadantes)
            ? RM.cuentadantes.map((u) => String(u.id))
            : (RM.user?.id != null ? [String(RM.user.id)] : []),
        width:        dimensions.width,
        length:       dimensions.length,
        depth:        dimensions.depth,
    });
    const [errors, setErrors] = useState({});

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => {
            const updated = { ...prev, [name]: value };
            const quantity  = name === "quantity"  ? value : updated.quantity;
            const unitPrice = name === "unitPrice"  ? value : updated.unitPrice;
            if (quantity && unitPrice) {
                const total = (parseFloat(quantity) * parseFloat(unitPrice)).toFixed(2);
                updated.totalPrice = isNaN(total) ? "" : total;
            }
            return updated;
        });
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
            showAlert({
                icon: "error",
                iconColor: "var(--color-error)",
                title: "Formato de imagen no permitido",
                text: "Solo se permiten imágenes JPG o PNG."
            });
            return;
        }

        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
    };

    // Eliminar una ficha existente (llama al backend)
    const handleDeleteSheet = async (sheetId) => {
        try {
            await deleteTechnicalSheet(sheetId);
            setExistingSheets((prev) => prev.filter((s) => s.id !== sheetId));
        } catch {
            showAlert({ icon: "error", iconColor: "var(--color-error)", title: "No se pudo eliminar la ficha" });
        }
    };

    const totalSheets = existingSheets.length + newSheets.length;
    const canAddMore  = totalSheets < 3;

    async function handleSubmit(e) {
        e.preventDefault();
        const selectedCategory = categories.find((o) => String(o.id) === String(formData.category));
        const payload = { ...formData, categoryName: selectedCategory?.label ?? selectedCategory?.name ?? "" };
        const result = rmEditSchema.safeParse(payload);

        if (!result.success) {
            const fieldErrors = {};
            result.error.issues.forEach((i) => { fieldErrors[i.path[0]] = i.message; });
            setErrors(fieldErrors);
            return;
        }

        setErrors({});
        setSubmitting(true);
        try {
            await updateRM(RM.consumable_id, {
                ...formData,
                photo:         photoFile ? [photoFile] : null,
                technicalSheet: newSheets,   // solo las nuevas se envían al PATCH
            });
            await showAlert({ icon: "success", iconColor: "var(--color-success)", title: "Material devolutivo actualizado exitosamente" });
            navigate(-1);
        } catch (err) {
            if (err.fieldErrors) setErrors((prev) => ({ ...prev, ...err.fieldErrors }));
            showAlert({ icon: "error", iconColor: "var(--color-error)", title: "Error al actualizar", text: err.message });
        } finally {
            setSubmitting(false);
        }
    }

    async function handleCancel() {
        const r = await cancelAlert();
        if (r.isConfirmed) navigate(-1);
    }

    return (
        <div className="h-full text-text-primary flex flex-col gap-3">
            <div className="flex items-center gap-3">
                <IconButton onClick={() => navigate(-1)} variant="ghost"><Undo2 size={18} /></IconButton>
                <h2 className="text-h2 text-text-primary font-heading">Editar Material Devolutivo</h2>
            </div>

            <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">
                <ReturnableForm
                    formData={formData}
                    errors={errors}
                    onChange={handleChange}
                    categories={getReturnableCategoryOptions(categories)}
                    brands={brands}
                    states={states}
                    users={users}
                    inventories={inventories}
                    onCreateBrand={onCreateBrand}
                    onCreateInventory={onCreateInventory}
                    onCreateCategory={onCreateCategory}
                    photoSlot={
                        <div className="flex flex-col items-center gap-3 w-full sm:w-36">
                            {/* Foto */}
                            <div className="relative">
                                <div className="size-24 rounded-[var(--radius-xl)] overflow-hidden border border-border bg-surface-muted flex items-center justify-center">
                                    {photoPreview
                                        ? <img src={photoPreview} alt={formData.name} className="w-full h-full object-contain" />
                                        : <ImageOff size={40} className="text-text-muted" />
                                    }
                                </div>
                                <button
                                    type="button"
                                    aria-label="Cambiar foto"
                                    onClick={() => photoInputRef.current.click()}
                                    className="absolute bottom-1 right-1 size-7 bg-brand text-on-brand rounded-[var(--radius-full)] flex items-center justify-center shadow-[var(--shadow-elevation-1)] hover:opacity-90 transition-opacity"
                                >
                                    <Pencil size={13} />
                                </button>
                                <input ref={photoInputRef} type="file" hidden accept=".jpg,.jpeg,.png" onChange={handlePhotoChange} />
                            </div>
                            <StatusBadge active={RM.is_active} />

                            {/* Fichas existentes */}
                            <div className="flex flex-col gap-1.5 w-full">
                                <p className="text-small text-text-muted font-medium">Fichas técnicas</p>
                                {existingSheets.map((sheet, i) => (
                                    <div key={sheet.id} className="flex items-center gap-1">
                                        <a
                                            href={mediaUrl(sheet.url)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex-1 flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-full)] border border-brand/40 bg-brand/8 text-brand text-small font-medium hover:bg-brand/15 transition-colors min-w-0"
                                        >
                                            <FileText size={12} className="shrink-0" />
                                            <span className="truncate">Ficha {i + 1}</span>
                                        </a>
                                        <IconButton
                                            onClick={() => handleDeleteSheet(sheet.id)}
                                            variant="ghost"
                                            hitSize={32}
                                            iconSize={16}
                                            ariaLabel="Eliminar ficha"
                                            className="shrink-0 text-error hover:opacity-70"
                                        >
                                            <Trash2 size={13} />
                                        </IconButton>
                                    </div>
                                ))}

                                {/* Fichas nuevas pendientes de guardar */}
                                {newSheets.map((file, i) => (
                                    <div key={i} className="flex items-center gap-1">
                                        <span className="flex-1 flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-full)] border border-warning/40 bg-warning/8 text-warning text-small min-w-0">
                                            <FileText size={12} className="shrink-0" />
                                            <span className="truncate">{file.name}</span>
                                        </span>
                                        <IconButton
                                            onClick={() => setNewSheets((prev) => prev.filter((_, idx) => idx !== i))}
                                            variant="ghost"
                                            hitSize={32}
                                            iconSize={16}
                                            ariaLabel="Quitar ficha"
                                            className="shrink-0 text-error hover:opacity-70"
                                        >
                                            <Trash2 size={13} />
                                        </IconButton>
                                    </div>
                                ))}

                                {/* Botón para agregar nuevas fichas */}
                                {canAddMore && (
                                    <FileInput
                                        placeholder={
                                            <span className="flex items-center gap-1 text-small text-brand">
                                                <Plus size={13} /> Agregar ficha
                                            </span>
                                        }
                                        accept="application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png"
                                        multiple={false}
                                        maxFiles={1}
                                        maxSizeMB={3}
                                        className="w-full h-10 rounded-[var(--radius-full)]"
                                        value={[]}
                                        onChange={(files) => {
                                            if (files[0]) setNewSheets((prev) => [...prev, files[0]]);
                                        }}
                                    />
                                )}
                                {!canAddMore && (
                                    <p className="text-small text-text-muted italic">Máximo 3 fichas</p>
                                )}
                            </div>

                            {/* Cotizaciones asignadas (biblioteca) */}
                            <QuotationPicker
                                name="quotations"
                                value={formData.quotations}
                                onChange={handleChange}
                                error={errors.quotations}
                            />
                        </div>
                    }
                />

                <div className="flex gap-4 justify-center md:justify-end">
                    <Button type="button" variant="secondary" size="md" onClick={handleCancel} disabled={submitting}>Cancelar</Button>
                    <Button type="submit" variant="primary" size="md" disabled={submitting}>
                        {submitting ? "Guardando..." : "Guardar cambios"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
