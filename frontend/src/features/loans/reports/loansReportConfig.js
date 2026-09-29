export const loansReportConfig = {
    reportTitle: "Reporte de Préstamos",
    fileNamePrefix: "reporte-prestamos",
    fields: [
        { key: "id_loan",                     label: "ID del préstamo",     default: true  },
        { key: "usuario_responsable",         label: "Usuario Responsable",   default: true  },
        { key: "usuario_receptor", label: "Usuario Receptor", default: true },
        { key: "apprentice_group",            label: "Grupo de aprendices", default: true  },
        { key: "material",        label: "Material",             default: true  },
        { key: "amount_lent",     label: "Cantidad",             default: true  },
        { key: "loan_date",       label: "Fecha de salida",      default: true  },
        { key: "return_date",     label: "Fecha de devolución",  default: true  },
        { key: "is_active",       label: "Estado",               default: false },
    ],
};
