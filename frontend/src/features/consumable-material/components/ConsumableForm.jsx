import { Input, Select, SelectMultiple, TextArea, EditCard, CreateOptionButton } from "@/shared";
import { Plus } from "lucide-react";

const CM_STATE_OPTIONS = [
    { id: "Disponible",    label: "Disponible"    },
    { id: "No Disponible", label: "No Disponible" },
    { id: "Mantenimiento", label: "Mantenimiento" },
    { id: "Traslado",      label: "Traslado"      },
    { id: "En prestamo",   label: "En prestamo"   },
    { id: "Baja",          label: "Baja"          },
];

export function ConsumableGeneralCard({
    formData,
    errors = {},
    onChange,
    brands = [],
    inventories = [],
    categories = [],
    onCreateBrand = null,
    onCreateInventory = null,
    onCreateCategory = null,
}) {
    const handleBrandCreated = (option) => {
        onChange({ target: { name: "brand", value: String(option.id) } });
    };
    const handleInventoryCreated = (option) => {
        onChange({ target: { name: "inventory", value: String(option.id) } });
    };
    const handleCategoryCreated = (option) => {
        onChange({ target: { name: "category", value: String(option.id) } });
    };

    return (
        <EditCard title="Información General" cols={1}>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 min-w-0">
                <Input
                    label="Nombre"
                    name="name"
                    placeholder="Nombre del material"
                    value={formData.name}
                    onChange={onChange}
                    error={errors.name}
                    required
                />
                <Select
                    label="Marca"
                    name="brand"
                    options={brands}
                    value={formData.brand}
                    onChange={onChange}
                    error={errors.brand}
                    optional
                    labelAction={
                        <CreateOptionButton
                            onCreate={onCreateBrand}
                            onCreated={handleBrandCreated}
                            title="Nueva marca"
                            inputLabel="Nombre de la marca"
                            inputPlaceholder="Ej. Bosch"
                            errorTitle="No se pudo crear la marca"
                            ariaLabel="Agregar nueva marca"
                            icon={Plus}
                        />
                    }
                />
                <Select
                    label="Nombre de inventario"
                    name="inventory"
                    options={inventories}
                    value={formData.inventory}
                    onChange={onChange}
                    error={errors.inventory}
                    optional
                    labelAction={
                        <CreateOptionButton
                            onCreate={onCreateInventory}
                            onCreated={handleInventoryCreated}
                            title="Nuevo nombre de inventario"
                            inputLabel="Nombre del inventario"
                            inputPlaceholder="Ej. Almacén principal"
                            errorTitle="No se pudo crear el nombre de inventario"
                            ariaLabel="Agregar nuevo nombre de inventario"
                            icon={Plus}
                        />
                    }
                />
                <Select
                    label="Categoría"
                    name="category"
                    options={categories}
                    value={formData.category}
                    onChange={onChange}
                    error={errors.category}
                    optional
                    labelAction={
                        <CreateOptionButton
                            onCreate={onCreateCategory}
                            onCreated={handleCategoryCreated}
                            title="Nueva categoría"
                            inputLabel="Nombre de la categoría"
                            inputPlaceholder="Ej. Tornillería, Cables"
                            errorTitle="No se pudo crear la categoría"
                            ariaLabel="Agregar nueva categoría"
                            icon={Plus}
                        />
                    }
                />
                <div className="sm:col-span-2">
                    <TextArea
                        label="Descripción"
                        name="description"
                        placeholder="Descripción del material"
                        value={formData.description}
                        onChange={onChange}
                        error={errors.description}
                        required
                    />
                </div>
            </div>
        </EditCard>
    );
}

