import { apiFetch, throwApiError } from "@/shared/services/api";

// Mapea los nombres de campo que devuelve el backend a las keys del formData
// del formulario de usuarios, para poder mostrar el error junto al input correcto.
const FIELD_MAP = {
    first_name: "firstName",
    last_name: "lastName",
    document_type_id: "documentType",
    document_number: "documentNumber",
    email: "email",
    phone_number: "phone",
    second_phone_number: "additionalPhone",
    institutional_email: "institutionalEmail",
    address: "address",
    start_date: "startDate",
    end_date: "endDate",
    is_accountable: "isAccountable",
    data_consent: "dataConsent",
};

// METODO GET (obtener lista de usuarios)
export async function getUsers(signal) {
    const response = await apiFetch("/api/users/", { signal });
    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
}

// METODO GET (obtener un usuario por su ID)
export async function getUserById(id, signal) {
    const response = await apiFetch(`/api/users/${id}/`, { signal });
    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
}

// METODO POST (crear un nuevo usuario)
export async function createUser(userData) {
    const formData = new FormData();

    formData.append("first_name", userData.firstName);
    formData.append("last_name", userData.lastName);
    formData.append("document_type_id", userData.documentType);
    formData.append("document_number", userData.documentNumber);
    formData.append("email", userData.email);
    formData.append("phone_number", userData.phone);
    formData.append("address", userData.address);
    formData.append("start_date", userData.startDate);
    formData.append("end_date", userData.endDate);

    if (userData.additionalPhone)
        formData.append("second_phone_number", userData.additionalPhone);

    if (userData.institutionalEmail)
        formData.append("institutional_email", userData.institutionalEmail);

    formData.append("is_instructor_planta", userData.isInstructorPlanta === true);
    formData.append("is_accountable", userData.isAccountable === true);
    // Ley 1581 de 2012: el backend exige data_consent=true y lo registra con fecha.
    formData.append("data_consent", userData.dataConsent === true);

    if (userData.profilePicture?.[0])
        formData.append("profile_picture_upload", userData.profilePicture[0]);

    const response = await apiFetch("/api/users/", {
        method: "POST",
        body: formData,
    });

    if (!response.ok) await throwApiError(response, FIELD_MAP);
    const user = await response.json();

    const rawGroups = Array.isArray(userData.groups)
        ? userData.groups
        : userData.groups ? [userData.groups] : [];
    // Filtrar falsy ("", null, undefined) para evitar un GET innecesario
    // cuando el formulario envía un string vacío por grupo no seleccionado.
    const groupIds = rawGroups.filter(Boolean);

    if (groupIds.length > 0) {
        try {
            // Resolver nombres con un único GET en lugar de N GETs individuales.
            const allGroupsRes = await apiFetch("/api/permissions/groups/");
            if (!allGroupsRes.ok) await throwApiError(allGroupsRes, FIELD_MAP);
            const allGroups = await allGroupsRes.json();
            // Normalizar a String para evitar que el lookup falle cuando el backend
            // devuelve ids numéricos y groupIds contiene strings (o viceversa).
            const nameById = Object.fromEntries(allGroups.map(g => [String(g.id), g.name]));
            const groupNames = groupIds.map(id => nameById[String(id)]).filter(Boolean);
            await assignUserGroups(user.id, groupNames);
        } catch (groupError) {
            // El usuario YA se creó (y su contraseña ya se envió por correo) — no
            // es un fallo total. Se marca partialSuccess para que la UI lo distinga
            // de un "Error al crear usuario" genérico, igual que en updateUser().
            const err = new Error(
                "El usuario se creó correctamente, pero hubo un problema al asignarle el grupo. Ingresa a su edición y verifica el grupo asignado."
            );
            err.partialSuccess = true;
            err.cause = groupError;
            err.user = user;
            throw err;
        }
    }

    return user;
}

// METODO PATCH (perfil propio: foto + datos básicos rectificables).
// El backend solo acepta una lista cerrada (Ley 1581: actualización/rectificación).
export async function updateMyProfile({ picture, fields = {} }) {
    const formData = new FormData();
    if (picture instanceof File) formData.append("profile_picture", picture);
    for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) formData.append(key, value ?? "");
    }
    const response = await apiFetch("/api/users/me/", {
        method: "PATCH",
        body: formData,
    });
    if (!response.ok) {
        await throwApiError(response, {
            first_name: "firstName",
            last_name: "lastName",
            phone_number: "phone",
            second_phone_number: "additionalPhone",
            address: "address",
            profile_picture_upload: "profilePicture",
        });
    }
    return response.json();
}

