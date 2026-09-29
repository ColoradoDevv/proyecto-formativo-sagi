export const categoriesReportConfig = {
    reportTitle: "Reporte de Categorias de Materiales",
    fileNamePrefix: "reporte-categorias",
    fields: [
        { key: "id",          label: "ID",          default: true  },
        { key: "name",        label: "Nombre",      default: true  },
        { key: "description", label: "Descripcion", default: false },
        { key: "is_active",   label: "Activo",      default: true  },
    ],
};
