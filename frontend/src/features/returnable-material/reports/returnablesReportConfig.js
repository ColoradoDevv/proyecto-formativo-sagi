import { joinCuentadantes } from "@/shared/utils/cuentadantes";

export const returnablesReportConfig = {
    reportTitle: "Reporte de Materiales Devolutivos",
    fileNamePrefix: "reporte-devolutivos",
    fields: [
        { key: "sena_plate",   label: "Placa SENA",    default: true  },
        { key: "name",         label: "Nombre",         default: true  },
        { key: "brand.name",   label: "Marca",          default: true  },
        { key: "inventory.name", label: "Nombre de inventario", default: true },
        { key: "category.name",label: "Categoría",      default: true  },
        { key: "model",        label: "Modelo",         default: true  },
        { key: "serial",       label: "Serial",         default: true  },
        {
            key: "cuentadantes",
            label: "Cuentadantes",
            default: true,
            accessor: (row) => joinCuentadantes(row),
        },
        { key: "dimensions",   label: "Dimensiones",    default: true  },
        { key: "state",        label: "Estado",         default: true  },
        { key: "quantity",     label: "Cantidad",       default: false },
        { key: "unit_price",   label: "Valor unitario", default: false },
        { key: "total_price",  label: "Valor total",    default: false },
        { key: "purchase_date",label: "Fecha compra",   default: false },
        { key: "entry_date",     label: "Fecha ingreso",  default: false },
        { key: "is_active",      label: "Activo",           default: false },
    ],
    filters: [
        { key: "inventory", label: "Nombre de inventario", field: "inventory.name" },
    ],
};