export function ConsumableInventoryCard({ formData, errors = {}, onChange }) {
    const hasSenaPlate = (formData.senaPlate ?? "").trim() !== "";

    return (
        <EditCard title="Inventario">
            <Input
                label="Placa SENA (opcional)"
                name="senaPlate"
                placeholder="Placa SENA"
                value={formData.senaPlate}
                onChange={onChange}
                error={errors.senaPlate}
            />
            <Input
                label="Cantidad"
                name="quantity"
                type="number"
                min="1"
                step="1"
                placeholder="Cantidad"
                value={formData.quantity}
                onChange={onChange}
                disabled={hasSenaPlate}
                error={errors.quantity}
                hint={hasSenaPlate ? "La cantidad es 1 porque el material tiene placa SENA, no es editable." : undefined}
                required
            />
            <Input
                label="S/N"
                name="serial"
                placeholder="Numero serial del material"
                value={formData.serial}
                optional
                onChange={onChange}
                error={errors.serial}
            />
            <Input
                label="Ubicación (opcional)"
                name="location"
                placeholder="Ubicación del material"
                value={formData.location}
                onChange={onChange}
                error={errors.location}
            />
            <Select
                label="Estado"
                name="state"
                options={CM_STATE_OPTIONS}
                value={formData.state}
                onChange={onChange}
                error={errors.state}
                required
            />
        </EditCard>
    );
}

export function ConsumableValuesCard({ formData, errors = {}, onChange }) {
    return (
        <EditCard title="Valores">
            <Input
                label="Fecha de compra"
                name="purchaseDate"
                type="date"
                value={formData.purchaseDate}
                onChange={onChange}
                error={errors.purchaseDate}
                required
            />
            <Input
                label="Valor Unitario"
                name="unitPrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="Valor unitario"
                value={formData.unitPrice}
                onChange={onChange}
                error={errors.unitPrice}
                required
            />
            <Input
                label="Valor Total"
                name="totalPrice"
                type="number"
                placeholder="Calculado automáticamente"
                value={formData.totalPrice}
                readOnly
            />
        </EditCard>
    );
}

// Card independiente para asignacion de cuentadantes (multi-select).
// Acepta usuarios como opciones y emite un array de IDs en `formData.cuentadantes`.
export function ConsumableAccountableCard({
    formData,
    errors = {},
    onChange,
    users = [],
    name = "cuentadantes",
}) {
    const value = Array.isArray(formData.cuentadantes) ? formData.cuentadantes : [];

    return (
        <EditCard title="Asignación">
            <SelectMultiple
                label="Cuentadantes"
                name={name}
                options={users}
                value={value}
                onChange={onChange}
                error={errors[name] || errors.cuentadantes}
                required
            />
            <p className="text-small text-text-muted">
                Un material puede tener varios cuentadantes. Cada uno será
                responsable del mismo.
            </p>
        </EditCard>
    );
}

