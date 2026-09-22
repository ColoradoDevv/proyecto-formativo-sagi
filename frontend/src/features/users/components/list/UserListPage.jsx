import { Link, useNavigate } from "react-router-dom";
import DataTable from "@/shared/components/DataTable";
import { getUserColumns } from "../../table/UserColumns.jsx"; // antes: userColumns
import { usersReportConfig } from "../../reports/usersReportConfig.js";
import useUsers from "../../hooks/useUsers.js";
import { TailChase } from 'ldrs/react'
import 'ldrs/react/TailChase.css'
import { CloudAlert, Plus, Download } from "lucide-react";
import { Button, usePermissions } from "@/shared"


export default function ListUserPage() {

    const navigate = useNavigate();
    const { can, isSuper } = usePermissions();
    const canCreateUsers = isSuper || can("create_user");

    // FETCH GET /api/users/
    const { users, loading, error, refetch } = useUsers();

    // Columnas de la tabla; onDeleted refresca el listado tras un borrado logico
    const columns = getUserColumns(refetch);

    if (loading)
        return (
            <div className="h-full flex items-center justify-center">
                <TailChase size="40" speed="1.75" color="var(--semantic-text-primary)"/>
            </div>
        )

    if (error) return (
        <div className="h-full flex items-center justify-center">
            <div className="flex items-center gap-3 bg-text-secondary  border border-text-secondary text-text-inverse rounded-lg px-6 py-4 max-w-md">
                <span className="text-h1"><CloudAlert/></span>
                <div>
                    <p className="font-heading">Error al cargar Usuarios</p>
                    <p className="text-small">{error.message}</p>
                </div>
            </div>
        </div>
    )

    return (
        <div className="h-full text-text-primary">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h2 className="text-h2 text-text-primary font-heading">
                    Listado de Usuarios
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {canCreateUsers && (
                        <Link to="/usuarios/crear" className="w-full">
                            <Button
                                className="w-full"
                                variant="soft"
                                icon={Plus}
                            >
                                Registrar Usuario
                            </Button>
                        </Link>
                    )}
                    <Button
                        data={users}
                        icon={Download}
                        reportConfig={usersReportConfig}
                        className="w-full"
                    >
                        Descargar Reporte
                    </Button>
                </div>
            </div>

            {/* Doble click en una fila navega al detalle del usuario */}
            <DataTable
                data={users}
                columns={columns}
                onRowDoubleClick={(user) => navigate(`/usuarios/visualizar/${user.id}`)}
            />
        </div>
    );
}