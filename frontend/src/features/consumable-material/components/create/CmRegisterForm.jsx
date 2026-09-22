import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { getBrands, getUsers, getInventories, getCategories, createBrand, createInventory, createCategory } from "@/shared/services/selectServices";
import { FileInput, Button, showAlert, cancelAlert, ProfileFileInput, IconButton, AccordionItem, EditCard } from "@/shared";
import { cmBaseSchema, cmSchema } from "../../schemas/cmSchema";
import { createCm } from "../../services/consumableService";
import { ConsumableAccountableCard, ConsumableGeneralCard, ConsumableInventoryCard, ConsumableValuesCard } from "../ConsumableForm";
import { QuotationPicker } from "@/features/quotations";
import { Undo2, Package, Layers, BadgeDollarSign, UserCheck, Paperclip, CheckCircle2 } from "lucide-react";

const GENERAL_FIELDS = ["name", "brand", "inventory", "category", "description"];
const INVENTORY_FIELDS = ["senaPlate", "quantity", "location", "state", "serial"];
const VALUES_FIELDS = ["purchaseDate", "entryDate", "unitPrice", "totalPrice"];
const SUPPORT_FIELDS = ["cuentadantes", "photo", "technicalSheet", "quotations"];

const generalStepSchema = cmBaseSchema.pick({
    name: true,
    brand: false,
    description: true,
});

const inventoryStepSchema = cmBaseSchema.pick({
    senaPlate: true,
    serial: true,
    quantity: true,
    location: true,
    state: true,
}).superRefine((data, ctx) => {
    const hasSenaPlate = data.senaPlate && data.senaPlate.trim() !== "";

    if (hasSenaPlate) {
        if (data.quantity !== "1") {
            ctx.addIssue({
                path: ["quantity"],
                message: "La cantidad debe ser 1 cuando el material tiene placa SENA",
                code: z.ZodIssueCode.custom,
            });
        }
        return;
    }

    if (!data.quantity || data.quantity.trim() === "") {
        ctx.addIssue({
            path: ["quantity"],
            message: "La cantidad es obligatoria si no hay placa SENA",
            code: z.ZodIssueCode.custom,
        });
        return;
    }
    if (Number(data.quantity) <= 0) {
        ctx.addIssue({
            path: ["quantity"],
            message: "La cantidad debe ser mayor a 0",
            code: z.ZodIssueCode.custom,
        });
    }
});

const valuesStepSchema = cmBaseSchema.pick({
    purchaseDate: true,
    entryDate: true,
    unitPrice: true,
    totalPrice: true,
});

const supportStepSchema = cmBaseSchema.pick({
    user: false,
    cuentadantes: true,
    photo: true,
    technicalSheet: true,
    quotations: true,
});

