import { useEffect, useState } from "react";
import { KeyRound, Save, UserRound, Pencil, X } from "lucide-react";
import { TailChase } from "ldrs/react";
import { Button, EditCard, Input, ProfileFileInput, showAlert, SupportContact } from "@/shared";
import { updateStoredUser } from "@/shared/services/api";
import { getMyProfile, updateMyProfile, updateUserProfilePicture } from "../../services/userService";
import ChangePasswordModal from "../../components/ChangePasswordModal";

const readOnlyValue = (value) => value || "No registrado";

// Ley 1581 de 2012 (actualización/rectificación): el titular edita sus
// propios datos básicos. Nombres de campo del backend.
const EDITABLE_FIELDS = ["first_name", "last_name", "phone_number", "second_phone_number", "address"];

export default function ProfileEditPage() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [profilePicture, setProfilePicture] = useState([]);
    const [savingPicture, setSavingPicture] = useState(false);
    const [changePasswordOpen, setChangePasswordOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [editErrors, setEditErrors] = useState({});
    const [savingData, setSavingData] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        getMyProfile(controller.signal)
            .then((data) => {
                setUser(data);
                setProfilePicture(data.profile_picture ? [data.profile_picture] : []);
            })
            .catch((requestError) => {
                if (requestError.name !== "AbortError") setError(requestError);
            })
            .finally(() => setLoading(false));

        return () => controller.abort();
    }, []);

    const handleSavePicture = async () => {
        const picture = profilePicture[0];
        if (!(picture instanceof File)) {
            await showAlert({
                icon: "info",
                title: "Selecciona una nueva imagen",
                text: "Elige una foto JPG o PNG antes de guardar los cambios.",
            });
            return;
        }

        setSavingPicture(true);
        try {
            const updatedUser = await updateUserProfilePicture(picture);
            setUser(updatedUser);
            // Se agrega timestamp para forzar al browser a descargar la imagen
            // nueva en lugar de servir la versión cacheada.
            const pictureUrl = updatedUser.profile_picture
                ? [`${updatedUser.profile_picture}?t=${Date.now()}`]
                : [];
            setProfilePicture(pictureUrl);
            // Persistir en la sesión (no solo en el estado local del
            // componente) y avisar al resto de la app — así el avatar del
            // Navbar se actualiza sin recargar la página.
            updateStoredUser({ profile_picture: updatedUser.profile_picture });
            await showAlert({
                icon: "success",
                iconColor: "var(--color-success)",
                title: "Foto de perfil actualizada",
            });
        } catch (requestError) {
            await showAlert({
                icon: "error",
                iconColor: "var(--color-error)",
                title: "No se pudo actualizar la foto",
                text: requestError.message,
            });
        } finally {
            setSavingPicture(false);
        }
    };


    if (loading) {
        return <div className="h-full flex items-center justify-center"><TailChase size="40" speed="1.75" color="var(--semantic-text-primary)" /></div>;
    }

    if (error || !user) {
        return <div className="p-4 text-error">No se pudo cargar tu perfil: {error?.message ?? "Usuario no encontrado."}</div>;
    }

    const groupNames = user.groups?.map((group) => group.name).filter(Boolean).join(", ");

    const startEdit = () => {
        setEditForm({
            first_name: user.first_name ?? "",
            last_name: user.last_name ?? "",
            phone_number: user.phone_number ?? "",
            second_phone_number: user.second_phone_number ?? "",
            address: user.address ?? "",
        });
        setEditErrors({});
        setEditing(true);
    };

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSaveData = async () => {
        const errs = {};
        if (!editForm.first_name.trim() || !editForm.last_name.trim()) {
            errs.first_name = !editForm.first_name.trim() ? "El nombre es obligatorio." : undefined;
            errs.last_name = !editForm.last_name.trim() ? "El apellido es obligatorio." : undefined;
        }
        for (const key of ["phone_number", "second_phone_number"]) {
            const v = (editForm[key] ?? "").trim();
            if (v && !/^\d+$/.test(v)) errs[key] = "Solo se permiten números.";
            else if (v && (v.length < 7 || v.length > 15)) errs[key] = "Debe tener entre 7 y 15 dígitos.";
        }
        const addr = (editForm.address ?? "").trim();
        if (addr && addr.length < 10) errs.address = "La dirección debe tener mínimo 10 caracteres.";
        setEditErrors(errs);
        if (Object.values(errs).some(Boolean)) return;

        setSavingData(true);
        try {
            const updated = await updateMyProfile({ fields: editForm });
            setUser(updated);
            updateStoredUser({ first_name: updated.first_name, last_name: updated.last_name });
            setEditing(false);
            await showAlert({
                icon: "success",
                iconColor: "var(--color-success)",
                title: "Datos actualizados",
                text: "Tus datos personales fueron actualizados correctamente.",
            });
        } catch (requestError) {
            if (requestError.fieldErrors) setEditErrors(requestError.fieldErrors);
            else await showAlert({ icon: "error", iconColor: "var(--color-error)", title: "No se pudieron guardar los cambios", text: requestError.message });
        } finally {
            setSavingData(false);
        }
    };

    return (
        <div className="text-text-primary flex flex-col gap-3">
            <div className="flex items-center gap-3">
                <div>
                    <h2 className="text-h2 text-text-primary font-heading">Mi perfil</h2>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 md:items-stretch">
                <EditCard title="Foto de perfil" cols={1} className="md:w-64 md:shrink-0">
                    {/* móvil: foto e botón en fila | desktop: columna centrada */}
                    <div className="flex flex-row items-center gap-4 md:flex-col md:items-center">
                        <ProfileFileInput
                            className="w-28 h-36 rounded-[var(--radius-xl)] shrink-0"
                            value={profilePicture}
                            onChange={setProfilePicture}
                            description="Formato JPG o PNG. Tamaño máximo: 2MB."
                        />
                        <Button onClick={handleSavePicture} disabled={savingPicture} className="flex-1 md:w-full md:flex-none">
                            <Save size={16} />
                            {savingPicture ? "Guardando..." : "Guardar foto"}
                        </Button>
                    </div>
                </EditCard>

                <EditCard title="Información personal" className="flex-1">
                    {!editing ? (
                        <>
                            <Input label="Nombres" value={readOnlyValue(user.first_name)} readOnly disabled/>
                            <Input label="Apellidos" value={readOnlyValue(user.last_name)} readOnly disabled/>
                            <Input label="Tipo de documento" value={readOnlyValue(user.document_type?.name)} readOnly disabled />
                            <Input label="Número de documento" value={readOnlyValue(user.document_number)} readOnly disabled />
                            <div className="sm:col-span-2"><Input label="Dirección" value={readOnlyValue(user.address)} readOnly disabled /></div>
                            <div className="sm:col-span-2 flex justify-end">
                                <Button variant="secondary" onClick={startEdit}>
                                    <Pencil size={16} /> Editar mis datos
                                </Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <Input label="Nombres" name="first_name" value={editForm.first_name} onChange={handleEditChange} error={editErrors.first_name} required />
                            <Input label="Apellidos" name="last_name" value={editForm.last_name} onChange={handleEditChange} error={editErrors.last_name} required />
                            <Input label="Tipo de documento" value={readOnlyValue(user.document_type?.name)} readOnly disabled />
                            <Input label="Número de documento" value={readOnlyValue(user.document_number)} readOnly disabled />
                            <div className="sm:col-span-2"><Input label="Dirección" name="address" value={editForm.address} onChange={handleEditChange} error={editErrors.address} /></div>
                            <div className="sm:col-span-2 flex gap-2 justify-end">
                                <Button variant="secondary" onClick={() => setEditing(false)} disabled={savingData}>
                                    <X size={16} /> Cancelar
                                </Button>
                                <Button onClick={handleSaveData} disabled={savingData}>
                                    <Save size={16} /> {savingData ? "Guardando..." : "Guardar"}
                                </Button>
                            </div>
                        </>
                    )}
                </EditCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <EditCard title="Información de contacto" cols={1}>
                    <Input label="Correo electrónico" value={readOnlyValue(user.email)} readOnly disabled />
                    <Input label="Correo institucional" value={readOnlyValue(user.institutional_email)} readOnly disabled />
                    {editing ? (
                        <>
                            <Input label="Teléfono" name="phone_number" value={editForm.phone_number} onChange={handleEditChange} error={editErrors.phone_number} required />
                            <Input label="Teléfono adicional" name="second_phone_number" value={editForm.second_phone_number} onChange={handleEditChange} error={editErrors.second_phone_number} />
                        </>
                    ) : (
                        <>
                            <Input label="Teléfono" value={readOnlyValue(user.phone_number)} readOnly disabled />
                            <Input label="Teléfono adicional" value={readOnlyValue(user.second_phone_number)} readOnly disabled />
                        </>
                    )}
                </EditCard>
                <div className="grid grid-cols gap-3">
                    <EditCard title="Información del sistema" cols={1}>
                        <Input label="Fecha de inicio" value={readOnlyValue(user.start_date)} readOnly disabled/>
                        <Input label="Fecha de finalización" value={readOnlyValue(user.end_date)} readOnly disabled />
                        <Input label="Tipo de usuario" value={readOnlyValue(groupNames)} readOnly disabled />
                    </EditCard>
                    <EditCard title="Seguridad" cols={1}>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <p className="text-medium">Contraseña</p>
                                <p className="text-small text-text-muted">Cambia la contraseña de tu cuenta.</p>
                            </div>
                            <Button variant="secondary" onClick={() => setChangePasswordOpen(true)}>
                                <KeyRound size={16} /> Cambiar contraseña
                            </Button>
                        </div>
                    </EditCard>
                </div>
            </div>

            <ChangePasswordModal
                isOpen={changePasswordOpen}
                onClose={() => setChangePasswordOpen(false)}
            />

            {/* Contacto con soporte (editable solo por superusuario) */}
            <SupportContact />

        </div>
    );
}