// METODO PATCH (editar un usuario existente).
// Recibe los nombres de campo locales del UserEditView y los mapea al backend.
// Tambien sincroniza los grupos del usuario si se enviaron.
const EDIT_FIELD_MAP = {
    first_name: "firstName",
    last_name: "lastName",
    document_type_id: "documentType",
    document_number: "documentNumber",
    email: "email",
    phone_number: "phone",
    second_phone_number: "additionalPhone",
    institutional_email: "institutionalEmail",
    address: "address",
    start_date: "startDate",
    end_date: "endDate",
    is_active: "isActive",
    deactivation_reason: "deactivationReason",
    is_instructor_planta: "isInstructorPlanta",
    is_accountable: "isAccountable",
};

export async function updateUser(id, userData) {
    const formData = new FormData();

    formData.append("first_name", userData.firstName);
    formData.append("last_name", userData.lastName);
    formData.append("document_type_id", userData.documentType);
    formData.append("document_number", userData.documentNumber);
    formData.append("email", userData.email);
    formData.append("phone_number", userData.phone);
    formData.append("address", userData.address);
    formData.append("start_date", userData.startDate);
    formData.append("is_active", userData.isActive === "true" || userData.isActive === true);
    if (userData.deactivationReason) formData.append("deactivation_reason", userData.deactivationReason);
    formData.append("end_date", userData.endDate);

    // Siempre se envían (aunque vengan vacíos) para que un campo borrado en el
    // formulario también se borre en el backend — un FormData con la llave
    // ausente deja el valor anterior intacto en un PATCH parcial.
    formData.append("second_phone_number", userData.additionalPhone ?? "");
    formData.append("institutional_email", userData.institutionalEmail ?? "");
    formData.append("is_instructor_planta", userData.isInstructorPlanta === true);
    formData.append("is_accountable", userData.isAccountable === true);

    // La foto solo se reemplaza si el usuario subio un archivo nuevo (File).
    const picture = userData.profilePicture?.[0];
    if (picture instanceof File) formData.append("profile_picture_upload", picture);

    const response = await apiFetch(`/api/users/${id}/`, {
        method: "PATCH",
        body: formData,
    });

    if (!response.ok) await throwApiError(response, EDIT_FIELD_MAP);
    const user = await response.json();

    // Sincronizar grupos (agrega los nuevos, quita los que ya no están).
    // Si falla, los datos básicos ya se guardaron — se lanza un error con mensaje
    // específico para que la UI pueda distinguir este caso del fallo total.
    // groups puede llegar como string (selección única) o array (legacy).
    // Se normaliza siempre a array de strings para updateUserGroups.
    const groupsToSync = Array.isArray(userData.groups)
        ? userData.groups.map(String)
        : userData.groups ? [String(userData.groups)] : [];

    if (groupsToSync.length > 0) {
        try {
            await updateUserGroups(id, groupsToSync);
        } catch (groupError) {
            const err = new Error(
                "Los datos del usuario se guardaron correctamente, pero hubo un problema al sincronizar los grupos. Recarga la página y verifica los grupos asignados."
            );
            err.partialSuccess = true;
            err.cause = groupError;
            throw err;
        }
    }

    return user;
}

// Actualiza únicamente la foto del perfil personal. Mantener esta operación
// separada evita que un usuario modifique por accidente sus grupos, estado u
// otros datos reservados para la administración.
export async function getMyProfile(signal) {
    const response = await apiFetch("/api/users/me/", { signal });
    if (!response.ok) await throwApiError(response);
    return response.json();
}

export async function updateUserProfilePicture(picture) {
    const formData = new FormData();
    formData.append("profile_picture", picture);

    const response = await apiFetch("/api/users/me/", {
        method: "PATCH",
        body: formData,
    });

    if (!response.ok) await throwApiError(response, { profile_picture: "profilePicture" });
    return response.json();
}

// ── Cambio de contraseña con OTP ────────────────────────────────────────────

// Paso 1: valida la contraseña actual, la nueva y solicita el envío del OTP
// al correo del usuario autenticado.
export async function requestPasswordChangeOtp({ currentPassword, newPassword, confirmNewPassword }) {
    const OTP_FIELD_MAP = {
        current_password: "currentPassword",
        new_password: "newPassword",
        confirm_new_password: "confirmNewPassword",
    };
    const response = await apiFetch("/api/users/me/change-password/request/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
            confirm_new_password: confirmNewPassword,
        }),
    });
    if (!response.ok) await throwApiError(response, OTP_FIELD_MAP);
    return response.json();
}

// Paso 2: verifica el OTP ingresado por el usuario y aplica el cambio de contraseña.
export async function confirmPasswordChange({ otpCode }) {
    const OTP_FIELD_MAP = { otp_code: "otp" };
    const response = await apiFetch("/api/users/me/change-password/confirm/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp_code: otpCode }),
    });
    if (!response.ok) await throwApiError(response, OTP_FIELD_MAP);
    return response.json();
}