export default function CmRegisterForm() {

    const navigate = useNavigate();
    const [brands, setBrands] = useState([]);
    const [users, setUsers] = useState([]);
    const [inventories, setInventories] = useState([]);
    const [categories, setCategories] = useState([]);
    const [errors, setErrors] = useState({});
    const [activeStep, setActiveStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState([false, false, false, false]);

    // Convencion de nombres unificada con ConsumableForm y el edit.
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        senaPlate: "",
        serial: "",
        quantity: "",
        location: "",
        brand: "",
        inventory: "",
        category: "",
        state: "Disponible",
        unitPrice: "",
        totalPrice: "",
        user: "",
        // Cuentadantes: array de IDs (M2M). Por defecto vacio, se llena con
        // el multi-select del paso 4.
        cuentadantes: [],
        purchaseDate: new Date().toISOString().split("T")[0],
        entryDate: new Date().toISOString().split("T")[0],
        photo: [],
        technicalSheet: [],
        quotations: [],
    });

    useEffect(() => {
        const controller = new AbortController();
        getBrands(controller.signal).then(setBrands).catch((err) => {
            if (err.name !== "AbortError") throw err;
        });
        return () => controller.abort();
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        getUsers(controller.signal).then(setUsers).catch((err) => {
            if (err.name !== "AbortError") throw err;
        });
        return () => controller.abort();
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        getInventories(controller.signal).then(setInventories).catch(() => setInventories([]));
        return () => controller.abort();
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        getCategories(controller.signal).then(setCategories).catch(() => setCategories([]));
        return () => controller.abort();
    }, []);

    // Crea una marca nueva, la agrega a las opciones y la devuelve al form.
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

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData((prev) => {
            const updated = { ...prev, [name]: value };

            // Si se ingresa placa SENA, la cantidad siempre es 1 y no es editable
            if (name === "senaPlate") {
                updated.quantity = value.trim() !== "" ? "1" : "";
            }

            // Calcular total automaticamente
            const quantity  = name === "quantity"  ? value : updated.quantity;
            const unitPrice = name === "unitPrice" ? value : updated.unitPrice;
            if (quantity && unitPrice) {
                const total = (parseFloat(quantity) * parseFloat(unitPrice)).toFixed(2);
                updated.totalPrice = isNaN(total) ? "" : total;
            }

            return updated;
        });
    };

    const handleFileChange = (name) => (files) => {
        setFormData((prev) => ({ ...prev, [name]: files }));
    };

    async function handleCancel() {
        const result = await cancelAlert();
        if (result.isConfirmed) navigate(-1);
    }

    async function handleSubmit(e) {
        e.preventDefault();

        try {
            const result = cmSchema.safeParse(formData);

            if (!result.success) {
                const fieldErrors = {};
                result.error.issues.forEach((issue) => {
                    const field = issue.path[0];
                    fieldErrors[field] = issue.message;
                });
                setErrors(fieldErrors);
                const stepByField = {
                    ...Object.fromEntries(GENERAL_FIELDS.map((f) => [f, 0])),
                    ...Object.fromEntries(INVENTORY_FIELDS.map((f) => [f, 1])),
                    ...Object.fromEntries(VALUES_FIELDS.map((f) => [f, 2])),
                    ...Object.fromEntries(SUPPORT_FIELDS.map((f) => [f, 3])),
                };
                const stepCandidates = Object.keys(fieldErrors).map((f) => stepByField[f]).filter((v) => v != null);
                if (stepCandidates.length) setActiveStep(Math.min(...stepCandidates));
                return;
            }

            setErrors({});

            // Pasar los archivos directamente de formData (no de result.data) para
            // evitar que z.instanceof(File) los descarte silenciosamente en Vite.
            await createCm({ ...result.data, photo: formData.photo, technicalSheet: formData.technicalSheet, quotations: formData.quotations });

            await showAlert({ icon: "success", iconColor: "var(--color-success)", title: "Material de consumo creado exitosamente" });
            navigate("/consumibles");

        } catch (error) {
            console.error("Error al crear material de consumo:", error);
            if (error.fieldErrors) setErrors((prev) => ({ ...prev, ...error.fieldErrors }));
            showAlert({ icon: "error", iconColor: "var(--color-error)", title: "Error al crear material de consumo", text: error.message });
        }
    }

    return (
        <div className="h-full text-text-primary flex flex-col gap-3">

            {/* Titulos */}
            <div className="flex items-center gap-3">
                <IconButton onClick={() => navigate(-1)} variant="ghost" ariaLabel="Volver atrás">
                    <Undo2 size={20}/>
                </IconButton>
                <h2 className="text-h2 text-text-primary font-heading">Crear Material de Consumo</h2>
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
                            <ConsumableGeneralCard
                                formData={formData}
                                errors={errors}
                                onChange={handleChange}
                                brands={brands}
                                inventories={inventories}
                                categories={categories}
                                onCreateBrand={handleCreateBrand}
                                onCreateInventory={handleCreateInventory}
                                onCreateCategory={handleCreateCategory}
                            />
                            <div className="flex gap-3 justify-between">
                                <Button type="button" variant="secondary" size="md" onClick={handleCancel}>
                                    Cancelar
                                </Button>
                                <Button type="button" variant="primary" size="md" onClick={nextStep}>
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
                            <ConsumableInventoryCard
                                formData={formData}
                                errors={errors}
                                onChange={handleChange}
                            />
                            <div className="flex gap-3 justify-between">
                                <Button type="button" variant="secondary" size="md" onClick={prevStep}>
                                    Atrás
                                </Button>
                                <Button type="button" variant="primary" size="md" onClick={nextStep}>
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
                            <ConsumableValuesCard
                                formData={formData}
                                errors={errors}
                                onChange={handleChange}
                            />
                            <div className="flex gap-3 justify-between">
                                <Button type="button" variant="secondary" size="md" onClick={prevStep}>
                                    Atrás
                                </Button>
                                <Button type="button" variant="primary" size="md" onClick={nextStep}>
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
                                <ConsumableAccountableCard
                                    formData={formData}
                                    errors={errors}
                                    onChange={handleChange}
                                    users={users}
                                />
                                <EditCard title="Archivos">
                                    <div className="flex flex-col gap-4">
                                        <ProfileFileInput
                                            label="Foto del Material"
                                            name="photo"
                                            value={formData.photo}
                                            onChange={handleFileChange("photo")}
                                            error={errors.photo}
                                            accept="image/*"
                                            className="w-full h-25 rounded-2xl"
                                            required
                                            description="Formato JPG o PNG. Tamaño máximo: 2MB."
                                        />
                                        <FileInput
                                            label="Ficha Técnica"
                                            name="technicalSheet"
                                            placeholder="Subir ficha técnica"
                                            required
                                            value={formData.technicalSheet}
                                            onChange={handleFileChange("technicalSheet")}
                                            error={errors.technicalSheet}
                                            accept="application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png"
                                            multiple={false}
                                            maxFiles={1}
                                            maxSizeMB={3}
                                            description="Formato PDF, Excel o PNG. Tamaño máximo: 3MB. Máximo 1 archivo."
                                            className="w-full h-14 rounded-2xl"
                                        />
                                        <QuotationPicker
                                            name="quotations"
                                            value={formData.quotations}
                                            onChange={handleChange}
                                            error={errors.quotations}
                                            required
                                        />
                                    </div>
                                </EditCard>
                            </div>
                            <div className="flex gap-3 justify-between">
                                <Button type="button" variant="secondary" size="md" onClick={prevStep}>
                                    Atrás
                                </Button>
                                <div className="flex gap-3">
                                    <Button type="button" variant="secondary" size="md" onClick={handleCancel}>
                                        Cancelar
                                    </Button>
                                    <Button type="submit" variant="primary" size="md">
                                        Crear
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
