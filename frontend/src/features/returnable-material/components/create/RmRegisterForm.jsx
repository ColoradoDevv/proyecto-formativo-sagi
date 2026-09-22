import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getBrands, getStates, getCategories, getUsers, getInventories, createBrand, createInventory, createCategory } from "@/shared/services/selectServices";
import { createRM } from "../../services/returnableService";
import { FileInput, Button, showAlert, cancelAlert, ProfileFileInput, IconButton } from "@/shared";
import { rmSchema } from "../../schemas/rmSchema";
import ReturnableForm from "../ReturnableForm";
import { QuotationPicker } from "@/features/quotations";
import { getReturnableCategoryOptions } from "../../utils/returnableCategoryRules";
import { Undo2 } from "lucide-react";


export default function RmRegisterForm() {
    const navigate = useNavigate();
    const [categories, setCategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [states, setStates] = useState([]);
    const [users, setUsers] = useState([]);
    const [inventories, setInventories] = useState([]);
    const [submitting, setSubmitting] = useState(false);

    // Convencion de nombres unificada con ReturnableForm y el edit.
    const [formData, setFormData] = useState({
        senaPlate: "",
        name: "",
        model: "",
        state: "",
        category: "",
        brand: "",
        inventory: "",
        serial: "",
        quantity: "",
        location: "",
        unitPrice: "",
        totalPrice: "",
        description: "",
        purchaseDate: "",
        entryDate: "",
        // Cuentadantes (M2M): lista de IDs. Si se deja vacia, el backend
        // asigna por defecto al usuario actual.
        cuentadantes: [],
        technicalSheet: [],
        quotations: [],
        photo: [],
        width: "",
        length: "",
        depth: "",
    });
    const [errors, setErrors] = useState({});

    useEffect(() => { getCategories().then(setCategories); }, []);
    useEffect(() => { getBrands().then(setBrands); }, []);
    useEffect(() => { getStates().then(setStates); }, []);
    useEffect(() => { getUsers().then(setUsers).catch(() => setUsers([])); }, []);
    useEffect(() => { getInventories().then(setInventories).catch(() => setInventories([])); }, []);

    // Crea una marca nueva, la agrega a las opciones y la devuelve al formulario.
    const handleCreateBrand = async (name) => {
        const option = await createBrand(name);
        setBrands((prev) => [...prev, option]);
        return option;
    };
    // Crea un nombre de inventario nuevo, lo agrega a las opciones y lo devuelve al form.
    const handleCreateInventory = async (name) => {
        const option = await createInventory(name);
        setInventories((prev) => [...prev, option]);
        return option;
    };
    // Crea una categoria nueva, la agrega a las opciones y la devuelve al form.
    // No se usa directamente porque la categoria es requerida y existe
    // siempre como FK; pero se expone por simetria con brand/inventory.
    const handleCreateCategory = async (name) => {
        const option = await createCategory(name);
        setCategories((prev) => [...prev, option]);
        return option;
    };

    const handleFileChange = (name) => (files) => {
        setFormData((prev) => ({ ...prev, [name]: files }));
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData((prev) => {
            const updated = { ...prev, [name]: value };

            // Calcular total automaticamente a partir de cantidad x valor unitario.
            const quantity  = name === "quantity"  ? value : updated.quantity;
            const unitPrice = name === "unitPrice" ? value : updated.unitPrice;
            if (quantity && unitPrice) {
                const total = (parseFloat(quantity) * parseFloat(unitPrice)).toFixed(2);
                updated.totalPrice = isNaN(total) ? "" : total;
            }

            return updated;
        });
    };

    async function handleCancel() {
        const result = await cancelAlert();
        if (result.isConfirmed) navigate(-1);
    }

    const handleSubmit = async (e) => {
        e.preventDefault();

        const selectedCategory = categories.find((option) => String(option.id) === String(formData.category));
        const payload = { ...formData, categoryName: selectedCategory?.label ?? selectedCategory?.name ?? "" };
        const result = rmSchema.safeParse(payload);

        if (!result.success) {
            const fieldErrors = {};
            result.error.issues.forEach((issue) => {
                fieldErrors[issue.path[0]] = issue.message;
            });
            setErrors(fieldErrors);
            return;
        }

        setErrors({});
        setSubmitting(true);

        try {
            // Pasar los archivos directamente de formData (no de result.data) para
            // evitar que z.instanceof(File) los descarte silenciosamente en Vite.
            // Tambien pasamos `cuentadantes` (array) porque Zod lo descarta al
            // no estar declarado en rmSchema (no es requerido a nivel de RM).
            await createRM({
                ...result.data,
                photo: formData.photo,
                technicalSheet: formData.technicalSheet,
                quotations: formData.quotations,
                cuentadantes: formData.cuentadantes,
            });
            await showAlert({ icon: "success", iconColor: "var(--color-success)", title: "Material devolutivo creado exitosamente" });
            navigate("/devolutivos");
        } catch (err) {
            if (err.fieldErrors) setErrors((prev) => ({ ...prev, ...err.fieldErrors }));
            showAlert({ icon: "error", iconColor: "var(--color-error)", title: "Error al crear material devolutivo", text: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    const availableCategories = getReturnableCategoryOptions(categories);

    return (
        <div className="h-full text-text-primary flex flex-col gap-3">

            <div className="flex items-center gap-3">
                <IconButton onClick={() => navigate(-1)} variant="ghost">
                    <Undo2 size={20}/>
                </IconButton>
                <h2 className="text-h2 text-text-primary font-heading">Crear Material Devolutivo</h2>
            </div>

            <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">

                <ReturnableForm
                    formData={formData}
                    errors={errors}
                    onChange={handleChange}
                    categories={availableCategories}
                    brands={brands}
                    states={states}
                    users={users}
                    inventories={inventories}
                    onCreateBrand={handleCreateBrand}
                    onCreateInventory={handleCreateInventory}
                    onCreateCategory={handleCreateCategory}
                    photoSlot={
                        <div className="w-full sm:w-[var(--size-field-sm)] flex flex-col gap-4">
                            <ProfileFileInput
                                label="Foto del Material"
                                required
                                name="photo"
                                placeholder="Subir foto"
                                value={formData.photo}
                                onChange={handleFileChange("photo")}
                                error={errors.photo}
                                accept="image/*"
                                className="w-full h-25 rounded-2xl"
                            />
                            <FileInput
                                label="Fichas Técnicas"
                                name="technicalSheet"
                                placeholder="Subir fichas técnicas (máx. 3)"
                                value={formData.technicalSheet}
                                onChange={handleFileChange("technicalSheet")}
                                error={errors.technicalSheet}
                                accept="application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png"
                                multiple
                                required
                                maxFiles={3}
                                maxSizeMB={3}
                                className="w-full h-14 rounded-2xl"
                            />
                            <QuotationPicker
                                name="quotations"
                                value={formData.quotations}
                                onChange={handleChange}
                                error={errors.quotations}
                                required
                            />
                        </div>
                    }
                />

                <div className="flex gap-4 justify-center md:justify-end">
                    <Button type="button" variant="secondary" size="md" onClick={handleCancel}>
                        Cancelar
                    </Button>
                    <Button type="submit" variant="primary" size="md" disabled={submitting}>
                        {submitting ? "Guardando..." : "Crear"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
