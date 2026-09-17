import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, IconButton, Input, StatusBadge, EditCard, showAlert, cancelAlert, usePermissions } from "@/shared";
import useUser from "../../hooks/useUser.js";
import { resendCredentials } from "../../services/userService.js";
import { TailChase } from 'ldrs/react'
import 'ldrs/react/TailChase.css'
import { Undo2, Mail, Download } from "lucide-react";
import { generateUserProfileReport } from "@/shared/reports/generateUserProfileReport";

export default function UserDetailView() {
    const navigate = useNavigate();
    const { id }   = useParams();

    // FETCH GET /api/users/{id}/
    const { user, loading, error } = useUser(id);

    const { isSuper, can } = usePermissions();
    const canEdit = isSuper || can("edit_user");

    // Estado local para el boton de reenviar credenciales
    const [resending, setResending] = useState(false);
    const [generatingReport, setGeneratingReport] = useState(false);

    if (loading)
        return (
            <div className="h-full flex items-center justify-center">
                <TailChase size="40" speed="1.75" color="var(--semantic-text-primary)"/>
            </div>
        )

    if (error) return <p>Error al cargar Usuarios: {error.message}</p>

    // Guard defensivo: user puede ser null si loading pasó a false sin error
    // (ej. respuesta vacía del servidor). Evita crash al acceder a sus propiedades.
    if (!user) return null

    // Valores de solo lectura (los selects de Editar se muestran como texto).
    const documentTypeLabel = user.document_type?.name ?? "Sin tipo de documento";
    // Los grupos del usuario (GET /api/users/{id}/) vienen como { id, name }.
    // Distinto de las opciones del Select (GET /api/permissions/groups/) que se
    // mapean a { id, label }. Por eso aquí se usa g.name y en UserForm/deriveRoleFlags
    // se usa g.label — ambos son correctos para su fuente de datos respectiva.
    const groupsLabel = user.groups && user.groups.length > 0
        ? user.groups.map((g) => g.name).join(", ")
        : "Sin grupo asignado";
    const isActive = user.is_active === true;

    const isInstPlanta = user.is_instructor_planta === true ? "Sí" : "No";

    const isINST = user.groups?.some((g) => {
        const n = (g.name ?? "").toUpperCase();
        return n.includes("INST") || n.includes("INSTRUCTOR");
    }) ?? false;

    // Genera una nueva contraseña para el usuario y se la envia por correo.
    // Accion administrativa: invalida la contraseña anterior del usuario.
    const handleResendCredentials = async () => {
        const result = await cancelAlert({
            title: "¿Reenviar credenciales?",
            text: `Se generará una nueva contraseña para ${user.first_name} ${user.last_name} y se enviará a ${user.email}. La contraseña actual dejará de funcionar.`,
            confirmText: "Sí, reenviar",
            cancelText: "Cancelar",
        });

        if (!result.isConfirmed) return;

        try {
            setResending(true);
            await resendCredentials(user.id);
            await showAlert({
                icon: "success",
                iconColor: "var(--color-success)",
                title: "Credenciales reenviadas",
                text: `Se envió una nueva contraseña a ${user.email}.`,
                timer: 4000,
            });
        } catch (err) {
            await showAlert({
                icon: "error",
                iconColor: "var(--color-error)",
                title: "No se pudo reenviar las credenciales",
                text: err.message,
            });
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="h-full p-3 sm:p-4 text-text-primary flex flex-col gap-3">

            {/* Encabezado */}
            <div className="flex items-center gap-3">
                <IconButton onClick={() => navigate(-1)} variant="ghost">
                    <Undo2 size={20}/>
                </IconButton>
                <div>
                    <h2 className="text-primary">Visualizar Usuario</h2>
                </div>
            </div>

            <div className="flex flex-col gap-3">

                {/* Información Personal — foto lateral + campos */}
                <EditCard title="Información Personal" cols={1}>
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">

                        {/* Foto + estado */}
                        <div className="flex flex-col items-center gap-2 shrink-0">
                            <div className="w-24 h-24 rounded-[var(--radius-xl)] overflow-hidden border border-border bg-surface-muted flex items-center justify-center">
                                {user.profile_picture
                                    // profile_picture llega como ruta relativa (/media/...) desde el backend.
                                    // En dev, Vite proxea /media → http://127.0.0.1:8000 (vite.config.js).
                                    // En producción se asume same-origin; si backend y frontend van en
                                    // dominios distintos habrá que prefijar con la URL base del backend.
                                    ? <img src={user.profile_picture} alt={user.first_name} className="w-full h-full object-cover" />
                                    : <span className="text-h1 font-heading text-text-muted">{(user.first_name ?? "?")[0].toUpperCase()}</span>
                                }
                            </div>
                            <StatusBadge active={isActive} />
                        </div>

                        {/* Campos personales */}
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 min-w-0">
                            <Input label="Nombres" value={user.first_name ?? "No definido"} disabled readOnly />
                            <Input label="Apellidos" value={user.last_name ?? "No definido"} disabled readOnly />
                            <Input label="Tipo de documento" value={documentTypeLabel} disabled readOnly />
                          
                            <Input label="Número de documento" value={user.document_number ?? "No definido"} disabled readOnly />
                            <div className="sm:col-span-2">
                                <Input label="Dirección" value={user.address ?? "No definido"} disabled readOnly />
                            </div>
                        </div>

                    </div>
                </EditCard>

                {/* Contacto y Sistema lado a lado */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                    <EditCard title="Información de Contacto">
                        <Input label="Correo electrónico" value={user.email ?? "No definido"} disabled readOnly />
                        <Input label="Correo institucional" value={user.institutional_email ?? "No definido"} disabled readOnly />
                        <Input label="Teléfono" value={user.phone_number ?? "No definido"} disabled readOnly />
                        <Input label="Teléfono adicional" value={user.second_phone_number ?? "No definido"} disabled readOnly />

                        {/* Accion administrativa: reenviar credenciales de acceso */}
                        {canEdit && (
                            <div className="pt-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="md"
                                    className="flex gap-2 justify-center w-full"
                                    onClick={handleResendCredentials}
                                    disabled={resending}
                                >
                                    <Mail size={16} />
                                    {resending ? "Enviando..." : "Reenviar credenciales"}
                                </Button>
                            </div>
                        )}
                    </EditCard>

                    <EditCard title="Información del Sistema">
                        <Input label="Tipo de usuario" value={groupsLabel} disabled readOnly />
                        {isINST && (
                            <Input label="Instructor de Planta" value={isInstPlanta} disabled readOnly/>
                        )}
                        <Input label="Estado" value={isActive ? "Activo" : "Inactivo"} disabled readOnly />
                        <Input label="Fecha de inicio" value={user.start_date ?? "No definida"} disabled readOnly />
                        <Input label="Fecha de finalización" value={user.end_date ?? "No definida"} disabled readOnly />
                    </EditCard>

                </div>

                <div className="flex gap-8 pb-6 justify-center md:justify-end md:pb-0">
                    <Button variant="secondary" size="md" onClick={() => navigate(`/usuarios`)}>
                        Volver al inicio
                    </Button>
                    {canEdit && (
                        <Button variant="primary" size="md" onClick={() => navigate(`/usuarios/editar/${user.id}`)}>
                            Editar
                        </Button>
                    )}
                    <Button
                        variant="secondary"
                        size="md"
                        icon={Download}
                        disabled={generatingReport}
                        onClick={async () => {
                            setGeneratingReport(true);
                            try {
                                await generateUserProfileReport(user);
                            } catch {
                                await showAlert({
                                    icon: "error",
                                    iconColor: "var(--color-error)",
                                    title: "No se pudo generar el reporte",
                                    text: "Ocurrió un error al crear el PDF. Intenta nuevamente.",
                                });
                            } finally {
                                setGeneratingReport(false);
                            }
                        }}
                    >
                        {generatingReport ? "Generando..." : "Generar reporte"}
                    </Button>
                </div>

            </div>

        </div>
    );
}
