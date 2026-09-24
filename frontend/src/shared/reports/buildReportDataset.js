// Resuelve rutas con punto ("brand.name") además de claves planas.
export function getFieldValue(item, field) {
    if (!field || item == null) return undefined;
    return String(field).split(".").reduce((obj, part) => obj?.[part], item);
}

export function buildReportDataset({ data, fields = [], selectedFields, scope = "all", filterValue = "", columnFilters = [] }) {
    let records = [...data];

    if (scope !== "all" && filterValue.trim()) {
        const q = filterValue.trim().toLowerCase();
        records = records.filter((item) =>
            Object.values(item).some((v) =>
                String(v ?? "").toLowerCase().includes(q)
            )
        );
    }

    // Filtros por columna (coincidencia exacta, ej. nombre de inventario).
    for (const { field, value } of columnFilters) {
        if (value == null || value === "") continue;
        records = records.filter((item) => String(getFieldValue(item, field) ?? "") === String(value));
    }

    // Preserve the original field order
    const orderOf = (key) => {
        const i = fields.findIndex((f) => f.key === key);
        if (i >= 0) return i;
        return data.length ? Object.keys(data[0]).indexOf(key) : 0;
    };
    const orderedFields = selectedFields.slice().sort((a, b) => orderOf(a.key) - orderOf(b.key));

    const headers = orderedFields.map((f) => f.label);

    const rows = records.map((item) =>
        orderedFields.map((field) => {
            const value = field.accessor ? field.accessor(item) : getFieldValue(item, field.key);
            if (typeof value === "boolean") return value ? "Activo" : "Inactivo";
            if (value === null || value === undefined) return "-";
            return String(value);
        })
    );

    return { headers, rows };
}
