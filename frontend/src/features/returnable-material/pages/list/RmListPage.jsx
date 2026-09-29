import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TailChase } from "ldrs/react";
import { CloudAlert, Plus, Download } from "lucide-react";

import { Button, MODULE_PERMS, Notice, usePermissions } from "@/shared";
import DataTable from "@/shared/components/DataTable";
import { RmColumns } from "../../table/RmColumns";
import { returnablesReportConfig } from "../../reports/returnablesReportConfig.js";
import useRMs from "../../hooks/useRMs";

export default function RmListPage() {
    const navigate = useNavigate();
    const { isSuper, can, canAny } = usePermissions();
    const canCreate = isSuper || can("create_returnable");
    const canExport = isSuper || canAny(MODULE_PERMS.returnables.export);

    const { RMs, setRMs, loading, error } = useRMs();
    const [notification, setNotification]   = useState(null);


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
                        <p className="font-heading">Error al cargar Materiales Devolutivos</p>
                        <p className="text-small">{error.message}</p>
                    </div>
                </div>
            </div>
        );

    return (
        <div className="h-full text-text-primary">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h2 className="text-h2 text-text-primary font-heading">
                    Listado de Materiales Devolutivos
                </h2>
                {notification && (
                    <Notice severity={notification.severity} onClose={() => setNotification(null)}>
                        {notification.message}
                    </Notice>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {canCreate && (
                        <Link to="/devolutivos/crear" className="w-full">
                            <Button className="w-full" variant="soft" icon={Plus}>
                                Registrar Material
                            </Button>
                        </Link>
                    )}
                    {canExport && (
                        <Button
                            data={RMs}
                            reportConfig={returnablesReportConfig}
                            className="w-full"
                            icon={Download}
                        >
                            Descargar Reporte
                        </Button>
                    )}
                </div>
            </div>

            {/* Doble click en una fila navega al detalle del material */}
            <DataTable
                data={RMs}
                columns={RmColumns(setRMs, setNotification)}
                onRowDoubleClick={(rm) => navigate(`/devolutivos/visualizar/${rm.consumable_id}`)}
            />
        </div>
    );
}
