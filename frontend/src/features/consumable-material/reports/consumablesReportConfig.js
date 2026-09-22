import { joinCuentadantes } from "@/shared/utils/cuentadantes";

export const consumablesReportConfig = {
    reportTitle: "Reporte de Materiales de Consumo",
    fileNamePrefix: "reporte-consumibles",
    fields: [
        { key: "id", label: "ID",      default: false },
        { key: "name",        label: "Nombre",           default: true  },
        { key: "description", label: "Descripción",      default: false },
        { key: "location",    label: "Ubicación",        default: false },
        { key: "sena_plate",  label: "Placa SENA",      default: true  },
        { key: "cuentadantes", label: "Cuentadantes",    default: true,  accessor: (row) => joinCuentadantes(row) },
        { key: "brand",       label: "Marca",            default: true,  accessor: (row) => row.brand?.name ?? "-" },
        { key: "state",       label: "Estado",           default: true  },
        { key: "quantity",    label: "Cantidad",         default: true  },
        { key: "unit_price",  label: "Valor unitario",   default: false },
        { key: "total_price", label: "Valor total",      default: false },
        { key: "is_active",      label: "Activo",           default: false },
        { key: "purchase_date",  label: "Fecha de compra",  default: false },
        { key: "entry_date",     label: "Fecha de ingreso", default: false },
    ],
};
