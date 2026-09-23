import { Link, useNavigate } from "react-router-dom";
import { TailChase } from "ldrs/react";
import { CloudAlert, Plus, Download } from "lucide-react";

import { Button, usePermissions } from "@/shared";
import DataTable from "@/shared/components/DataTable";
import { batchColumns } from "../../table/BatchColumns";
import useLoanBatches from "../../hooks/useLoanBatches";

export default function LoansListPage() {
    const navigate = useNavigate();
    const { isAdmin, isSuper, can } = usePermissions();
    const canCreate = isSuper || can("create_loan");
    const { batches, loading, error } = useLoanBatches();

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
                        <p className="font-heading">Error al cargar Préstamos</p>
                        <p className="text-small">{error.message}</p>
                    </div>
                </div>
            </div>
        );

    const columns = batchColumns();

    return (
        <div className="h-full text-text-primary">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h2 className="text-h2 text-text-primary font-heading">
                    {isAdmin ? "Listado de Préstamos" : "Mis Préstamos"}
                </h2>

                <div className={canCreate ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "flex justify-end"}>
                    {canCreate && (
                        <Link to="/prestamos/crear" className="w-full">
                            <Button className="w-full" variant="soft" icon={Plus}>
                                Registrar Préstamo
                            </Button>
                        </Link>
                    )}
                    <Button
                        data={batches}
                        className="w-full"
                        icon={Download}
                    >
                        Descargar Reporte
                    </Button>
                </div>
            </div>

            {/* Doble click navega al detalle del lote */}
            <DataTable
                data={batches}
                columns={columns}
                onRowDoubleClick={(batch) =>
                    navigate(`/prestamos/lote/${batch.batch_id}`)
                }
            />
        </div>
    );
}