// METODO PATCH (activar o desactivar un usuario)
export async function toggleUserActive(id, isActive, { deactivationReason } = {}) {
  const response = await apiFetch(`/api/users/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      is_active: isActive,
      ...(deactivationReason ? { deactivation_reason: deactivationReason } : {}),
    }),
  });
  if (!response.ok) await throwApiError(response, FIELD_MAP);
  return response.json();
}

// METODO GET (obtener grupos de un usuario)
export async function getUserGroups(userId) {
  const response = await apiFetch(`/api/permissions/users/${userId}/groups/`);
  if (!response.ok) await throwApiError(response, FIELD_MAP);
  return response.json();
}

// METODO POST (asignar grupos a un usuario por nombre.
// Recibe un array de nombres de grupo directamente para evitar GETs extra al backend.
export async function assignUserGroups(userId, groupNames) {
  const assignments = groupNames.map(async (groupName) => {
    const response = await apiFetch(`/api/permissions/users/${userId}/groups/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_name: groupName }),
    });
    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
  });

  return Promise.all(assignments);
}

// METODO DELETE (remover un usuario de un grupo por nombre)
export async function removeUserFromGroup(userId, groupName) {
  const response = await apiFetch(`/api/permissions/users/${userId}/groups/`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ group_name: groupName }),
  });
  if (!response.ok) await throwApiError(response, FIELD_MAP);
  return response.json();
}

// METODO PUT (actualizar grupos de un usuario - reemplaza todos)
// Obtiene los grupos actuales del backend (necesarios para saber qué remover),
// luego opera solo con nombres — sin GETs adicionales por cada grupo.
//
// NOTA DE ATOMICIDAD: las operaciones de remove/add se ejecutan en serie pero
// no son atómicas. Si falla a mitad (ej: algunos grupos removidos, otros no
// agregados), el usuario puede quedar con grupos inconsistentes. No hay rollback.
// El caller (updateUser en userService) ya maneja este caso lanzando un error
// con `partialSuccess: true` para que la UI distinga el fallo parcial del total.
export async function updateUserGroups(userId, groupIds) {
  // Los grupos actuales vienen del endpoint GET /api/permissions/users/{id}/groups/
  // que usa GroupListSerializer → devuelve objetos Group con {id, name, ...}.
  const currentGroups = await getUserGroups(userId);
  // Normalizar a string para evitar fallos de comparación estricta cuando
  // el backend devuelve ids numéricos y el frontend los maneja como strings
  // (o viceversa). Usar strings también es compatible con UUIDs.
  const currentGroupIds = currentGroups.map(g => String(g.id));
  const currentNameById = Object.fromEntries(
    currentGroups.map(g => [String(g.id), g.name])
  );

  const groupIdsStr = groupIds.map(String);

  const toRemoveIds = currentGroupIds.filter(id => !groupIdsStr.includes(id));
  for (const groupId of toRemoveIds) {
    await removeUserFromGroup(userId, currentNameById[groupId]);
  }

  // Para los grupos a agregar necesitamos sus nombres — los buscamos en un
  // solo GET de lista en lugar de N GETs individuales.
  const toAddIds = groupIdsStr.filter(id => !currentGroupIds.includes(id));
  if (toAddIds.length > 0) {
    const allGroupsRes = await apiFetch("/api/permissions/groups/");
    if (!allGroupsRes.ok) await throwApiError(allGroupsRes, FIELD_MAP);
    const allGroups = await allGroupsRes.json();
    const nameById = Object.fromEntries(allGroups.map(g => [String(g.id), g.name]));
    const namesToAdd = toAddIds.map(id => nameById[id]).filter(Boolean);

    // Seguridad: si algún ID no se encontró en la lista de grupos del sistema,
    // abortar en lugar de asignar silenciosamente un subconjunto incorrecto.
    if (namesToAdd.length !== toAddIds.length) {
      throw new Error("Algunos grupos seleccionados no existen en el sistema.");
    }

    await assignUserGroups(userId, namesToAdd);
  }
}

// METODO DELETE (eliminar un usuario - borrado logico)
export async function deleteUser(id) {
  const response = await apiFetch(`/api/users/${id}/`, {
    method: "DELETE",
  });
  if (!response.ok) await throwApiError(response, FIELD_MAP);
  // El backend responde 204 No Content, no hay body que parsear
  return true;
}

// METODO GET (obtener usuarios eliminados - papelera)
export async function getTrashUsers() {
  const response = await apiFetch("/api/users/trash/");
  if (!response.ok) await throwApiError(response, FIELD_MAP);
  return response.json();
}

// METODO POST (restaurar un usuario eliminado)
export async function restoreUser(id) {
  const response = await apiFetch(`/api/users/${id}/restore/`, {
    method: "POST",
  });
  if (!response.ok) await throwApiError(response, FIELD_MAP);
  return response.json();
}

// METODO POST (reenviar credenciales - genera nueva password y la envia por correo)
export async function resendCredentials(id) {
  const response = await apiFetch(`/api/users/${id}/resend-credentials/`, {
    method: "POST",
  });
  if (!response.ok) await throwApiError(response, FIELD_MAP);
  return response.json();
}
