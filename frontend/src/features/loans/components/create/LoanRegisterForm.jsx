import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button, showAlert, cancelAlert, IconButton } from "@/shared";
import { getStoredUser } from "@/shared/services/api";
import loanSchema from "../../schemas/loanSchema";
import { createLoanDraft, getDraftStatus } from "../../services/loanService";
import { getUsers, getMaterials } from "../../services/selectServices";
import LoanForm from "../LoanForm";
import { Undo2, CircleCheck, Clock } from "lucide-react";

const POLL_INTERVAL_MS = 5000; // consultar cada 5 segundos

// Clasificación fija de 2 valores — no requiere un endpoint propio.
const LOAN_TYPE_OPTIONS = [
    { id: "Interno", label: "Interno" },
    { id: "Externo", label: "Externo" },
];

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
    const pollRef = useRef(null);

    const [formData, setFormData] = useState({
        loanResponsableUser:     currentUserId,   // auto-asignado, no editable
        loanReceptorUser:        "",
        receptorIsRegistered:    true,
        receptorName:            "",
        receptorEmail:           "",
        loanMaterial:            [],
        loanMaterialQuantities:  {},
        loanGroup:               "",
        loanType:                "",
        loanJustification:       "",
        loanReturnDate:          "",
    });

    const [errors, setErrors] = useState({});

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
                    navigate("/prestamos");
                }
            } catch {
                // Error silencioso — no interrumpir la UI por un fallo de red puntual
            }
        };

        poll(); // llamada inmediata
        pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
        return () => clearInterval(pollRef.current);
    }, [draftCreated, navigate]);

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
        if (result.isConfirmed) navigate(-1);
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
            <div className="h-full p-3 sm:p-4 flex items-center justify-center">
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

    // ── Formulario ────────────────────────────────────────────────────────
    return (
        <div className="h-full p-3 sm:p-4 text-text-primary flex flex-col gap-3">
            <div className="flex items-center gap-3">
                <IconButton onClick={() => navigate(-1)} variant="ghost">
                    <Undo2 size={20} />
                </IconButton>
                <h2 className="text-primary">Crear Préstamo</h2>
            </div>

            <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6 w-full">
                <LoanForm
                    formData={formData}
                    errors={errors}
                    onChange={handleChange}
                    users={users}
                    materials={materials}
                    multipleMaterials
                    loan_type={LOAN_TYPE_OPTIONS}
                    onMaterialQuantityChange={handleMaterialQuantityChange}
                    loanDepartureDate={getTodayDateString()}
                    hideResponsable
                />

                <div className="flex gap-4 justify-center md:justify-end">
                    <Button type="button" variant="secondary" size="md" onClick={handleCancel}>
                        Cancelar
                    </Button>
                    <Button type="submit" variant="primary" size="md" disabled={submitting}>
                        {submitting ? "Enviando..." : "Crear y enviar firmas"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
