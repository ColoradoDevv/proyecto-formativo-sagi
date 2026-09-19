import { useState } from 'react';
import { Button, SearchField, IconButton, ActiveSwitch } from '@/shared';
import { Plus, ArrowLeft, ArrowRight, Pencil, CloudAlert, Tag, Award } from 'lucide-react';
import { TailChase } from 'ldrs/react';
import Alert from '@mui/material/Alert';
import useBrands from '../../hooks/useBrands';
import { toggleBrandActive } from '../../services/brandService';
import BrandModal from '../../components/BrandModal';

export default function BrandListPage() {
    const { brands, setBrands, loading, error } = useBrands();
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(0);
    const [notification, setNotification] = useState(null);
    const itemsPerPage = 8;

    // Estado del modal: abierto, marca seleccionada y modo (view | edit | create).
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedBrand, setSelectedBrand] = useState(null);
    const [modalMode, setModalMode] = useState('view');

    const openBrandModal = (brand, mode) => {
        setSelectedBrand(brand);
        setModalMode(mode);
        setModalOpen(true);
    };

    const openCreateModal = () => {
        setSelectedBrand(null);
        setModalMode('create');
        setModalOpen(true);
    };

    const handleBrandUpdated = (updated) => {
        setBrands((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
    };

    const handleBrandCreated = (created) => {
        setBrands((prev) => [...prev, created]);
    };

    if (loading)
        return (
            <div className="h-full flex items-center justify-center">
                <TailChase size="40" speed="1.75" color="var(--semantic-text-primary)" />
            </div>
        );

    if (error)
        return (
            <div className="h-full flex items-center justify-center">
                <div className="bg-surface-hover rounded-2xl border border-border shadow-(--shadow-elevation-2) p-6 max-w-md animate-fade-in">
                    <div className="flex items-center gap-3 text-text-primary">
                        <span className="text-h2 text-text-secondary"><CloudAlert /></span>
                        <div>
                            <p className="font-heading">No se pudieron cargar las marcas</p>
                            <p className="text-small text-text-secondary">{error.message}</p>
                        </div>
                    </div>
                </div>
            </div>
        );

    const filteredBrands = brands.filter((brand) =>
        brand.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.max(1, Math.ceil(filteredBrands.length / itemsPerPage));
    const startIdx = currentPage * itemsPerPage;
    const paginatedBrands = filteredBrands.slice(startIdx, startIdx + itemsPerPage);
    const safePage = Math.min(currentPage, totalPages - 1);

    const handlePrevPage = () => setCurrentPage((p) => Math.max(0, p - 1));
    const handleNextPage = () => setCurrentPage((p) => Math.min(totalPages - 1, p + 1));

    const handleToggle = async (id, newValue) => {
        try {
            await toggleBrandActive(id, newValue);
            setBrands((prev) =>
                prev.map((b) => (b.id === id ? { ...b, is_active: newValue } : b))
            );
        } catch {
            setNotification({ severity: 'error', message: 'Error al cambiar el estado de la marca' });
        }
    };

    return (
        <div className="h-full p-4 sm:p-6 text-text-primary flex flex-col gap-6">

            {/* Encabezado */}
            <div className="flex flex-col gap-2">
                <p className="text-medium text-text-primary uppercase tracking-widest font-medium">
                    Catálogo
                </p>
                <h2 className="text-h2 text-text-primary font-heading">
                    Marcas
                </h2>
                <p className="text-small text-text-secondary">
                    Gestiona las marcas registradas en el sistema.
                </p>
            </div>

            {notification && (
                <Alert severity={notification.severity} onClose={() => setNotification(null)}>
                    {notification.message}
                </Alert>
            )}

            {/* Toolbar */}
            <div className="bg-surface-hover rounded-2xl border border-border shadow-(--shadow-elevation-4) p-6 flex flex-col gap-4 animate-fade-in">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <SearchField
                        placeholder="Buscar marca..."
                        variant="outlined"
                        value={searchTerm}
                        onChange={setSearchTerm}
                        fullWidth
                        className="sm:w-full sm:flex-1"
                    />
                    <Button
                        onClick={openCreateModal}
                        variant="soft"
                        className="w-full sm:w-auto shrink-0"
                    >
                        <Plus size={18} />
                        Registrar Marca
                    </Button>
                </div>

                {/* Grid */}
                {paginatedBrands.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                        {paginatedBrands.map((brand, index) => (
                            <div
                                key={brand.id}
                                style={{ animationDelay: `${index * 50}ms` }}
                                className="bg-surface-hover rounded-2xl border border-border shadow-(--shadow-elevation-4) hover:shadow-(--shadow-elevation-5) hover:-translate-y-1 transition-all duration-200 p-5 flex flex-col gap-4 animate-slide-up"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <span className="bg-success-soft rounded-full w-10 h-10 flex items-center justify-center shrink-0">
                                        <Award size={18} className="text-text-primary" />
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <IconButton
                                            variant="ghost"
                                            hitSize={32}
                                            iconSize={16}
                                            onClick={() => openBrandModal(brand, 'edit')}
                                            ariaLabel="Editar marca"
                                        >
                                            <Pencil size={16} />
                                        </IconButton>
                                        <ActiveSwitch
                                            id={brand.id}
                                            isActive={brand.is_active}
                                            toggleFn={handleToggle}
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <h3 className="text-medium font-medium text-text-primary truncate" title={brand.name}>
                                        {brand.name}
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => openBrandModal(brand, 'view')}
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
                            {brands.length === 0 ? "Aún no hay marcas registradas." : "No se encontraron marcas."}
                        </p>
                        <p className="text-small text-text-secondary text-center">
                            {brands.length === 0
                                ? "Cuando registres una marca, aparecerá aquí."
                                : "Intenta ajustar la búsqueda."}
                        </p>
                    </div>
                )}
            </div>

            {/* Paginación (fuera de la card) */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <Button variant="secondary" onClick={handlePrevPage} disabled={safePage === 0}>
                        <ArrowLeft size={18} />
                        Anterior
                    </Button>
                    <span className="text-small text-text-muted">
                        Página {safePage + 1} de {totalPages}
                    </span>
                    <Button variant="secondary" onClick={handleNextPage} disabled={safePage >= totalPages - 1}>
                        Siguiente
                        <ArrowRight size={18} />
                    </Button>
                </div>
            )}

            <BrandModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                brand={selectedBrand}
                mode={modalMode}
                onUpdated={handleBrandUpdated}
                onCreated={handleBrandCreated}
            />
        </div>
    );
}
