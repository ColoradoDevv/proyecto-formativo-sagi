import { z } from "zod";

function isValidMoney(value) {
    return /^\d+(\.\d{1,2})?$/.test(value);
}

function toCents(value) {
    return Math.round(Number(value) * 100);
}

// Fecha de hoy en formato YYYY-MM-DD (lo que entrega un <input type="date">).
function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// Comprueba que el string sea una fecha real (rechaza "2024-13-40", "0000-00-00").
function isValidDateString(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(`${value}T00:00:00`);
    return (
        !Number.isNaN(date.getTime()) &&
        date.getFullYear() === y &&
        date.getMonth() + 1 === m &&
        date.getDate() === d
    );
}

// Schema para CREACION. Usa la MISMA convencion de nombres que ReturnableForm
// (name, senaPlate, brand, ...) para poder reutilizar el formulario.
export const rmSchema = z.object({
    senaPlate: z
        .string()
        .trim()
        .optional()
        .transform((value) => value ?? ""),

    name: z
        .string()
        .trim()
        .min(3, "El nombre debe tener mínimo 3 caracteres")
        .max(100, "El nombre es demasiado largo"),

    model: z
        .string()
        .trim()
        .min(2, "El modelo debe tener mínimo 2 caracteres")
        .max(100, "El modelo es demasiado largo"),

    state: z
        .string()
        .min(1, "Debe seleccionar un estado"),

    category: z
        .string()
        .min(1, "Debe seleccionar una categoría"),

    brand: z
        .string()
        .trim()
        .optional(),

    serial: z
        .string()
        .trim()
        .optional()
        .transform((value) => value ?? ""),

    quantity: z
        .string()
        .trim()
        .min(1, "Debe ingresar la cantidad del material")
        .regex(/^\d+$/, "La cantidad debe ser un número entero")
        .refine((value) => Number(value) > 0, {
            message: "La cantidad debe ser mayor a 0",
        }),

    location: z
        .string()
        .trim()
        .optional(),

    unitPrice: z
        .string()
        .trim()
        .min(1, "Debe ingresar el valor unitario")
        .refine(isValidMoney, { message: "El valor unitario debe ser un número válido" })
        .refine((value) => Number(value) > 0, { message: "El valor unitario debe ser mayor a 0" }),

    totalPrice: z
        .string()
        .trim()
        .min(1, "Debe ingresar el valor total")
        .refine(isValidMoney, { message: "El valor total debe ser un número válido" })
        .refine((value) => Number(value) > 0, { message: "El valor total debe ser mayor a 0" }),

    description: z
        .string()
        .trim()
        .min(3, "La descripción debe tener mínimo 3 caracteres")
        .max(255, "La descripción es demasiado larga"),

    purchaseDate: z
        .string()
        .min(1, "Debe ingresar la fecha de compra")
        .refine(isValidDateString, { message: "Debe ingresar una fecha válida" })
        .refine((value) => value <= getTodayDateString(), {
            message: "La fecha de compra no puede ser futura",
        }),

    // Ficha técnica obligatoria en creación (RF RFADMIN08).
    // Formatos: PDF, Excel o PNG. Tamaño máximo 3MB. Mínimo 1 archivo.
    technicalSheet: z
        .array(z.instanceof(File))
        .min(1, "La ficha técnica es obligatoria")
        .refine(
            (files) => files.every((f) => [
                "application/pdf",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "image/png",
            ].includes(f.type)),
            { message: "La ficha técnica debe ser PDF, Excel o PNG" }
        )
        .refine(
            (files) => files.every((f) => f.size <= 3 * 1024 * 1024),
            { message: "Cada archivo no puede superar 3MB" }
        ),

    photo: z.array(z.instanceof(File)).optional(),
    width: z.string().trim().optional(),
    length: z.string().trim().optional(),
    depth: z.string().trim().optional(),
    categoryName: z.string().optional(),
}).superRefine((data, ctx) => {
    const categoryName = String(data.categoryName || "").trim().toLowerCase();
    
    let categoryRules = { requiresSenaPlate: false, requiresId: false, requiresDimensions: false };
    
    if (categoryName === "herramienta") {
        categoryRules = { requiresSenaPlate: false, requiresId: false, requiresDimensions: false };
    } else if (categoryName === "maquinaria y equipos") {
        categoryRules = { requiresSenaPlate: true, requiresId: true, requiresDimensions: false };
    } else if (categoryName === "muebles y enseres") {
        categoryRules = { requiresSenaPlate: true, requiresId: true, requiresDimensions: true };
    }

    if (categoryRules.requiresSenaPlate && !String(data.senaPlate || "").trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["senaPlate"], message: "La placa SENA es obligatoria para esta categoría" });
    }
    if (categoryRules.requiresId && !String(data.serial || "").trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["serial"], message: "El ID es obligatorio para esta categoría" });
    }
    if (categoryRules.requiresDimensions) {
        if (!String(data.width || "").trim() || !String(data.length || "").trim() || !String(data.depth || "").trim()) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["width"], message: "Las dimensiones son obligatorias para esta categoría" });
        }
    }
}).refine(
    (data) => toCents(data.unitPrice) * Number(data.quantity) === toCents(data.totalPrice),
    {
        message: "El valor total debe ser igual a cantidad × valor unitario",
        path: ["totalPrice"],
    }
);


