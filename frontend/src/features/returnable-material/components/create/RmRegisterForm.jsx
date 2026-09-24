import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getBrands, getStates, getCategories, getUsers, getInventories, createBrand, createInventory, createCategory } from "@/shared/services/selectServices";
import { createRM } from "../../services/returnableService";
import { FileInput, Button, showAlert, cancelAlert, ProfileFileInput, IconButton, AccordionItem, EditCard, usePermissions } from "@/shared";
import { rmBaseSchema, rmSchema } from "../../schemas/rmSchema";
import { ReturnableGeneralCard, ReturnableInventoryCard, ReturnableValuesCard, ReturnableAccountableCard } from "../ReturnableForm";
import { QuotationPicker } from "@/features/quotations";
import { getReturnableCategoryOptions } from "../../utils/returnableCategoryRules";
import { Undo2, Package, Layers, BadgeDollarSign, Paperclip, CheckCircle2 } from "lucide-react";

// Agrupación por pasos — mismo patrón que CmRegisterForm (crear consumible).
// Solo cambia cómo se muestra el formulario; los campos y el submit son los mismos.
const GENERAL_FIELDS = ["name", "model", "senaPlate", "category", "serial", "brand", "description", "width", "length", "depth"];
const INVENTORY_FIELDS = ["state", "quantity", "location", "purchaseDate", "entryDate"];
const VALUES_FIELDS = ["unitPrice", "totalPrice"];
const SUPPORT_FIELDS = ["photo", "technicalSheet", "quotations"];

const generalStepSchema = rmBaseSchema.pick({
    name: true,
    model: true,
    senaPlate: true,
    category: true,
    serial: true,
    brand: true,
    description: true,
    width: true,
    length: true,
    depth: true,
});

const inventoryStepSchema = rmBaseSchema.pick({
    state: true,
    quantity: true,
    location: true,
    purchaseDate: true,
    entryDate: true,
});

const valuesStepSchema = rmBaseSchema.pick({
    unitPrice: true,
    totalPrice: true,
});

const supportStepSchema = rmBaseSchema.pick({
    photo: true,
    technicalSheet: true,
    quotations: true,
});


