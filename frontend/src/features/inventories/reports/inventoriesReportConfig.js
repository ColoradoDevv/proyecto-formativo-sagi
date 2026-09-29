export const inventoriesReportConfig = {
    reportTitle: "Reporte de Nombres de Inventario",
    fileNamePrefix: "reporte-inventarios",
    fields: [
        { key: "id",          label: "ID",          default: true  },
        { key: "name",        label: "Nombre",      default: true  },
        { key: "description", label: "Descripción", default: false },
        { key: "is_active",   label: "Activo",      default: true  },
    ],
};
