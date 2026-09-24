import { useState } from "react";
import { Button, SearchField, IconButton, ActiveSwitch, Notice, usePermissions } from "@/shared";
import { Plus, ArrowLeft, ArrowRight, Pencil, CloudAlert, Tag, Layers } from "lucide-react";
import { TailChase } from "ldrs/react";
import useCategories from "../../hooks/useCategories";
import { toggleCategoryActive } from "../../services/categoryService";
import CategoryModal from "../../components/CategoryModal";

export default function CategoryListPage() {
    const { categories, setCategories, loading, error } = useCategories();
    const { isSuper, can } = usePermissions();
    const canCreate = isSuper || can("create_category");
    const canEdit = isSuper || can("edit_category");
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(0);
    const [notification, setNotification] = useState(null);
    const itemsPerPage = 8;

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [modalMode, setModalMode] = useState("view");

    const openCategoryModal = (category, mode) => {
        setSelectedCategory(category);
        setModalMode(mode);
        setModalOpen(true);
    };

    const openCreateModal = () => {
        setSelectedCategory(null);
        setModalMode("create");
        setModalOpen(true);
    };

    const handleCategoryUpdated = (updated) => {
        setCategories((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
    };

    const handleCategoryCreated = (created) => {
        setCategories((prev) => [...prev, created]);
    };

    if (loading)
        return (
            <div className="h-full flex items-center justify-center">
                <TailChase size="40" speed="1.75" color="var(--semantic-text-primary)" />
            </div>
        );

    if (error)
        return (
            <div className="h-full flex items-center justify-center py-12">
                <div className="bg-surface-hover rounded-2xl border border-border shadow-(--shadow-elevation-2) p-6 max-w-md animate-fade-in">
                    <div className="flex items-center gap-3 text-text-primary">
                        <span className="text-h2 text-text-secondary"><CloudAlert /></span>
                        <div>
                            <p className="font-heading">No se pudieron cargar las categorias</p>
                            <p className="text-small text-text-secondary">{error.message}</p>
                        </div>
                    </div>
                </div>
            </div>
        );

    const filteredCategories = categories.filter((category) =>
        category.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.max(1, Math.ceil(filteredCategories.length / itemsPerPage));
    const startIdx = currentPage * itemsPerPage;
    const paginatedCategories = filteredCategories.slice(startIdx, startIdx + itemsPerPage);
    const safePage = Math.min(currentPage, totalPages - 1);

    const handlePrevPage = () => setCurrentPage((p) => Math.max(0, p - 1));
    const handleNextPage = () => setCurrentPage((p) => Math.min(totalPages - 1, p + 1));

    const handleToggle = async (id, newValue) => {
        try {
            await toggleCategoryActive(id, newValue);
            setCategories((prev) =>
                prev.map((b) => (b.id === id ? { ...b, is_active: newValue } : b))
            );
        } catch {
            setNotification({
                severity: "error",
                message: "Error al cambiar el estado de la categoria",
            });
        }
    };

    return (
        <div className="h-full text-text-primary flex flex-col gap-6">

            {/* Encabezado */}
            <div className="flex flex-col gap-2">
                <p className="text-medium text-text-primary uppercase tracking-widest font-medium">
                    Catalogo
                </p>
                <h2 className="text-h2 text-text-primary font-heading">
                    Categorias de Materiales
                </h2>
                <p className="text-small text-text-secondary">
                    Gestiona las categorias disponibles para clasificar materiales consumibles y devolutivos.
                </p>
            </div>

            {notification && (
                <Notice severity={notification.severity} onClose={() => setNotification(null)}>
                    {notification.message}
                </Notice>
            )}

            {/* Toolbar */}
            <div className="bg-surface-hover rounded-2xl border border-border shadow-(--shadow-elevation-4) p-6 flex flex-col gap-4 animate-fade-in">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <SearchField
                        placeholder="Buscar categoria..."
                        variant="outlined"
                        value={searchTerm}
                        onChange={setSearchTerm}
                        fullWidth
                        className="sm:w-full sm:flex-1"
                    />
                    {canCreate && (
                        <Button
                            onClick={openCreateModal}
                            variant="soft"
                            className="w-full sm:w-auto shrink-0"
                        >
                            <Plus size={18} />
                            Registrar Categoria
                        </Button>
                    )}
                </div>

                {/* Grid */}
                {paginatedCategories.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                        {paginatedCategories.map((category, index) => (
                            <div
                                key={category.id}
                                style={{ animationDelay: `${index * 50}ms` }}
                                className="bg-surface-hover rounded-2xl border border-border shadow-(--shadow-elevation-4) hover:shadow-(--shadow-elevation-5) hover:-translate-y-1 transition-all duration-200 p-5 flex flex-col gap-4 animate-slide-up"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <span className="bg-warning-soft rounded-full w-10 h-10 flex items-center justify-center shrink-0">
                                        <Layers size={18} className="text-text-primary" />
                                    </span>
                                    <div className="flex items-center gap-1">
                                        {canEdit && (
                                            <IconButton
                                                variant="ghost"
                                                hitSize={32}
                                                iconSize={16}
                                                onClick={() => openCategoryModal(category, "edit")}
                                                ariaLabel="Editar categoria"
                                            >
                                                <Pencil size={16} />
                                            </IconButton>
                                        )}
                                        {canEdit && (
                                            <ActiveSwitch
                                                id={category.id}
                                                isActive={category.is_active}
                                                toggleFn={handleToggle}
                                            />
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <h3 className="text-medium font-medium text-text-primary truncate" title={category.name}>
                                        {category.name}
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => openCategoryModal(category, "view")}
                                        className="text-brand text-small hover:underline text-left w-fit cursor-pointer"
                                    >
                                        Ver detalles
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-surface-hover rounded-2xl border-2 border-dashed border-border-strong py-12 px-6 flex flex-col items-center gap-3">
                        <span className="bg-surface-hover rounded-full w-14 h-14 flex items-center justify-center shadow-(--shadow-elevation-1)">
                            <Tag size={22} className="text-text-primary" />
                        </span>
                        <p className="text-medium font-medium text-text-primary">
                            {categories.length === 0
                                ? "Aun no hay categorias registradas."
                                : "No se encontraron categorias."}
                        </p>
                        <p className="text-small text-text-secondary text-center">
                            {categories.length === 0
                                ? "Cuando registres una categoria, aparecera aqui."
                                : "Intenta ajustar la busqueda."}
                        </p>
                    </div>
                )}
            </div>

            {/* Paginacion (fuera de la card) */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <Button variant="secondary" onClick={handlePrevPage} disabled={safePage === 0}>
                        <ArrowLeft size={18} />
                        Anterior
                    </Button>
                    <span className="text-small text-text-muted">
                        Pagina {safePage + 1} de {totalPages}
                    </span>
                    <Button variant="secondary" onClick={handleNextPage} disabled={safePage >= totalPages - 1}>
                        Siguiente
                        <ArrowRight size={18} />
                    </Button>
                </div>
            )}

            <CategoryModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                category={selectedCategory}
                mode={modalMode}
                onUpdated={handleCategoryUpdated}
                onCreated={handleCategoryCreated}
            />
        </div>
    );
}
