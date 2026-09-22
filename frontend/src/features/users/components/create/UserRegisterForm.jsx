import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getDocumentTypes } from "../../services/selectServices";
import useUserGroups from "../../hooks/useUserGroups";
import { Button, Input, StatusLabel, DataConsentCheckbox, showAlert, cancelAlert, IconButton, usePermissions, AccordionItem } from "@/shared";
import { userBaseSchema, userSchema } from "../../schemas/userSchema";
import { createUser } from "../../services/userService";
import { deriveRoleFlags } from "../../utils/userRoleUtils";
import { UserPersonalCard, UserContactCard, UserSystemCard, UserDatesCard } from "../UserForm";
import { Undo2, User, Phone, Shield, CalendarDays, CheckCircle2 } from "lucide-react";

const PERSONAL_FIELDS = ["firstName", "lastName", "documentType", "documentNumber", "address"];
const CONTACT_FIELDS = ["email", "confirmEmail", "institutionalEmail", "phone", "additionalPhone"];
const SYSTEM_FIELDS = ["groups", "isInstructorPlanta", "isAccountable"];
const DATES_FIELDS = ["startDate", "endDate"];

const personalStepSchema = userBaseSchema.pick({
    firstName: true,
    lastName: true,
    documentType: true,
    documentNumber: true,
    address: true,
});

const contactStepSchema = userBaseSchema.pick({
    email: true,
    confirmEmail: true,
    institutionalEmail: true,
    phone: true,
    additionalPhone: true,
}).refine(
    (data) => data.email === data.confirmEmail,
    { message: "Los correos no coinciden", path: ["confirmEmail"] }
).refine(
    (data) => !data.institutionalEmail || data.institutionalEmail !== data.email,
    { message: "No puede coincidir con el correo personal", path: ["institutionalEmail"] }
);

const systemStepSchema = userBaseSchema.pick({
    groups: true,
    isInstructorPlanta: true,
    isAccountable: true,
});

const datesStepSchema = userBaseSchema.pick({
    startDate: true,
    endDate: true,
}).refine(
    (data) => !data.startDate || !data.endDate || data.endDate >= data.startDate,
    { message: "La fecha de finalización no puede ser anterior a la de inicio", path: ["endDate"] }
);

