import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Undo2, FileText, ImageOff, Search } from "lucide-react";
import { Button, IconButton, Input, StatusBadge, EditCard } from "@/shared";
import { mediaUrl } from "@/shared/services/api";
import useRm from "../../hooks/useRm";
import { getRMById, getRMs } from "../../services/returnableService";
import { TailChase } from "ldrs/react";
import { CloudAlert } from "lucide-react";

export default function RmDetailView() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { RM: material, loading, error } = useRm(id);
    const [searchTerm, setSearchTerm] = useState("");
    const [matches, setMatches] = useState([]);
    const [searchError, setSearchError] = useState("");
    const [searching, setSearching] = useState(false);

    const formatCurrency = (value) =>
        value != null ? `$${Number(value).toLocaleString("es-CO")}` : "-";

    const handleSearch = async (event) => {
        event.preventDefault();
        const query = searchTerm.trim();

        if (!query) {
            setMatches([]);
            setSearchError("Ingrese un ID, placa SENA o nombre.");
            return;
        }

        setSearching(true);
        setSearchError("");
        setMatches([]);

        try {
            if (/^\d+$/.test(query)) {
                try {
                    const foundMaterial = await getRMById(query);
                    navigate(`/devolutivos/visualizar/${foundMaterial.consumable_id}`);
                    return;
                } catch {
                    // Si el ID no existe, se busca el texto en nombre o placa.
                }
            }

            const results = await getRMs(query);
            const normalizedQuery = query.toLocaleLowerCase("es-CO");
            const exactMatch = results.find((item) =>
                item.sena_plate?.toLocaleLowerCase("es-CO") === normalizedQuery ||
                item.name?.toLocaleLowerCase("es-CO") === normalizedQuery
            );

            if (exactMatch) {
                navigate(`/devolutivos/visualizar/${exactMatch.consumable_id}`);
                return;
            }

            if (results.length === 1) {
                navigate(`/devolutivos/visualizar/${results[0].consumable_id}`);
                return;
            }

            if (!results.length) {
                setSearchError("No se encontró un material con ese ID, placa o nombre.");
                return;
            }

            setMatches(results.slice(0, 5));
        } catch {
            setSearchError("No fue posible realizar la búsqueda. Inténtelo nuevamente.");
        } finally {
            setSearching(false);
        }
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
                <div className="flex items-center gap-3 bg-text-secondary border border-text-secondary text-text-inverse rounded-lg px-6 py-4 max-w-md">
                    <span className="text-h1"><CloudAlert /></span>
                    <div>
                        <p className="font-heading">Error al cargar el material</p>
                        <p className="text-small">{error.message}</p>
                    </div>
                </div>
            </div>
        );

    if (!material) return null;

    // Valores de solo lectura (los selects de Editar se muestran como texto).
    const categoryLabel = material.category?.name ?? "Sin categoría";
    const brandLabel = material.brand?.name ?? "Sin marca";
    // Cuentadantes: lista. Si el backend devolvio compat con `user`
    // (singular) y no la lista, caemos a ese valor.
    const cuentas = Array.isArray(material.cuentadantes)
        ? material.cuentadantes
        : (material.user ? [material.user] : []);
    const cuentasLabel = cuentas.length
        ? cuentas.map((u) => `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim()).join(", ")
        : "Sin responsable";

    return (
        <div className="h-full text-text-primary flex flex-col gap-3">

            {/* Encabezado */}
            <div className="flex items-center gap-3">
                <IconButton onClick={() => navigate(-1)} variant="ghost">
                    <Undo2 size={18}/>
                </IconButton>
                <div>
                    <h2 className="text-h2 text-text-primary font-heading">Visualizar Material Devolutivo</h2>
                </div>
            </div>

            <div className="flex flex-col gap-3">

                <EditCard title="Buscar material devolutivo" cols={1}>
                    <form onSubmit={handleSearch} className="flex flex-col gap-2">
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Input
                                label="ID, placa SENA o nombre"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Ej. 25, 123456 o computador"
                                error={searchError}
                            />
                            <Button type="submit" variant="secondary" icon={Search} disabled={searching} className="sm:self-end">
                                {searching ? "Buscando..." : "Buscar"}
                            </Button>
                        </div>
                        {matches.length > 0 && (
                            <div className="border border-border rounded-[var(--radius-md)] divide-y divide-border overflow-hidden">
                                <p className="px-3 py-2 text-small text-text-muted">Seleccione un material:</p>
                                {matches.map((item) => (
                                    <button
                                        key={item.consumable_id}
                                        type="button"
                                        onClick={() => navigate(`/devolutivos/visualizar/${item.consumable_id}`)}
                                        className="w-full px-3 py-2 text-left hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-focus-ring"
                                    >
                                        <span className="block text-body">{item.name}</span>
                                        <span className="block text-small text-text-muted">
                                            ID: {item.consumable_id} · Placa: {item.sena_plate ?? "Sin placa"}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </form>
                </EditCard>

                {/* Información General — foto lateral + campos */}
                <EditCard title="Información General" cols={1}>
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">

                        {/* Foto + estado + fichas técnicas */}
                        <div className="flex flex-col items-center gap-2 shrink-0 w-full sm:w-36">
                            <div className="size-24 rounded-[var(--radius-xl)] overflow-hidden border border-border bg-surface-muted flex items-center justify-center">
                                {material.image
                                    ? <img src={mediaUrl(material.image)} alt={material.name} className="w-full h-full object-contain" />
                                    : <ImageOff size={40} className="text-text-muted" />
                                }
                            </div>
                            <StatusBadge active={material.is_active} />

                            {/* Lista de fichas técnicas */}
                            {material.technical_sheets?.length > 0
                                ? <div className="flex flex-col gap-1.5 w-full">
                                    {material.technical_sheets.map((sheet, i) => (
                                        <a
                                            key={sheet.id}
                                            href={mediaUrl(sheet.url)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-full)] border border-brand/40 bg-brand/8 text-brand text-small font-medium hover:bg-brand/15 transition-colors"
                                        >
                                            <FileText size={13} className="shrink-0" />
                                            <span className="truncate">Ficha {i + 1}</span>
                                        </a>
                                    ))}
                                  </div>
                                : <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-full)] border border-border bg-surface-muted text-text-muted text-small italic">
                                    <FileText size={13} className="shrink-0" />
                                    Sin ficha
                                  </span>
                            }

                            {/* Lista de cotizaciones */}
                            {material.quotations?.length > 0 && (
                                <div className="flex flex-col gap-1.5 w-full">
                                    {material.quotations.map((quote, i) => (
                                        <a
                                            key={quote.id}
                                            href={mediaUrl(quote.url)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-full)] border border-brand/40 bg-brand/8 text-brand text-small font-medium hover:bg-brand/15 transition-colors"
                                        >
                                            <FileText size={13} className="shrink-0" />
                                            <span className="truncate">Cotización {i + 1}</span>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Campos generales */}
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 min-w-0">
                            <Input label="Nombre" value={material.name ?? ""} disabled readOnly />
                            <Input label="Modelo" value={material.model ?? ""} disabled readOnly />
                            <Input label="Placa SENA" value={material.sena_plate ?? ""} disabled readOnly />
                            <Input label="Serial" value={material.serial ?? ""} disabled readOnly />
                            <Input label="Categoría" value={categoryLabel} disabled readOnly />
                            <Input label="Marca" value={brandLabel} disabled readOnly />
                            <Input
                                label="Nombre de inventario"
                                value={material.inventory?.name ?? "Sin inventario"}
                                disabled
                                readOnly
                            />
                            <Input
                                label="Categoría"
                                value={material.category?.name ?? "Sin categoría"}
                                disabled
                                readOnly
                            />
                            <Input
                                label="Cuentadantes"
                                value={cuentasLabel}
                                disabled
                                readOnly
                                title={cuentasLabel}
                            />
                            <div className="sm:col-span-2">
                                <Input label="Descripción" value={material.description ?? ""} disabled readOnly />
                            </div>
                        </div>

                    </div>
                </EditCard>

                {/* Inventario y Valores lado a lado */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <EditCard title="Inventario">
                        <Input label="Estado" value={material.state ?? ""} disabled readOnly />
                        <Input label="Cantidad" value={material.quantity ?? "Sin cantidad"} disabled readOnly />
                        <Input label="Ubicación" value={material.location ?? "Sin ubicación"} disabled readOnly />
                        <Input label="Fecha de compra" value={material.purchase_date ?? ""} disabled readOnly />
                        <Input label="Fecha de ingreso" value={material.entry_date ?? ""} disabled readOnly />
                    </EditCard>

                    <EditCard title="Valores">
                        <Input label="Valor Unitario" value={formatCurrency(material.unit_price)} disabled readOnly />
                        <Input label="Valor Total" value={formatCurrency(material.total_price)} disabled readOnly />
                    </EditCard>
                </div>

                <div className="flex gap-4 justify-center md:justify-end">
                    <Button variant="secondary" size="md" onClick={() => navigate("/devolutivos")}>
                        Volver al listado
                    </Button>
                    <Button variant="primary" size="md" onClick={() => navigate(`/devolutivos/editar/${material.consumable_id}`)}>
                        Editar
                    </Button>
                </div>

            </div>

        </div>
    );
}