// Schema para EDICION: usa los nombres de campo locales del RmEditView y no
// exige foto ni ficha tecnica (ya existen y solo se reemplazan si se suben).
export const rmEditSchema = z.object({
    name: z
        .string()
        .trim()
        .min(3, "El nombre debe tener mínimo 3 caracteres")
        .max(100, "El nombre es demasiado largo"),

    model: z
        .string()
        .trim()
        .min(2, "El modelo debe tener mínimo 2 caracteres")
        .max(100, "El modelo es demasiado largo"),

    senaPlate: z
        .string()
        .trim()
        .optional()
        .transform((value) => value ?? ""),

    serial: z
        .string()
        .trim()
        .optional()
        .transform((value) => value ?? ""),

    category: z
        .string()
        .min(1, "Debe seleccionar una categoría"),

    brand: z
        .string()
        .trim()
        .optional(),

    description: z
        .string()
        .trim()
        .min(3, "La descripción debe tener mínimo 3 caracteres")
        .max(255, "La descripción es demasiado larga"),

    state: z
        .string()
        .min(1, "Debe seleccionar un estado"),

    quantity: z
        .string()
        .trim()
        .min(1, "Debe ingresar la cantidad del material")
        .regex(/^\d+$/, "La cantidad debe ser un número entero")
        .refine((value) => Number(value) > 0, { message: "La cantidad debe ser mayor a 0" }),

    location: z
        .string()
        .trim()
        .max(100, "La ubicación es demasiado larga")
        .refine((val) => val === "" || val.length >= 3, {
            message: "La ubicación debe tener mínimo 3 caracteres",
        })
        .optional(),

    unitPrice: z
        .string()
        .trim()
        .min(1, "Debe ingresar el valor unitario")
        .refine(isValidMoney, { message: "El valor unitario debe ser un número válido" })
        .refine((value) => Number(value) > 0, { message: "El valor unitario debe ser mayor a 0" }),

    totalPrice: z
        .string()
        .trim()
        .min(1, "Debe ingresar el valor total")
        .refine(isValidMoney, { message: "El valor total debe ser un número válido" })
        .refine((value) => Number(value) > 0, { message: "El valor total debe ser mayor a 0" }),

    purchaseDate: z
        .string()
        .min(1, "Debe ingresar la fecha de compra")
        .refine(isValidDateString, { message: "Debe ingresar una fecha válida" })
        .refine((value) => value <= getTodayDateString(), {
            message: "La fecha de compra no puede ser futura",
        }),
    width: z.string().trim().optional(),
    length: z.string().trim().optional(),
    depth: z.string().trim().optional(),
    categoryName: z.string().optional(),
}).superRefine((data, ctx) => {
    const categoryName = String(data.categoryName || "").trim().toLowerCase();
    
    let categoryRules = { requiresSenaPlate: false, requiresId: false, requiresDimensions: false };
    
    if (categoryName === "herramienta") {
        categoryRules = { requiresSenaPlate: false, requiresId: false, requiresDimensions: false };
    } else if (categoryName === "maquinaria y equipos") {
        categoryRules = { requiresSenaPlate: true, requiresId: true, requiresDimensions: false };
    } else if (categoryName === "muebles y enseres") {
        categoryRules = { requiresSenaPlate: true, requiresId: true, requiresDimensions: true };
    }

    if (categoryRules.requiresSenaPlate && !String(data.senaPlate || "").trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["senaPlate"], message: "La placa SENA es obligatoria para esta categoría" });
    }
    if (categoryRules.requiresId && !String(data.serial || "").trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["serial"], message: "El ID es obligatorio para esta categoría" });
    }
    if (categoryRules.requiresDimensions) {
        if (!String(data.width || "").trim() || !String(data.length || "").trim() || !String(data.depth || "").trim()) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["width"], message: "Las dimensiones son obligatorias para esta categoría" });
        }
    }
}).refine(
    (data) => toCents(data.unitPrice) * Number(data.quantity) === toCents(data.totalPrice),
    {
        message: "El valor total debe ser igual a cantidad × valor unitario",
        path: ["totalPrice"],
    }
);
