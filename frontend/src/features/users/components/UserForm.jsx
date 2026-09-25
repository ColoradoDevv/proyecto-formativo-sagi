import { Input, Select, SelectMultiple, ProfileFileInput, StatusBadge, EditCard, Checkbox } from "@/shared";


const STATUS_OPTIONS = [
    { id: "true",  label: "Activo"   },
    { id: "false", label: "Inactivo" },
];

function resolveIsInstructorRole({ groups, formData, isInstructorRoleProp }) {
    if (isInstructorRoleProp !== null) return isInstructorRoleProp;

    const selectedGroupIds = Array.isArray(formData.groups)
        ? formData.groups.map(String)
        : formData.groups ? [String(formData.groups)] : [];
    const selectedGroupNames = groups
        .filter((g) => selectedGroupIds.includes(String(g.id)))
        .map((g) => g.label?.toUpperCase?.() ?? "");
    return selectedGroupNames.some((n) => n.includes("INST") || n.includes("INSTRUCTOR"));
}

export function UserPersonalCard({ formData, errors, onChange, onPhotoChange, documentTypes = [], showStatus = false }) {
    const isActive = formData.isActive === "true" || formData.isActive === true;

    return (
        <EditCard title="Información Personal" cols={1}>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
                <div className="flex flex-col items-center gap-2 shrink-0">
                    <ProfileFileInput
                        className="w-32 h-40 rounded-[var(--radius-xl)]"
                        value={formData.profilePicture}
                        onChange={onPhotoChange}
                        error={errors.profilePicture}
                        label="Foto de perfil"
                        description="Formato JPG o PNG. Tamaño máximo: 2MB."
                    />
                    {showStatus && <StatusBadge active={isActive} />}
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 min-w-0">
                    <Input
                        label="Primer Nombre"
                        name="firstName"
                        placeholder="Ingrese su primer nombre"
                        value={formData.firstName}
                        onChange={onChange}
                        error={errors.firstName}
                        required
                    />
                    <Input
                        label="Primer Apellido"
                        name="lastName"
                        placeholder="Ingrese su primer apellido"
                        value={formData.lastName}
                        onChange={onChange}
                        error={errors.lastName}
                        required
                    />
                    <Select
                        label="Tipo de documento"
                        name="documentType"
                        options={documentTypes}
                        value={formData.documentType}
                        onChange={onChange}
                        error={errors.documentType}
                        required
                    />
                    <Input
                        label="Número de documento"
                        name="documentNumber"
                        placeholder="Ingresa el número"
                        value={formData.documentNumber}
                        onChange={onChange}
                        error={errors.documentNumber}
                        required
                    />
                    <div className="sm:col-span-2">
                        <Input
                            label="Dirección de domicilio"
                            name="address"
                            placeholder="Ingrese la dirección de su domicilio"
                            value={formData.address}
                            onChange={onChange}
                            error={errors.address}
                            required
                        />
                    </div>
                </div>
            </div>
        </EditCard>
    );
}

export function UserContactCard({ formData, errors, onChange, confirmEmailSlot, contactExtraSlot, emailInst }) {
    return (
        <EditCard title="Información de Contacto">
            <Input
                label="Correo electrónico"
                name="email"
                type="email"
                placeholder="correo@ejemplo.com"
                value={formData.email}
                onChange={onChange}
                error={errors.email}
                required
            />
            {confirmEmailSlot}
            {emailInst}
            <Input
                label="Teléfono"
                name="phone"
                placeholder="Número de teléfono"
                value={formData.phone}
                onChange={onChange}
                error={errors.phone}
                required
            />
            {contactExtraSlot}
        </EditCard>
    );
}

export function UserSystemCard({
    formData,
    errors,
    onChange,
    groups,
    showStatus,
    singleGroupSelection,
    disabledOptionValues,
    isPrimaryAdmin,
    isInstructorRole,
    systemExtraSlot,
    includeDates = true,
}) {
    return (
        <EditCard title="Información del Sistema">
            <div>
                {singleGroupSelection ? (
                    <Select
                        label="Tipo de usuario"
                        name="groups"
                        options={groups}
                        value={formData.groups}
                        onChange={onChange}
                        error={errors.groups}
                        required
                        disabledOptionValues={disabledOptionValues}
                        disabled={isPrimaryAdmin}
                    />
                ) : (
                    <SelectMultiple
                        label="Tipo de usuario"
                        name="groups"
                        options={groups}
                        value={formData.groups}
                        onChange={onChange}
                        error={errors.groups}
                        required
                        disabledOptionValues={disabledOptionValues}
                        disabled={isPrimaryAdmin}
                    />
                )}
                <div className="mt-2 flex flex-col gap-2">
                    {isInstructorRole && (
                        <Checkbox
                            id="isInstructorPlanta"
                            name="isInstructorPlanta"
                            label="Instructor de planta"
                            checked={Boolean(formData.isInstructorPlanta)}
                            onChange={onChange}
                        />
                    )}
                    <Checkbox
                        id="isAccountable"
                        name="isAccountable"
                        label="Cuentadante"
                        checked={Boolean(formData.isAccountable)}
                        onChange={onChange}
                    />
                </div>
                {showStatus && (
                    <Select
                        label="Estado"
                        name="isActive"
                        options={STATUS_OPTIONS}
                        value={formData.isActive}
                        onChange={onChange}
                        error={errors.isActive}
                        required
                        disabled={isPrimaryAdmin}
                    />
                )}
            </div>
            {systemExtraSlot}
            {includeDates && (
                <>
                    <Input
                        label="Fecha de inicio"
                        name="startDate"
                        type="date"
                        value={formData.startDate}
                        onChange={onChange}
                        error={errors.startDate}
                        required
                    />
                    <Input
                        label="Fecha de finalización"
                        name="endDate"
                        type="date"
                        value={formData.endDate}
                        onChange={onChange}
                        error={errors.endDate}
                        required
                    />
                </>
            )}
        </EditCard>
    );
}

