import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button, showAlert, cancelAlert, IconButton, AccordionItem, isFormDirty, useDirtyForm, useDirtyFormStatus } from "@/shared";
import { getStoredUser } from "@/shared/services/api";
import loanSchema, { loanBaseSchema } from "../../schemas/loanSchema";
import { createLoanDraft, getDraftStatus } from "../../services/loanService";
import { getUsers, getMaterials } from "../../services/selectServices";
import { LoanMaterialCard, LoanReceptorCard, LoanDetailsCard, LoanJustificationCard } from "../LoanForm";
import { Undo2, CircleCheck, Clock, Package, User, CalendarDays, FileText, CheckCircle2 } from "lucide-react";

const POLL_INTERVAL_MS = 5000; // consultar cada 5 segundos

// Clasificación fija de 2 valores — no requiere un endpoint propio.
const LOAN_TYPE_OPTIONS = [
    { id: "Interno", label: "Interno" },
    { id: "Externo", label: "Externo" },
];

// Agrupación por pasos — mismo patrón que UserRegisterForm / CmRegisterForm.
// Solo cambia cómo se muestra el formulario; los campos y el submit son los mismos.
const MATERIAL_FIELDS = ["loanMaterial", "loanMaterialQuantities"];
const RECEPTOR_FIELDS = ["loanReceptorUser", "receptorIsRegistered", "receptorName", "receptorEmail", "receptorDataConsent"];
const DETAILS_FIELDS = ["loanType", "loanGroup", "loanReturnDate"];
const JUSTIFICATION_FIELDS = ["loanJustification"];