// Campos de material de consumo, reutilizables entre crear y editar.
// PRESENTACIONAL: recibe formData/errors/onChange, las opciones de selects, y
// un slot para la seccion de foto (distinta en crear vs editar).
// Convencion de nombres unificada: name, senaPlate, brand, state, unitPrice,
// totalPrice, purchaseDate, quantity, location, description, cuentadantes,
// inventory, category.
export default function ConsumableForm({
    formData,
    errors = {},
    onChange,
    brands = [],
    users = [],
    inventories = [],
    categories = [],
    onCreateBrand = null,
    onCreateInventory = null,
    onCreateCategory = null,
    photoSlot = null,
}) {
    const hasSenaPlate = (formData.senaPlate ?? "").trim() !== "";
    const cuentasValue = Array.isArray(formData.cuentadantes) ? formData.cuentadantes : [];

    // Al crear una marca nueva: la selecciona automáticamente en el form.
    const handleBrandCreated = (option) => {
        onChange({ target: { name: "brand", value: String(option.id) } });
    };

    return (
        <>
            {/* Información General — foto lateral + campos */}
            <EditCard title="Información General" cols={1}>
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">

                    {/* Foto (slot: FileInput en crear, preview+boton en editar) */}
                    {photoSlot && (
                        <div className="flex flex-col items-center gap-2 shrink-0">
                            {photoSlot}
                        </div>
                    )}

                    {/* Campos generales */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 min-w-0">
                        <Input
                            label="Nombre"
                            name="name"
                            placeholder="Nombre del material"
                            value={formData.name}
                            onChange={onChange}
                            error={errors.name}
                            required
                        />
                        <Input
                            label="Placa SENA (opcional)"
                            name="senaPlate"
                            placeholder="Placa SENA"
                            value={formData.senaPlate}
                            onChange={onChange}
                            error={errors.senaPlate}
                        />
                        <Select
                            label="Marca"
                            name="brand"
                            options={brands}
                            value={formData.brand}
                            onChange={onChange}
                            error={errors.brand}
                            optional
                            labelAction={
                                <CreateOptionButton
                                    onCreate={onCreateBrand}
                                    onCreated={handleBrandCreated}
                                    title="Nueva marca"
                                    inputLabel="Nombre de la marca"
                                    inputPlaceholder="Ej. Bosch"
                                    errorTitle="No se pudo crear la marca"
                                    ariaLabel="Agregar nueva marca"
                                    icon={Plus}
                                />
                            }
                        />
                        <Select
                            label="Nombre de inventario"
                            name="inventory"
                            options={inventories}
                            value={formData.inventory}
                            onChange={onChange}
                            error={errors.inventory}
                            optional
                            labelAction={
                                <CreateOptionButton
                                    onCreate={onCreateInventory}
                                    onCreated={(option) =>
                                        onChange({ target: { name: "inventory", value: String(option.id) } })
                                    }
                                    title="Nuevo nombre de inventario"
                                    inputLabel="Nombre del inventario"
                                    inputPlaceholder="Ej. Almacén principal"
                                    errorTitle="No se pudo crear el nombre de inventario"
                                    ariaLabel="Agregar nuevo nombre de inventario"
                                    icon={Plus}
                                />
                            }
                        />
                        <div className="sm:col-span-2">
                            <SelectMultiple
                                label="Cuentadantes"
                                name="cuentadantes"
                                options={users}
                                value={cuentasValue}
                                onChange={onChange}
                                error={errors.cuentadantes}
                                required
                            />
                            <p className="text-small text-text-muted mt-1">
                                Un material puede tener varios cuentadantes.
                            </p>
                        </div>
                        <div className="sm:col-span-2">
                            <TextArea
                                label="Descripción"
                                name="description"
                                placeholder="Descripción del material"
                                value={formData.description}
                                onChange={onChange}
                                error={errors.description}
                                required
                            />
                        </div>
                    </div>
                </div>
            </EditCard>

            {/* Inventario y Valores lado a lado */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                <EditCard title="Inventario">
                    <Input
                        label="Cantidad"
                        name="quantity"
                        type="number"
                        min="1"
                        step="1"
                        placeholder="Cantidad"
                        value={formData.quantity}
                        onChange={onChange}
                        disabled={hasSenaPlate}
                        error={errors.quantity}
                        hint={hasSenaPlate ? "La cantidad es 1 porque el material tiene placa SENA, no es editable." : undefined}
                        required
                    />
                    <Input
                        label="S/N"
                        name="serial"
                        placeholder="Numero serial del material"
                        value={formData.serial}
                        optional
                        onChange={onChange}
                        error={errors.serial}
                    />
                    <Input
                        label="Ubicación (opcional)"
                        name="location"
                        placeholder="Ubicación del material"
                        value={formData.location}
                        onChange={onChange}
                        error={errors.location}
                    />
                    <Select
                        label="Estado"
                        name="state"
                        options={CM_STATE_OPTIONS}
                        value={formData.state}
                        onChange={onChange}
                        error={errors.state}
                        required
                    />
                    <Input
                        label="Fecha de compra"
                        name="purchaseDate"
                        type="date"
                        value={formData.purchaseDate}
                        onChange={onChange}
                        error={errors.purchaseDate}
                        required
                    />
                </EditCard>

                <EditCard title="Valores">
                    <Input
                        label="Valor Unitario"
                        name="unitPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Valor unitario"
                        value={formData.unitPrice}
                        onChange={onChange}
                        error={errors.unitPrice}
                        required
                    />
                    <Input
                        label="Valor Total"
                        name="totalPrice"
                        type="number"
                        placeholder="Calculado automáticamente"
                        value={formData.totalPrice}
                        readOnly
                    />
                </EditCard>
            </div>
        </>
    );
}