export default function RmRegisterForm() {
    const navigate = useNavigate();
    // El "+" inline de marca/inventario/categoría solo aparece con su
    // permiso de crear (el backend lo exige en cada POST).
    const { isSuper, can } = usePermissions();
    const canCreateBrand = isSuper || can("create_brand");
    const canCreateInventory = isSuper || can("create_inventory");
    const canCreateCategory = isSuper || can("create_category");
    const [categories, setCategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [states, setStates] = useState([]);
    const [users, setUsers] = useState([]);
    const [inventories, setInventories] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [activeStep, setActiveStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState([false, false, false, false]);

    // Convencion de nombres unificada con ReturnableForm y el edit.
    const [formData, setFormData] = useState({
        senaPlate: "",
        name: "",
        model: "",
        state: "",
        category: "",
        brand: "",
        inventory: "",
        serial: "",
        quantity: "",
        location: "",
        unitPrice: "",
        totalPrice: "",
        description: "",
        purchaseDate: "",
        entryDate: "",
        // Cuentadantes (M2M): lista de IDs. Si se deja vacia, el backend
        // asigna por defecto al usuario actual.
        cuentadantes: [],
        technicalSheet: [],
        quotations: [],
        photo: [],
        width: "",
        length: "",
        depth: "",
    });
    const [errors, setErrors] = useState({});

    useEffect(() => { getCategories().then(setCategories); }, []);
    useEffect(() => { getBrands().then(setBrands); }, []);
    useEffect(() => { getStates().then(setStates); }, []);
    useEffect(() => { getUsers().then(setUsers).catch(() => setUsers([])); }, []);
    useEffect(() => { getInventories().then(setInventories).catch(() => setInventories([])); }, []);

    // Crea una marca nueva, la agrega a las opciones y la devuelve al formulario.
    const handleCreateBrand = async (name) => {
        const option = await createBrand(name);
        setBrands((prev) => [...prev, option]);
        return option;
    };
    // Crea un nombre de inventario nuevo, lo agrega a las opciones y lo devuelve al form.
    const handleCreateInventory = async (name) => {
        const option = await createInventory(name);
        setInventories((prev) => [...prev, option]);
        return option;
    };
    // Crea una categoria nueva, la agrega a las opciones y la devuelve al form.
    // No se usa directamente porque la categoria es requerida y existe
    // siempre como FK; pero se expone por simetria con brand/inventory.
    const handleCreateCategory = async (name) => {
        const option = await createCategory(name);
        setCategories((prev) => [...prev, option]);
        return option;
    };

    const clearErrorsForFields = (fields) => {
        setErrors((prev) => {
            if (!prev || typeof prev !== "object") return prev;
            const next = { ...prev };
            fields.forEach((f) => { delete next[f]; });
            return next;
        });
    };

    const setErrorsForFields = (fields, fieldErrors) => {
        setErrors((prev) => {
            const next = { ...(prev || {}) };
            fields.forEach((f) => { delete next[f]; });
            return { ...next, ...fieldErrors };
        });
    };

    const validateStep = (stepIndex) => {
        const stepConfig = [
            { schema: generalStepSchema, fields: GENERAL_FIELDS },
            { schema: inventoryStepSchema, fields: INVENTORY_FIELDS },
            { schema: valuesStepSchema, fields: VALUES_FIELDS },
            { schema: supportStepSchema, fields: SUPPORT_FIELDS },
        ][stepIndex];

        if (!stepConfig) return true;

        const stepData = Object.fromEntries(
            stepConfig.fields.map((f) => [f, formData[f]])
        );

        const result = stepConfig.schema.safeParse(stepData);
        if (result.success) {
            clearErrorsForFields(stepConfig.fields);
            return true;
        }

        const fieldErrors = {};
        result.error.issues.forEach((issue) => {
            const field = issue.path[0];
            if (field !== undefined && !(field in fieldErrors)) fieldErrors[field] = issue.message;
        });
        setErrorsForFields(stepConfig.fields, fieldErrors);
        return false;
    };

    const goToStep = (targetIndex) => {
        if (targetIndex === activeStep) return;
        if (targetIndex < activeStep) {
            setActiveStep(targetIndex);
            return;
        }

        for (let i = activeStep; i < targetIndex; i++) {
            const ok = validateStep(i);
            if (!ok) {
                setActiveStep(i);
                return;
            }
            setCompletedSteps((prev) => {
                const next = [...prev];
                next[i] = true;
                return next;
            });
        }
        setActiveStep(targetIndex);
    };

    const nextStep = () => {
        const ok = validateStep(activeStep);
        if (!ok) return;
        setCompletedSteps((prev) => {
            const next = [...prev];
            next[activeStep] = true;
            return next;
        });
        setActiveStep((prev) => Math.min(prev + 1, 3));
    };

    const prevStep = () => setActiveStep((prev) => Math.max(prev - 1, 0));

    const handleFileChange = (name) => (files) => {
        setFormData((prev) => ({ ...prev, [name]: files }));
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData((prev) => {
            const updated = { ...prev, [name]: value };

            // Calcular total automaticamente a partir de cantidad x valor unitario.
            const quantity  = name === "quantity"  ? value : updated.quantity;
            const unitPrice = name === "unitPrice" ? value : updated.unitPrice;
            if (quantity && unitPrice) {
                const total = (parseFloat(quantity) * parseFloat(unitPrice)).toFixed(2);
                updated.totalPrice = isNaN(total) ? "" : total;
            }

            return updated;
        });
    };

    async function handleCancel() {
        const result = await cancelAlert();
        if (result.isConfirmed) navigate(-1);
    }

    const handleSubmit = async (e) => {
        e.preventDefault();

        const selectedCategory = categories.find((option) => String(option.id) === String(formData.category));
        const payload = { ...formData, categoryName: selectedCategory?.label ?? selectedCategory?.name ?? "" };
        const result = rmSchema.safeParse(payload);

        if (!result.success) {
            const fieldErrors = {};
            result.error.issues.forEach((issue) => {
                fieldErrors[issue.path[0]] = issue.message;
            });
            setErrors(fieldErrors);
            const stepByField = {
                ...Object.fromEntries(GENERAL_FIELDS.map((f) => [f, 0])),
                inventory: 0,
                ...Object.fromEntries(INVENTORY_FIELDS.map((f) => [f, 1])),
                ...Object.fromEntries(VALUES_FIELDS.map((f) => [f, 2])),
                ...Object.fromEntries(SUPPORT_FIELDS.map((f) => [f, 3])),
                cuentadantes: 3,
            };
            const stepCandidates = Object.keys(fieldErrors).map((f) => stepByField[f]).filter((v) => v != null);
            if (stepCandidates.length) setActiveStep(Math.min(...stepCandidates));
            return;
        }

        setErrors({});
        setSubmitting(true);

        try {
            // Pasar los archivos directamente de formData (no de result.data) para
            // evitar que z.instanceof(File) los descarte silenciosamente en Vite.
            // Tambien pasamos `cuentadantes` (array) porque Zod lo descarta al
            // no estar declarado en rmSchema (no es requerido a nivel de RM).
            await createRM({
                ...result.data,
                photo: formData.photo,
                technicalSheet: formData.technicalSheet,
                quotations: formData.quotations,
                cuentadantes: formData.cuentadantes,
            });
            await showAlert({ icon: "success", iconColor: "var(--color-success)", title: "Material devolutivo creado exitosamente" });
            navigate("/devolutivos");
        } catch (err) {
            if (err.fieldErrors) setErrors((prev) => ({ ...prev, ...err.fieldErrors }));
            showAlert({ icon: "error", iconColor: "var(--color-error)", title: "Error al crear material devolutivo", text: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    const availableCategories = getReturnableCategoryOptions(categories);

    return (
        <div className="h-full text-text-primary flex flex-col gap-3">

            <div className="flex items-center gap-3">
                <IconButton onClick={() => navigate(-1)} variant="ghost">
                    <Undo2 size={20}/>
                </IconButton>
                <h2 className="text-h2 text-text-primary font-heading">Crear Material Devolutivo</h2>
            </div>

            <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">

                <div className="flex flex-col gap-3">
                    <AccordionItem
                        title={
                            <span className="flex items-center gap-3">
                                <span className="size-9 rounded-[var(--radius-full)] border border-border bg-surface-muted flex items-center justify-center">
                                    {completedSteps[0] ? <CheckCircle2 size={18} className="text-success" /> : <Package size={18} />}
                                </span>
                                <span className="flex flex-col leading-tight">
                                    <span>Información general</span>
                                    <span className="text-small text-text-muted">Paso 1 de 4</span>
                                </span>
                            </span>
                        }
                        open={activeStep === 0}
                        onToggle={() => goToStep(0)}
                    >
                        <div className="pt-4 flex flex-col gap-3">
                            <ReturnableGeneralCard
                                formData={formData}
                                errors={errors}
                                onChange={handleChange}
                                categories={availableCategories}
                                brands={brands}
                                inventories={inventories}
                                onCreateBrand={canCreateBrand ? handleCreateBrand : null}
                                onCreateInventory={canCreateInventory ? handleCreateInventory : null}
                                onCreateCategory={canCreateCategory ? handleCreateCategory : null}
                            />
                            <div className="flex gap-3 justify-between">
                                <Button type="button" variant="secondary" size="md" onClick={handleCancel} disabled={submitting}>
                                    Cancelar
                                </Button>
                                <Button type="button" variant="primary" size="md" onClick={nextStep} disabled={submitting}>
                                    Siguiente
                                </Button>
                            </div>
                        </div>
                    </AccordionItem>

                    <AccordionItem
                        title={
                            <span className="flex items-center gap-3">
                                <span className="size-9 rounded-[var(--radius-full)] border border-border bg-surface-muted flex items-center justify-center">
                                    {completedSteps[1] ? <CheckCircle2 size={18} className="text-success" /> : <Layers size={18} />}
                                </span>
                                <span className="flex flex-col leading-tight">
                                    <span>Inventario</span>
                                    <span className="text-small text-text-muted">Paso 2 de 4</span>
                                </span>
                            </span>
                        }
                        open={activeStep === 1}
                        onToggle={() => goToStep(1)}
                    >
                        <div className="pt-4 flex flex-col gap-3">
                            <ReturnableInventoryCard
                                formData={formData}
                                errors={errors}
                                onChange={handleChange}
                                states={states}
                            />
                            <div className="flex gap-3 justify-between">
                                <Button type="button" variant="secondary" size="md" onClick={prevStep} disabled={submitting}>
                                    Atrás
                                </Button>
                                <Button type="button" variant="primary" size="md" onClick={nextStep} disabled={submitting}>
                                    Siguiente
                                </Button>
                            </div>
                        </div>
                    </AccordionItem>

                    <AccordionItem
                        title={
                            <span className="flex items-center gap-3">
                                <span className="size-9 rounded-[var(--radius-full)] border border-border bg-surface-muted flex items-center justify-center">
                                    {completedSteps[2] ? <CheckCircle2 size={18} className="text-success" /> : <BadgeDollarSign size={18} />}
                                </span>
                                <span className="flex flex-col leading-tight">
                                    <span>Valores</span>
                                    <span className="text-small text-text-muted">Paso 3 de 4</span>
                                </span>
                            </span>
                        }
                        open={activeStep === 2}
                        onToggle={() => goToStep(2)}
                    >
                        <div className="pt-4 flex flex-col gap-3">
                            <ReturnableValuesCard
                                formData={formData}
                                errors={errors}
                                onChange={handleChange}
                            />
                            <div className="flex gap-3 justify-between">
                                <Button type="button" variant="secondary" size="md" onClick={prevStep} disabled={submitting}>
                                    Atrás
                                </Button>
                                <Button type="button" variant="primary" size="md" onClick={nextStep} disabled={submitting}>
                                    Siguiente
                                </Button>
                            </div>
                        </div>
                    </AccordionItem>

                    <AccordionItem
                        title={
                            <span className="flex items-center gap-3">
                                <span className="size-9 rounded-[var(--radius-full)] border border-border bg-surface-muted flex items-center justify-center">
                                    {completedSteps[3] ? <CheckCircle2 size={18} className="text-success" /> : <Paperclip size={18} />}
                                </span>
                                <span className="flex flex-col leading-tight">
                                    <span>Asignación y soportes</span>
                                    <span className="text-small text-text-muted">Paso 4 de 4</span>
                                </span>
                            </span>
                        }
                        open={activeStep === 3}
                        onToggle={() => goToStep(3)}
                    >
                        <div className="pt-4 flex flex-col gap-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="flex flex-col gap-3 min-w-0">
                                    <ReturnableAccountableCard
                                        formData={formData}
                                        errors={errors}
                                        onChange={handleChange}
                                        users={users}
                                    />
                                    <EditCard title="Cotizaciones">
                                        <QuotationPicker
                                            name="quotations"
                                            value={formData.quotations}
                                            onChange={handleChange}
                                            error={errors.quotations}
                                            required
                                        />
                                    </EditCard>
                                </div>
                                <EditCard title="Archivos">
                                    <div className="flex flex-col gap-4">
                                        <ProfileFileInput
                                            label="Foto del Material"
                                            required
                                            name="photo"
                                            placeholder="Subir foto"
                                            value={formData.photo}
                                            onChange={handleFileChange("photo")}
                                            error={errors.photo}
                                            accept="image/*"
                                            className="w-full h-25 rounded-2xl"
                                        />
                                        <FileInput
                                            label="Fichas Técnicas"
                                            name="technicalSheet"
                                            placeholder="Subir fichas técnicas (máx. 3)"
                                            value={formData.technicalSheet}
                                            onChange={handleFileChange("technicalSheet")}
                                            error={errors.technicalSheet}
                                            accept="application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png"
                                            multiple
                                            required
                                            maxFiles={3}
                                            maxSizeMB={3}
                                            className="w-full h-14 rounded-2xl"
                                        />
                                    </div>
                                </EditCard>
                            </div>
                            <div className="flex gap-3 justify-between">
                                <Button type="button" variant="secondary" size="md" onClick={prevStep} disabled={submitting}>
                                    Atrás
                                </Button>
                                <div className="flex gap-3">
                                    <Button type="button" variant="secondary" size="md" onClick={handleCancel} disabled={submitting}>
                                        Cancelar
                                    </Button>
                                    <Button type="submit" variant="primary" size="md" disabled={submitting}>
                                        {submitting ? "Guardando..." : "Crear"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </AccordionItem>
                </div>

            </form>
        </div>
    );
}
