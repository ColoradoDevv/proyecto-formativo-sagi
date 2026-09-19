import { z } from "zod";

function isValidMoney(value) {
    return /^\d+(\.\d{1,2})?$/.test(value);
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


// Schema para CREACION. Usa la MISMA convencion de nombres que ConsumableForm
// (name, senaPlate, brand, ...) para poder reutilizar el formulario.
export const cmBaseSchema = z.object({
    name: z
        .string()
        .trim()
        .min(3, "El nombre debe tener minimo 3 caracteres")
        .max(100, "El nombre es demasiado largo"),

    description: z
        .string()
        .trim()
        .min(10, "La descripcion debe tener minimo 10 caracteres")
        .max(255, "La descripcion es demasiado larga"),

    senaPlate: z
        .string()
        .trim()
        .max(20, "La placa SENA es demasiado larga")
        .refine(val => val === "" || val.length >= 3, {
            message: "La placa SENA debe tener minimo 3 caracteres"
        })
        .optional(),

    serial: z
        .string()
        .trim()
        .max(20, "El numero de serial es demasiado larga")
        .refine(val => val === "" || val.length >= 3, {
            message: "El numero de serial debe tener minimo 3 caracteres"
        })
        .optional(),

    quantity: z
        .string()
        .trim()
        .optional(),

    location: z
        .string()
        .trim()
        .max(100, "La ubicacion es demasiado larga")
        .refine(val => val === "" || val.length >= 3, {
            message: "La ubicacion debe tener minimo 3 caracteres"
        })
        .optional(),

    brand: z
        .string()
        .trim()
        .optional(),

    state: z
        .string()
        .min(1, "Debe seleccionar un estado"),

    unitPrice: z
        .string()
        .trim()
        .min(1, "Debe ingresar el valor unitario")
        .refine(isValidMoney, {
            message: "El valor unitario debe ser un numero valido",
        })
        .refine((value) => Number(value) > 0, {
            message: "El valor unitario debe ser mayor a 0",
        }),

    totalPrice: z
        .string()
        .trim()
        .min(1, "Debe ingresar el valor total")
        .refine(isValidMoney, {
            message: "El valor total debe ser un numero valido",
        })
        .refine((value) => Number(value) > 0, {
            message: "El valor total debe ser mayor a 0",
        }),

    user: z
        .string()
        .min(1, "Debe seleccionar un cuentadante"),

    purchaseDate: z
        .string()
        .min(1, "Debe ingresar la fecha de compra")
        .refine(isValidDateString, { message: "Debe ingresar una fecha válida" })
        .refine((value) => value <= getTodayDateString(), {
            message: "La fecha de compra no puede ser futura",
        }),


    photo: z
        .array(z.instanceof(File))
        .min(1, "Debe subir una imagen")
        .refine(
            (files) => ["image/jpeg", "image/png", "image/svg+xml"].includes(files[0]?.type),
            { message: "La imagen debe ser JPG, PNG o SVG" }
        )
        .refine(
            (files) => files[0]?.size <= 2 * 1024 * 1024,
            { message: "La imagen no puede superar 2MB" }
        ),

    // Ficha técnica: opcional. Si se sube, se valida formato (PDF, Excel, PNG)
    // y tamaño máximo 3MB según RF RFADMIN14.
    technicalSheet: z
        .array(z.instanceof(File))
        .min(1, "Debe subir la ficha técnica")
        .refine(
            (files) => [
                "application/pdf",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "image/png",
            ].includes(files[0]?.type),
            { message: "La ficha técnica debe ser PDF, Excel o PNG" }
        )
        .refine(
            (files) => files[0]?.size <= 3 * 1024 * 1024,
            { message: "La ficha técnica no puede superar 3MB" }
        )
        .min(1, "Debe subir la ficha técnica"),
});

export const cmSchema = cmBaseSchema.superRefine((data, ctx) => {

    const hasSenaPlate = data.senaPlate && data.senaPlate.trim() !== "";

    if (hasSenaPlate) {
        // Si hay placa SENA, la cantidad debe ser exactamente 1
        if (data.quantity !== "1") {
            ctx.addIssue({
                path: ["quantity"],
                message: "La cantidad debe ser 1 cuando el material tiene placa SENA",
                code: z.ZodIssueCode.custom,
            });
            return;
        }
    } else {
        // Cantidad obligatoria si no hay placa SENA
        if (!data.quantity || data.quantity.trim() === "") {
            ctx.addIssue({
                path: ["quantity"],
                message: "La cantidad es obligatoria si no hay placa SENA",
                code: z.ZodIssueCode.custom,
            });
            return; // no seguir validando si falta la cantidad
        }
        if (Number(data.quantity) <= 0) {
            ctx.addIssue({
                path: ["quantity"],
                message: "La cantidad debe ser mayor a 0",
                code: z.ZodIssueCode.custom,
            });
        }
    }
});


// Schema para EDICION: usa los nombres de campo locales del CmEditView y no
// exige foto (la imagen ya existe y solo se reemplaza si el usuario sube otra).
export const cmEditSchema = z.object({
    name: z
        .string()
        .trim()
        .min(3, "El nombre debe tener minimo 3 caracteres")
        .max(100, "El nombre es demasiado largo"),

    description: z
        .string()
        .trim()
        .min(10, "La descripcion debe tener minimo 10 caracteres")
        .max(255, "La descripcion es demasiado larga"),

    senaPlate: z
        .string()
        .trim()
        .max(20, "La placa SENA es demasiado larga")
        .refine((val) => val === "" || val.length >= 3, {
            message: "La placa SENA debe tener minimo 3 caracteres",
        })
        .optional(),

    serial: z
        .string()
        .trim()
        .max(20, "El numero de serial es demasiado larga")
        .refine(val => val === "" || val.length >= 3, {
            message: "El numero de serial debe tener minimo 3 caracteres"
        })
        .optional(),

    quantity: z
        .string()
        .trim()
        .optional(),

    location: z
        .string()
        .trim()
        .max(100, "La ubicacion es demasiado larga")
        .refine((val) => val === "" || val.length >= 3, {
            message: "La ubicacion debe tener minimo 3 caracteres",
        })
        .optional(),

    brand: z
        .string()
        .optional(),

    state: z
        .string()
        .min(1, "Debe seleccionar un estado"),

    unitPrice: z
        .string()
        .trim()
        .min(1, "Debe ingresar el valor unitario")
        .refine(isValidMoney, { message: "El valor unitario debe ser un numero valido" })
        .refine((value) => Number(value) > 0, { message: "El valor unitario debe ser mayor a 0" }),

    totalPrice: z
        .string()
        .trim()
        .min(1, "Debe ingresar el valor total")
        .refine(isValidMoney, { message: "El valor total debe ser un numero valido" })
        .refine((value) => Number(value) > 0, { message: "El valor total debe ser mayor a 0" }),

    user: z
        .string()
        .min(1, "Debe seleccionar un cuentadante"),

    purchaseDate: z
        .string()
        .min(1, "Debe ingresar la fecha de compra")
        .refine(isValidDateString, { message: "Debe ingresar una fecha válida" })
        .refine((value) => value <= getTodayDateString(), {
            message: "La fecha de compra no puede ser futura",
        }),

    // Ficha técnica: opcional en edición (solo se reemplaza si el usuario sube una nueva).
    technicalSheet: z
        .instanceof(File)
        .refine(
            (file) => [
                "application/pdf",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "image/png",
            ].includes(file?.type),
            { message: "La ficha técnica debe ser PDF, Excel o PNG" }
        )
        .refine(
            (file) => file?.size <= 3 * 1024 * 1024,
            { message: "La ficha técnica no puede superar 3MB" }
        )
        .optional()
        .nullable(),
}).superRefine((data, ctx) => {
    const hasSenaPlate = data.senaPlate && data.senaPlate.trim() !== "";

    if (hasSenaPlate) {
        if (data.quantity !== "1") {
            ctx.addIssue({
                path: ["quantity"],
                message: "La cantidad debe ser 1 cuando el material tiene placa SENA",
                code: z.ZodIssueCode.custom,
            });
        }
        return;
    }

    if (!data.quantity || data.quantity.trim() === "") {
        ctx.addIssue({
            path: ["quantity"],
            message: "La cantidad es obligatoria si no hay placa SENA",
            code: z.ZodIssueCode.custom,
        });
        return;
    }
    if (Number(data.quantity) <= 0) {
        ctx.addIssue({
            path: ["quantity"],
            message: "La cantidad debe ser mayor a 0",
            code: z.ZodIssueCode.custom,
        });
    }
});
