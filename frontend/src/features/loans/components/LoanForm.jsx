import { Input, Select, TextArea, EditCard, CreateOptionButton, Checkbox, DataConsentCheckbox } from "@/shared";
import MaterialPicker from "./MaterialPicker";

// Campos de préstamo, reutilizables entre crear y editar.
// PRESENTACIONAL: recibe formData/errors/onChange y las opciones de selects.
// Props de control de usuarios:
//   hideResponsable — oculta el select de responsable (creación: ya viene de sesión)
//   readonlyUsers   — muestra responsable y receptor como texto no editable (edición).
//   receptorDisplayName — nombre a mostrar en modo readonlyUsers; si no se
//     pasa, se resuelve buscando en `users` (solo funciona para un receptor
//     registrado). En edición, el caller debe pasar el nombre ya resuelto
//     por el backend (loan.usuario_receptor) para que un receptor externo
//     también se muestre correctamente.
export default function LoanForm({
    formData,
    errors = {},
    onChange,
    users = [],
    materials = [],
    multipleMaterials = false,
    loan_type = [],
    onMaterialQuantityChange,
    loanDepartureDate = "",
    extraSlot = null,
    hideResponsable = false,
    readonlyUsers = false,
    receptorDisplayName = null,
}) {
    // Nombre legible del responsable/receptor para los campos de solo lectura.
    const responsableName = users.find((u) => String(u.id) === String(formData.loanResponsableUser))?.label ?? "—";
    const receptorName    = receptorDisplayName
        ?? (users.find((u) => String(u.id) === String(formData.loanReceptorUser))?.label ?? "—");

    return (
        <EditCard title="Información del Préstamo" cols={1}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 w-full">
                {multipleMaterials ? (
                    <div className="sm:col-span-2">
                        <MaterialPicker
                            label="Materiales"
                            name="loanMaterial"
                            options={materials}
                            value={formData.loanMaterial}
                            quantities={formData.loanMaterialQuantities}
                            error={errors.loanMaterial}
                            quantityErrors={errors.loanMaterialQuantities}
                            onChange={onChange}
                            onQuantityChange={onMaterialQuantityChange}
                            required
                        />
                    </div>
                ) : (
                    <Select
                        label="Material"
                        name="loanMaterial"
                        options={materials}
                        value={formData.loanMaterial}
                        onChange={onChange}
                        error={errors.loanMaterial}
                        labelAction={<CreateOptionButton variant="spacer" />}
                        required
                    />
                )}
                    <Select
                        label="Tipo de Préstamo"
                        name="loanType"
                        options={loan_type}
                        value={formData.loanType}
                        onChange={onChange}
                        error={errors.loanType}
                        labelAction={<CreateOptionButton variant="spacer" />}
                        required
                />

                {/* ── Responsable ── */}
                {!hideResponsable && (
                    readonlyUsers
                        ? <Input label="Usuario Responsable del Préstamo" value={responsableName} disabled readOnly />
                        : <Select
                            label="Usuario Responsable del Préstamo"
                            name="loanResponsableUser"
                            options={users}
                            value={formData.loanResponsableUser}
                            onChange={onChange}
                            error={errors.loanResponsableUser}
                            required
                            labelAction={<CreateOptionButton variant="spacer" />}
                          />
                )}
                {/* ── Receptor ── */}
                {readonlyUsers ? (
                    <Input label="Usuario Receptor del Préstamo" value={receptorName} disabled readOnly />
                ) : (
                    <>
                        <div className="sm:col-span-2">
                            <Checkbox
                                id="receptorIsRegistered"
                                name="receptorIsRegistered"
                                label="El receptor está registrado en el sistema"
                                checked={formData.receptorIsRegistered !== false}
                                onChange={onChange}
                            />
                        </div>
                        {formData.receptorIsRegistered !== false ? (
                            <Select
                                label="Usuario Receptor del Préstamo"
                                name="loanReceptorUser"
                                options={users}
                                value={formData.loanReceptorUser}
                                onChange={onChange}
                                error={errors.loanReceptorUser}
                                required
                                labelAction={<CreateOptionButton variant="spacer" />}
                            />
                        ) : (
                            <>
                                <Input
                                    label="Nombre completo del receptor"
                                    name="receptorName"
                                    placeholder="Nombre y apellido"
                                    value={formData.receptorName}
                                    onChange={onChange}
                                    error={errors.receptorName}
                                    required
                                />
                                <Input
                                    label="Correo del receptor"
                                    name="receptorEmail"
                                    type="email"
                                    placeholder="correo@ejemplo.com"
                                    value={formData.receptorEmail}
                                    onChange={onChange}
                                    error={errors.receptorEmail}
                                    required
                                />
                                <div className="sm:col-span-2">
                                    <DataConsentCheckbox
                                        id="receptorDataConsent"
                                        name="receptorDataConsent"
                                        variant="tercero"
                                        checked={formData.receptorDataConsent === true}
                                        onChange={onChange}
                                        error={errors.receptorDataConsent}
                                    />
                                </div>
                            </>
                        )}
                    </>
                )}
                {!multipleMaterials && (
                    <Input
                        label="Cantidad del Préstamo"
                        name="loanAmount"
                        placeholder="Ingrese la cantidad del préstamo"
                        type="number"
                        min="1"
                        step="1"
                        value={formData.loanAmount}
                        onChange={onChange}
                        error={errors.loanAmount}
                        labelAction={<CreateOptionButton variant="spacer" />}
                        required
                    />
                )}

                <Input
                    label="Numero de Grupo o Ficha"
                    name="loanGroup"
                    placeholder="Ingrese su número de grupo o ficha"
                    value={formData.loanGroup}
                    onChange={onChange}
                    error={errors.loanGroup}
                    optional
                    labelAction={<CreateOptionButton variant="spacer" />}
                />
                <Input
                    label="Fecha de salida"
                    type="date"
                    value={loanDepartureDate}
                    disabled
                    labelAction={<CreateOptionButton variant="spacer" />}
                    readOnly
                />
                <Input
                    label="Fecha Devolución"
                    name="loanReturnDate"
                    type="date"
                    value={formData.loanReturnDate}
                    onChange={onChange}
                    error={errors.loanReturnDate}
                    labelAction={<CreateOptionButton variant="spacer" />}
                    required
                />
                {extraSlot}
                <div className="sm:col-span-2">
                    <TextArea
                        label="Justificación de Uso"
                        name="loanJustification"
                        placeholder="Ingrese la justificación de uso"
                        value={formData.loanJustification}
                        onChange={onChange}
                        error={errors.loanJustification}
                        labelAction={<CreateOptionButton variant="spacer" />}
                        required
                    />
                </div>
            </div>
        </EditCard>
);
}
