import { Link, useNavigate } from "react-router-dom";
import { TailChase } from "ldrs/react";
import { CloudAlert, Download, Plus } from "lucide-react";

import { Button, usePermissions } from "@/shared";
import DataTable from "@/shared/components/DataTable";
import { materialColumns } from "../../table/materialColumns.jsx";
import { consumablesReportConfig } from "../../reports/consumablesReportConfig.js";
import useProducts from "../../hooks/useCMs.js";

export default function ListCmPage() {
    const navigate = useNavigate();
    const { isSuper, can } = usePermissions();
    const canCreate = isSuper || can("create_consumable");

    const { CMs, setCMs, loading, error } = useProducts();

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
                        <p className="font-heading">Error al cargar Materiales de Consumo</p>
                        <p className="text-small">{error.message}</p>
                    </div>
                </div>
            </div>
        );

    return (
        <div className="h-full p-4 sm:p-6 text-text-primary">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h2 className="text-h3 font-heading">
                    Listado de Materiales de Consumo
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {canCreate && (
                        <Link to="/consumibles/crear" className="w-full">
                            <Button className="w-full" variant="soft" icon={Plus}>
                                Registrar Material
                            </Button>
                        </Link>
                    )}
                    <Button
                        data={CMs}
                        reportConfig={consumablesReportConfig}
                        className="w-full"
                        icon={Download}
                    >
                        Descargar Reporte
                    </Button>
                </div>
            </div>

            {/* Doble click en una fila navega al detalle del material */}
            <DataTable
                data={CMs}
                columns={materialColumns(setCMs)}
                onRowDoubleClick={(cm) => navigate(`/consumibles/visualizar/${cm.id}`)}
            />
        </div>
    );
}
