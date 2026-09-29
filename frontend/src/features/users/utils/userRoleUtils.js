/**
 * Deriva flags de rol a partir de la lista completa de grupos disponibles
 * y los IDs de grupos actualmente seleccionados en el formulario.
 *
 * Se extrae aquí para que tanto UserEditForm como UserCreateForm (y UserForm)
 * compartan la misma fuente de verdad sin duplicar la lógica de detección.
 *
 * @param {Array<{id: string|number, label: string}>} allGroups  - opciones del select
 * @param {string|string[]} selectedGroupIds - valor actual de formData.groups
 * @returns {{ isInstructorRole: boolean, isAdminLikeRole: boolean }}
 */
export function deriveRoleFlags(allGroups, selectedGroupIds) {
    const ids = Array.isArray(selectedGroupIds)
        ? selectedGroupIds.map(String)
        : selectedGroupIds ? [String(selectedGroupIds)] : [];

    const names = allGroups
        .filter((g) => ids.includes(String(g.id)))
        .map((g) => g.label?.toUpperCase?.() ?? "");

    return {
        isInstructorRole: names.some((n) => n.includes("INST") || n.includes("INSTRUCTOR")),
        isAdminLikeRole:  names.some((n) => /(ADMIN|SADMIN|SUPER)/.test(n)),
    };
}
