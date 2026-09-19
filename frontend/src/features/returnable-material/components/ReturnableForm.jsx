import { Input, Select, TextArea, EditCard, CreateOptionButton } from "@/shared";
import { getReturnableCategoryRules } from "../utils/returnableCategoryRules";
import { Plus } from "lucide-react";

// Campos de material devolutivo, reutilizables entre crear y editar.
// PRESENTACIONAL: recibe formData/errors/onChange, las opciones de selects
// (categories, brands, states) y un slot para la seccion de foto/ficha
// (distinta en crear vs editar).
// Convencion de nombres unificada: name, senaPlate, serial, category, brand,
// description, state, quantity, location, purchaseDate, unitPrice, totalPrice.
export default function ReturnableForm({
    formData,
    errors = {},
    onChange,
    categories = [],
    brands = [],
    states = [],
    onCreateBrand = null,
    photoSlot = null,
}) {
    // Al crear una marca nueva, se selecciona automáticamente en el formulario.
    const handleBrandCreated = (option) =>
        onChange({ target: { name: "brand", value: String(option.id) } });

    const selectedCategory = categories.find((option) => String(option.id) === String(formData.category));
    const categoryName = selectedCategory?.label ?? selectedCategory?.name ?? "";
    const categoryRules = getReturnableCategoryRules(categoryName);
    const shouldShowDimensions = categoryRules.requiresDimensions;
    return (
        <>
            {/* Información General — foto lateral + campos */}
            <EditCard title="Información General" cols={1}>
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">

                    {/* Foto / ficha tecnica (slot: FileInputs en crear, preview en editar) */}
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
                            labelAction={<CreateOptionButton variant="spacer" />}

                            required
                        />
                        <Input
                            label="Modelo"
                            name="model"
                            placeholder="Modelo del material"
                            value={formData.model}
                            onChange={onChange}
                            error={errors.model}
                            labelAction={<CreateOptionButton variant="spacer" />}

                            //required
                        />
                        <Input
                            label="Placa SENA"
                            name="senaPlate"
                            placeholder="Placa SENA"
                            value={formData.senaPlate}
                            onChange={onChange}
                            error={errors.senaPlate}
                            required={categoryRules.requiresSenaPlate}
                            optional={!categoryRules.requiresSenaPlate}
                            labelAction={<CreateOptionButton variant="spacer" />}

                        />
                        <Select
                            label="Categoría"
                            name="category"
                            options={categories}
                            value={formData.category}
                            onChange={onChange}
                            error={errors.category}
                            required
                            labelAction={<CreateOptionButton variant="spacer" />}
                        />    
                        <Input
                            label="S/N"
                            name="serial"
                            placeholder="Numero serial del material"
                            value={formData.serial}
                            onChange={onChange}
                            error={errors.serial}
                            required={categoryRules.requiresId}
                            optional={!categoryRules.requiresId}
                            labelAction={<CreateOptionButton variant="spacer" />}
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
                            <TextArea
                                label="Descripción"
                                name="description"
                                placeholder="Descripción del material"
                                value={formData.description}
                                onChange={onChange}
                                error={errors.description}
                                required
                                labelAction={<CreateOptionButton variant="spacer" />}
                            />

                        {shouldShowDimensions && (
                            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <Input
                                    label="Ancho"
                                    name="width"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="Ancho"
                                    value={formData.width ?? ""}
                                    onChange={onChange}
                                    error={errors.width}
                                    labelAction={<CreateOptionButton variant="spacer" />}
                                    required
                                />
                                <Input
                                    label="Largo"
                                    name="length"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="Largo"
                                    value={formData.length ?? ""}
                                    onChange={onChange}
                                    error={errors.length}
                                    labelAction={<CreateOptionButton variant="spacer" />}
                                    required
                                />
                                <Input
                                    label="Profundidad"
                                    name="depth"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="Profundidad"
                                    value={formData.depth ?? ""}
                                    onChange={onChange}
                                    error={errors.depth}
                                    labelAction={<CreateOptionButton variant="spacer" />}
                                    required
                                />
                            </div>
                        )}
                    </div>
                </div>
            </EditCard>

            {/* Inventario y Valores lado a lado */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                <EditCard title="Inventario">
                    <Select
                        label="Estado"
                        name="state"
                        options={states}
                        value={formData.state}
                        onChange={onChange}
                        error={errors.state}
                        labelAction={<CreateOptionButton variant="spacer" />}
                        required
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
                        error={errors.quantity}
                        labelAction={<CreateOptionButton variant="spacer" />}
                        required
                    />
                    <Input
                        label="Ubicación (opcional)"
                        name="location"
                        placeholder="Ubicación del material"
                        value={formData.location}
                        onChange={onChange}
                        error={errors.location}
                        labelAction={<CreateOptionButton variant="spacer" />}
                    />
                    <Input
                        label="Fecha de compra"
                        name="purchaseDate"
                        type="date"
                        value={formData.purchaseDate}
                        onChange={onChange}
                        error={errors.purchaseDate}
                        labelAction={<CreateOptionButton variant="spacer" />}
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
                        labelAction={<CreateOptionButton variant="spacer" />}
                        required
                    />
                    <Input
                        label="Valor Total"
                        name="totalPrice"
                        type="number"
                        placeholder="Calculado automáticamente"
                        value={formData.totalPrice}
                        error={errors.totalPrice}
                        labelAction={<CreateOptionButton variant="spacer" />}
                        readOnly
                    />
                </EditCard>
            </div>
        </>
    );
}