export function UserDatesCard({ formData, errors, onChange }) {
    return (
        <EditCard title="Vigencia">
            <Input
                label="Fecha de inicio"
                name="startDate"
                type="date"
                value={formData.startDate}
                onChange={onChange}
                error={errors.startDate}
                required
            />
            <Input
                label="Fecha de finalización"
                name="endDate"
                type="date"
                value={formData.endDate}
                onChange={onChange}
                error={errors.endDate}
                required
            />
        </EditCard>
    );
}

// Formulario de campos de usuario, reutilizable entre crear y editar.
// Es PRESENTACIONAL: no maneja estado ni submit — recibe formData/errors y los
// handlers desde la pagina. Usa una unica convencion de nombres de campo.
//
// Props:
// - formData, errors, onChange, onPhotoChange
// - documentTypes, groups: opciones para los selects
// - showStatus: muestra el selector "Estado" (solo en editar)
// - isPrimaryAdmin: si true, bloquea los campos de grupo y estado para proteger
//   al superadministrador primigenio del sistema
// - confirmEmailSlot / contactExtraSlot / systemExtraSlot: slots opcionales para
//   inyectar campos propios de cada modo (confirmar correo, telefono adicional
//   condicional, tareas, etc.)
export default function UserForm({
    formData,
    errors = {},
    onChange,
    onPhotoChange,
    documentTypes = [],
    groups = [],
    showStatus = false,
    singleGroupSelection = false,
    disabledOptionValues = [],
    isPrimaryAdmin = false,
    isInstructorRole: isInstructorRoleProp = null,
    confirmEmailSlot = null,
    contactExtraSlot = null,
    emailInst = null,
    systemExtraSlot = null,
}) {
    const isInstructorRole = resolveIsInstructorRole({ groups, formData, isInstructorRoleProp });

    return (
        <>
            <EditCard title="Información Personal" cols={1}>
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
                    <div className="flex flex-col items-center gap-2 shrink-0">
                        <ProfileFileInput
                            className="w-32 h-40 rounded-[var(--radius-xl)]"
                            value={formData.profilePicture}
                            onChange={onPhotoChange}
                            error={errors.profilePicture}
                            label="Foto de perfil"
                            description="Formato JPG o PNG. Tamaño máximo: 2MB."
                        />
                        {showStatus && <StatusBadge active={formData.isActive === "true" || formData.isActive === true} />}
                    </div>

                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 min-w-0">
                        <Input
                            label="Primer Nombre"
                            name="firstName"
                            placeholder="Ingrese su primer nombre"
                            value={formData.firstName}
                            onChange={onChange}
                            error={errors.firstName}
                            required
                        />
                        <Input
                            label="Primer Apellido"
                            name="lastName"
                            placeholder="Ingrese su primer apellido"
                            value={formData.lastName}
                            onChange={onChange}
                            error={errors.lastName}
                            required
                        />
                        <Select
                            label="Tipo de documento"
                            name="documentType"
                            options={documentTypes}
                            value={formData.documentType}
                            onChange={onChange}
                            error={errors.documentType}
                            required
                        />
                        <Input
                            label="Número de documento"
                            name="documentNumber"
                            placeholder="Ingresa el número"
                            value={formData.documentNumber}
                            onChange={onChange}
                            error={errors.documentNumber}
                            required
                        />
                        <div className="sm:col-span-2">
                            <Input
                                label="Dirección de domicilio"
                                name="address"
                                placeholder="Ingrese la dirección de su domicilio"
                                value={formData.address}
                                onChange={onChange}
                                error={errors.address}
                                required
                            />
                        </div>
                    </div>
                </div>
            </EditCard>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <EditCard title="Información de Contacto">
                    <Input
                        label="Correo electrónico"
                        name="email"
                        type="email"
                        placeholder="correo@ejemplo.com"
                        value={formData.email}
                        onChange={onChange}
                        error={errors.email}
                        required
                    />
                    {confirmEmailSlot}
                    {emailInst}
                    <Input
                        label="Teléfono"
                        name="phone"
                        placeholder="Número de teléfono"
                        value={formData.phone}
                        onChange={onChange}
                        error={errors.phone}
                        required
                    />
                    {contactExtraSlot}
                </EditCard>

                <UserSystemCard
                    formData={formData}
                    errors={errors}
                    onChange={onChange}
                    groups={groups}
                    showStatus={showStatus}
                    singleGroupSelection={singleGroupSelection}
                    disabledOptionValues={disabledOptionValues}
                    isPrimaryAdmin={isPrimaryAdmin}
                    isInstructorRole={isInstructorRole}
                    systemExtraSlot={systemExtraSlot}
                />
            </div>
        </>
    );
}
