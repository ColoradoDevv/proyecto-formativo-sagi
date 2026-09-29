export const usersReportConfig = {
  reportTitle: "Reporte de Usuarios",
  fileNamePrefix: "reporte-usuarios",
  fields: [
    { key: "first_name", label: "Nombre", default: true },
    { key: "last_name", label: "Apellido", default: true },
    {
      key: "document_type",
      label: "Tipo de documento",
      default: true,
      accessor: (row) => row.document_type?.name ?? "-",
    },
    { key: "document_number", label: "Número de documento", default: true },
    {
      key: "role",
      label: "Rol",
      default: true,
      accessor: (row) => row.groups?.map((g) => g.name).join(", ") || "-",
    },
    { key: "email", label: "Correo personal", default: true },
    {
      key: "institutional_email",
      label: "Correo institucional",
      default: false,
    },
    { key: "phone_number", label: "Teléfono", default: false },
    { key: "second_phone_number", label: "Teléfono adicional", default: false },
    { key: "address", label: "Dirección", default: false },
    { key: "start_date", label: "Fecha inicio", default: false },
    { key: "end_date", label: "Fecha fin", default: false },
    { key: "is_active", label: "Estado", default: true },
  ],
};