export default function UserRegisterForm() {

    const navigate = useNavigate();
    const [activeStep, setActiveStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState([false, false, false, false]);

    // Usa la misma convencion de nombres que el UserForm reutilizable.
    // `confirmEmail` es extra propio de la creacion.
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        confirmEmail: "",
        institutionalEmail: "",
        profilePicture: [],
        documentType: "",
        groups: "",
        documentNumber: "",
        startDate: "",
        endDate: "",
        additionalPhone: "",
        phone: "",
        address: "",
        isInstructorPlanta: false,
        isAccountable: false,
        dataConsent: false,
    });

    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [showAdditionalPhone, setShowAdditionalPhone] = useState(false);
    const [showEmailInst, setShowEmailInst] = useState(false);
    const { can, isSuper } = usePermissions();
    // RFADMIN02: crear usuarios requiere el permiso create_user (o ser superusuario).
    // Misma regla que UserListPage — antes exigía además el grupo "ADMIN" exacto,
    // lo que rebotaba a admins con create_user por un grupo personalizado.
    const canCreateUsers = isSuper || can("create_user");

    const [documentTypes, setDocumentTypes] = useState([]);
    useEffect(() => {
        getDocumentTypes()
            .then((types) => {
                // Ocultar la entrada duplicada "C.C" del formulario de creación.
                const filtered = types.filter((t) => t.label !== "C.C");
                setDocumentTypes(filtered);
            })
            .catch((err) =>
                showAlert({
                    icon: "error",
                    iconColor: "var(--color-error)",
                    title: "No se pudieron cargar los tipos de documento",
                    text: err.message,
                })
            );
    }, []);

    const { groups: userGroups } = useUserGroups();
    const availableGroups = userGroups.filter((group) => String(group.label || "").trim().toUpperCase() !== "SADMIN");

    const { isInstructorRole } = deriveRoleFlags(userGroups, formData.groups);

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
            { schema: personalStepSchema, fields: PERSONAL_FIELDS },
            { schema: contactStepSchema, fields: CONTACT_FIELDS },
            { schema: systemStepSchema, fields: SYSTEM_FIELDS },
            { schema: datesStepSchema, fields: DATES_FIELDS },
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

    useEffect(() => {
        // usePermissions lee sessionStorage sincrónicamente — canCreateUsers es
        // correcto desde el primer render, no hay race condition de carga async.
        if (!canCreateUsers) {
            showAlert({
                icon: "warning",
                iconColor: "var(--color-warning)",
                title: "Sin permisos",
                text: "No tienes permiso para crear usuarios.",
            });
            navigate("/usuarios");
        }
    }, [canCreateUsers, navigate]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;

        if (name === "groups") {
            // Usar deriveRoleFlags con el nuevo valor para resetear isInstructorPlanta
            // si el grupo seleccionado deja de ser de tipo instructor.
            const { isInstructorRole } = deriveRoleFlags(userGroups, value);
            setFormData((prev) => ({
                ...prev,
                groups: value,
                isInstructorPlanta: isInstructorRole ? prev.isInstructorPlanta : false,
            }));
            return;
        }

        setFormData((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    const handleProfileChange = (files) => {
        setFormData((prev) => ({ ...prev, profilePicture: files }));
    };

    async function handleCancel() {
        const result = await cancelAlert();
        if (result.isConfirmed) navigate(-1);
    }

    async function handleSubmit(e) {
        e.preventDefault();

        // Guardia de envío: protege incluso si se intenta enviar el formulario
        // antes de que la redirección reactiva haya terminado.
        if (!canCreateUsers) {
            await showAlert({
                icon: "warning",
                iconColor: "var(--color-warning)",
                title: "Sin permisos",
                text: "Solo los usuarios con rol ADMIN pueden crear usuarios.",
            });
            navigate("/usuarios");
            return;
        }

        // --- Fase 1: validación (síncrona, fuera del try de submit) ---
        const result = userSchema.safeParse(formData);

        if (!result.success) {
            const fieldErrors = {};
            result.error.issues.forEach((issue) => {
                const field = issue.path[0];
                if (field !== undefined && !(field in fieldErrors)) fieldErrors[field] = issue.message;
            });
            setErrors(fieldErrors);
            const stepByField = {
                ...Object.fromEntries(PERSONAL_FIELDS.map((f) => [f, 0])),
                ...Object.fromEntries(CONTACT_FIELDS.map((f) => [f, 1])),
                ...Object.fromEntries(SYSTEM_FIELDS.map((f) => [f, 2])),
                ...Object.fromEntries(DATES_FIELDS.map((f) => [f, 3])),
            };
            const stepCandidates = Object.keys(fieldErrors).map((f) => stepByField[f]).filter((v) => v != null);
            if (stepCandidates.length) setActiveStep(Math.min(...stepCandidates));
            return;
        }

        // --- Fase 2: submit async — setSubmitting ANTES del try para que
        //     finally siempre lo resetee correctamente ---
        setErrors({});
        setSubmitting(true);

        try {
            const user = await createUser({
                ...result.data,
                // Fusionar campos que Zod puede omitir si son undefined/optional.
                profilePicture: formData.profilePicture,
            });

            // Alerta de exito con auto-cierre (4s) + barra de progreso y boton
            // "Aceptar" para cerrar manualmente.
            await showAlert({
                icon: "success",
                iconColor: "var(--color-success)",
                title: "Usuario creado exitosamente",
                timer: 4000,
            });
            navigate("/usuarios");

        } catch (error) {
            if (error.partialSuccess) {
                // El usuario ya se creó (y su contraseña ya se envió por correo) —
                // solo falló la asignación del grupo. Navegar igual, mismo criterio
                // que UserEditView para este mismo tipo de fallo.
                await showAlert({
                    icon: "warning",
                    iconColor: "var(--color-warning)",
                    title: "Usuario creado, pero con un problema",
                    text: error.message,
                });
                navigate("/usuarios");
                return;
            }
            console.error("Error al crear usuario:", error);
            if (error.fieldErrors) setErrors((prev) => ({ ...prev, ...error.fieldErrors }));
            // Los errores NO llevan timer: deben permanecer hasta que el usuario los lea y cierre.
            await showAlert({ icon: "error", iconColor: "var(--color-error)", title: "Error al crear usuario", text: error.message });
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <>
            <div className="h-full text-text-primary flex flex-col gap-3">

                <div className="flex items-center gap-3">
                    <IconButton onClick={() => navigate(-1)} variant="ghost">
                        <Undo2 size={20}/>
                    </IconButton>
                    <h2 className="text-h2 text-text-primary font-heading">Registro de Usuarios</h2>
                </div>

                <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">

                    <div className="flex flex-col gap-3">
                        <AccordionItem
                            title={
                                <span className="flex items-center gap-3">
                                    <span className="size-9 rounded-[var(--radius-full)] border border-border bg-surface-muted flex items-center justify-center">
                                        {completedSteps[0] ? <CheckCircle2 size={18} className="text-success" /> : <User size={18} />}
                                    </span>
                                    <span className="flex flex-col leading-tight">
                                        <span>Información personal</span>
                                        <span className="text-small text-text-muted">Paso 1 de 4</span>
                                    </span>
                                </span>
                            }
                            open={activeStep === 0}
                            onToggle={() => goToStep(0)}
                        >
                            <div className="pt-4 flex flex-col gap-3">
                                <UserPersonalCard
                                    formData={formData}
                                    errors={errors}
                                    onChange={handleChange}
                                    onPhotoChange={handleProfileChange}
                                    documentTypes={documentTypes}
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
                                        {completedSteps[1] ? <CheckCircle2 size={18} className="text-success" /> : <Phone size={18} />}
                                    </span>
                                    <span className="flex flex-col leading-tight">
                                        <span>Contacto</span>
                                        <span className="text-small text-text-muted">Paso 2 de 4</span>
                                    </span>
                                </span>
                            }
                            open={activeStep === 1}
                            onToggle={() => goToStep(1)}
                        >
                            <div className="pt-4 flex flex-col gap-3">
                                <UserContactCard
                                    formData={formData}
                                    errors={errors}
                                    onChange={handleChange}
                                    confirmEmailSlot={
                                        <Input
                                            label="Confirmar correo electrónico"
                                            name="confirmEmail"
                                            type="email"
                                            placeholder="Confirma el correo electrónico"
                                            value={formData.confirmEmail}
                                            onChange={handleChange}
                                            error={errors.confirmEmail}
                                            required
                                        />
                                    }
                                    contactExtraSlot={
                                        <div className="flex flex-col gap-2">
                                            <StatusLabel optional>Teléfono adicional</StatusLabel>
                                            {!showAdditionalPhone ? (
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="md"
                                                    onClick={() => setShowAdditionalPhone(true)}
                                                >
                                                    Agregar número
                                                </Button>
                                            ) : (
                                                <Input
                                                    name="additionalPhone"
                                                    placeholder="Número de teléfono adicional"
                                                    value={formData.additionalPhone}
                                                    onChange={handleChange}
                                                    error={errors.additionalPhone}
                                                />
                                            )}
                                        </div>
                                    }
                                    emailInst={
                                        <div className="flex flex-col gap-2">
                                            <StatusLabel optional>Correo Institucional</StatusLabel>
                                            {!showEmailInst ? (
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="md"
                                                    onClick={() => setShowEmailInst(true)}
                                                >
                                                    Agregar Correo Institucional
                                                </Button>
                                            ) : (
                                                <Input
                                                    name="institutionalEmail"
                                                    type="email"
                                                    optional
                                                    placeholder="correo@sena.edu.co"
                                                    onChange={handleChange}
                                                    value={formData.institutionalEmail}
                                                    error={errors.institutionalEmail}
                                                />
                                            )}
                                        </div>
                                    }
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
                                        {completedSteps[2] ? <CheckCircle2 size={18} className="text-success" /> : <Shield size={18} />}
                                    </span>
                                    <span className="flex flex-col leading-tight">
                                        <span>Sistema</span>
                                        <span className="text-small text-text-muted">Paso 3 de 4</span>
                                    </span>
                                </span>
                            }
                            open={activeStep === 2}
                            onToggle={() => goToStep(2)}
                        >
                            <div className="pt-4 flex flex-col gap-3">
                                <UserSystemCard
                                    formData={formData}
                                    errors={errors}
                                    onChange={handleChange}
                                    groups={availableGroups}
                                    singleGroupSelection
                                    isInstructorRole={isInstructorRole}
                                    includeDates={false}
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
                                        {completedSteps[3] ? <CheckCircle2 size={18} className="text-success" /> : <CalendarDays size={18} />}
                                    </span>
                                    <span className="flex flex-col leading-tight">
                                        <span>Vigencia</span>
                                        <span className="text-small text-text-muted">Paso 4 de 4</span>
                                    </span>
                                </span>
                            }
                            open={activeStep === 3}
                            onToggle={() => goToStep(3)}
                        >
                            <div className="pt-4 flex flex-col gap-3">
                                <UserDatesCard
                                    formData={formData}
                                    errors={errors}
                                    onChange={handleChange}
                                />
                                <DataConsentCheckbox
                                    id="dataConsent"
                                    name="dataConsent"
                                    checked={formData.dataConsent === true}
                                    onChange={handleChange}
                                    error={errors.dataConsent}
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
                                            {submitting ? "Creando..." : "Crear"}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </AccordionItem>
                    </div>
                </form>

            </div>
        </>
    );
}