function getTodayDateString() {
    const today = new Date();
    const year  = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day   = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export default function LoanRegisterForm() {
    const navigate = useNavigate();

    // ID del usuario con sesión activa — se usa como responsable automático.
    const currentUser = getStoredUser();
    const currentUserId = currentUser ? String(currentUser.id) : "";

    const [users,      setUsers]      = useState([]);
    const [materials,  setMaterials]  = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [draftCreated, setDraftCreated] = useState(null);
    const [draftStatus, setDraftStatus]   = useState(null);
    const [activeStep, setActiveStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState([false, false, false, false]);
    const pollRef = useRef(null);

    const [formData, setFormData] = useState({
        loanResponsableUser:     currentUserId,   // auto-asignado, no editable
        loanReceptorUser:        "",
        receptorIsRegistered:    true,
        receptorName:            "",
        receptorEmail:           "",
        receptorDataConsent:     false,
        loanMaterial:            [],
        loanMaterialQuantities:  {},
        loanGroup:               "",
        loanType:                "",
        loanJustification:       "",
        loanReturnDate:          "",
    });

    const [errors, setErrors] = useState({});

    // Snapshot inicial — se ignora `loanResponsableUser` porque se autocompleta
    // con el id del usuario en sesión; considerarlo provocaría un falso "dirty".
    const initialFormData = useMemo(() => ({
        loanResponsableUser:     currentUserId,
        loanReceptorUser:        "",
        receptorIsRegistered:    true,
        receptorName:            "",
        receptorEmail:           "",
        receptorDataConsent:     false,
        loanMaterial:            [],
        loanMaterialQuantities:  {},
        loanGroup:               "",
        loanType:                "",
        loanJustification:       "",
        loanReturnDate:          "",
    }), [currentUserId]);

    const formDataRef = useRef(formData);
    formDataRef.current = formData;
    const checkDirty = useCallback(
        () => isFormDirty(formDataRef.current, initialFormData, ["loanResponsableUser"]),
        [initialFormData]
    );
    useDirtyForm(checkDirty);
    const { markClean } = useDirtyFormStatus();

    useEffect(() => { getUsers().then(setUsers); },         []);
    useEffect(() => { getMaterials().then(setMaterials); }, []);

    // Polling: consultar estado de firmas cada 5 s mientras hay un borrador activo.
    useEffect(() => {
        if (!draftCreated) {
            clearInterval(pollRef.current);
            return;
        }

        const poll = async () => {
            try {
                const st = await getDraftStatus(draftCreated.batch_id);
                setDraftStatus(st);
                // Cuando ambas partes firmaron, detener polling y navegar
                if (st.committed) {
                    clearInterval(pollRef.current);
                    await showAlert({
                        icon: "success",
                        iconColor: "var(--color-success)",
                        title: "¡Préstamo registrado!",
                        text: "Ambas partes firmaron. El préstamo ya está activo.",
                        timer: 3500,
                    });
                    markClean();
                    navigate("/prestamos");
                }
            } catch {
                // Error silencioso — no interrumpir la UI por un fallo de red puntual
            }
        };

        poll(); // llamada inmediata
        pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
        return () => clearInterval(pollRef.current);
    }, [draftCreated, navigate, markClean]);

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
        // Se construye desde el mismo loanSchema del submit para no duplicar
        // reglas ni modificar campos — el .pick conserva la validación base
        // del paso; las reglas cruzadas (stock, receptor condicional) se
        // verifican en el submit final, igual que en CmRegisterForm.
        const full = loanBaseSchema(materials, { multipleMaterials: true });
        const stepConfig = [
            { schema: full.pick({ loanMaterial: true, loanMaterialQuantities: true }), fields: MATERIAL_FIELDS },
            { schema: full.pick({ loanReceptorUser: true, receptorIsRegistered: true, receptorName: true, receptorEmail: true, receptorDataConsent: true }), fields: RECEPTOR_FIELDS },
            { schema: full.pick({ loanType: true, loanGroup: true, loanReturnDate: true }), fields: DETAILS_FIELDS },
            { schema: full.pick({ loanJustification: true }), fields: JUSTIFICATION_FIELDS },
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
        const { name, value, type, checked } = e.target;
        if (name === "loanMaterial") {
            setFormData((prev) => ({
                ...prev,
                loanMaterial: value,
                loanMaterialQuantities: Object.fromEntries(
                    value.map((mid) => [mid, prev.loanMaterialQuantities[mid] ?? "1"])
                ),
            }));
            return;
        }
        setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    };

    const handleMaterialQuantityChange = (materialId, quantity) => {
        setFormData((prev) => ({
            ...prev,
            loanMaterialQuantities: { ...prev.loanMaterialQuantities, [materialId]: quantity },
        }));
    };

    async function handleCancel() {
        const result = await cancelAlert();
        if (result.isConfirmed) {
            markClean();
            navigate(-1);
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault();

        const schema = loanSchema(materials, { multipleMaterials: true });
        const result = schema.safeParse(formData);

        if (!result.success) {
            const fieldErrors = {};
            result.error.issues.forEach((issue) => {
                const field      = issue.path[0];
                const materialId = issue.path[1];
                if (field === "loanMaterialQuantities" && materialId != null) {
                    fieldErrors.loanMaterialQuantities ??= {};
                    fieldErrors.loanMaterialQuantities[materialId] = issue.message;
                } else {
                    fieldErrors[field] = issue.message;
                }
            });
            setErrors(fieldErrors);
            const stepByField = {
                ...Object.fromEntries(MATERIAL_FIELDS.map((f) => [f, 0])),
                ...Object.fromEntries(RECEPTOR_FIELDS.map((f) => [f, 1])),
                ...Object.fromEntries(DETAILS_FIELDS.map((f) => [f, 2])),
                ...Object.fromEntries(JUSTIFICATION_FIELDS.map((f) => [f, 3])),
            };
            const stepCandidates = Object.keys(fieldErrors).map((f) => stepByField[f]).filter((v) => v != null);
            if (stepCandidates.length) setActiveStep(Math.min(...stepCandidates));
            return;
        }

        setErrors({});
        setSubmitting(true);

        try {
            const draft = await createLoanDraft(result.data);
            // Mostrar pantalla de confirmación en lugar de navegar a /prestamos.
            setDraftCreated(draft);
        } catch (err) {
            if (err.fieldErrors) setErrors((prev) => ({ ...prev, ...err.fieldErrors }));
            showAlert({
                icon: "error",
                iconColor: "var(--color-error)",
                title: "Error al crear la solicitud",
                text: err.message,
            });
        } finally {
            setSubmitting(false);
        }
    };

    // ── Pantalla de estado de firmas (polling activo) ─────────────────────
    if (draftCreated) {
        const s = draftStatus;
        const sigResponsable = s?.signed_responsable ?? false;
        const sigReceptor    = s?.signed_receptor    ?? false;
        const total          = (sigResponsable ? 1 : 0) + (sigReceptor ? 1 : 0);

        const SignRow = ({ label, signed }) => (
            <div className="flex items-center justify-between w-full px-4 py-3 rounded-[var(--radius-md)] bg-surface border border-border">
                <span className="text-small text-text-primary">{label}</span>
                {signed
                    ? <span className="flex items-center gap-1.5 text-success text-small font-medium"><CircleCheck size={16} /> Firmó</span>
                    : <span className="flex items-center gap-1.5 text-text-muted text-small"><Clock size={16} /> Pendiente</span>
                }
            </div>
        );

        return (
            <div className="h-full flex items-center justify-center">
                <div className="bg-surface-hover rounded-[var(--radius-3xl)] shadow-[var(--shadow-elevation-5)] px-6 sm:px-10 py-10 w-full max-w-md flex flex-col items-center gap-5 animate-slide-up">

                    <div className="flex flex-col items-center gap-1">
                        <span className="text-h2 font-heading text-text-primary">{total}/2</span>
                        <span className="text-small text-text-muted">firmas recibidas</span>
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                        <SignRow
                            label={s ? `Responsable: ${s.responsable_name}` : "Responsable"}
                            signed={sigResponsable}
                        />
                        <SignRow
                            label={s ? `Receptor: ${s.receptor_name}` : "Receptor"}
                            signed={sigReceptor}
                        />
                    </div>

                    <p className="text-small text-text-muted text-center">
                        {total < 2
                            ? "Esperando que ambas partes firmen desde el enlace enviado por correo. Esta pantalla se actualiza automáticamente."
                            : "Procesando…"
                        }
                    </p>

                    <div className="flex gap-2 items-center text-text-muted text-small animate-pulse">
                        <Clock size={14} />
                        Actualizando cada 5 segundos
                    </div>
                </div>
            </div>
        );
    }

    // ── Formulario por pasos ───────────────────────────────────────────────
    return (
        <div className="h-full text-text-primary flex flex-col gap-3">
            <div className="flex items-center gap-3">
                <IconButton onClick={() => navigate(-1)} variant="ghost">
                    <Undo2 size={20} />
                </IconButton>
                <h2 className="text-h2 text-text-primary font-heading">Crear Préstamo</h2>
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
                                    <span>Materiales</span>
                                    <span className="text-small text-text-muted">Paso 1 de 4</span>
                                </span>
                            </span>
                        }
                        open={activeStep === 0}
                        onToggle={() => goToStep(0)}
                    >
                        <div className="pt-4 flex flex-col gap-3">
                            <LoanMaterialCard
                                formData={formData}
                                errors={errors}
                                onChange={handleChange}
                                materials={materials}
                                multipleMaterials
                                onMaterialQuantityChange={handleMaterialQuantityChange}
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
                                    {completedSteps[1] ? <CheckCircle2 size={18} className="text-success" /> : <User size={18} />}
                                </span>
                                <span className="flex flex-col leading-tight">
                                    <span>Receptor</span>
                                    <span className="text-small text-text-muted">Paso 2 de 4</span>
                                </span>
                            </span>
                        }
                        open={activeStep === 1}
                        onToggle={() => goToStep(1)}
                    >
                        <div className="pt-4 flex flex-col gap-3">
                            <LoanReceptorCard
                                formData={formData}
                                errors={errors}
                                onChange={handleChange}
                                users={users}
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
                                    {completedSteps[2] ? <CheckCircle2 size={18} className="text-success" /> : <CalendarDays size={18} />}
                                </span>
                                <span className="flex flex-col leading-tight">
                                    <span>Detalles</span>
                                    <span className="text-small text-text-muted">Paso 3 de 4</span>
                                </span>
                            </span>
                        }
                        open={activeStep === 2}
                        onToggle={() => goToStep(2)}
                    >
                        <div className="pt-4 flex flex-col gap-3">
                            <LoanDetailsCard
                                formData={formData}
                                errors={errors}
                                onChange={handleChange}
                                loan_type={LOAN_TYPE_OPTIONS}
                                loanDepartureDate={getTodayDateString()}
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
                                    {completedSteps[3] ? <CheckCircle2 size={18} className="text-success" /> : <FileText size={18} />}
                                </span>
                                <span className="flex flex-col leading-tight">
                                    <span>Justificación</span>
                                    <span className="text-small text-text-muted">Paso 4 de 4</span>
                                </span>
                            </span>
                        }
                        open={activeStep === 3}
                        onToggle={() => goToStep(3)}
                    >
                        <div className="pt-4 flex flex-col gap-3">
                            <LoanJustificationCard
                                formData={formData}
                                errors={errors}
                                onChange={handleChange}
                            />
                            <div className="flex gap-3 justify-between">
                                <Button type="button" variant="secondary" size="md" onClick={prevStep} disabled={submitting}>
                                    Atrás
                                </Button>
                                <div className="flex gap-3">
                                    <Button type="button" variant="secondary" size="md" onClick={handleCancel} disabled={submitting}>
                                        Cancelar
                                    </Button>
                                    <Button type="submit" variant="primary" size="md" disabled={submitting}>
                                        {submitting ? "Enviando..." : "Crear y enviar firmas"}
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
