import { z } from "zod";

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

// Antes era un objeto estatico `loanSchema`; ahora es una funcion porque la
// validacion de cantidad depende del stock disponible de cada material,
// que solo se conoce en tiempo de ejecucion (viene de `materials`).
export default function loanSchema(materials = [], { multipleMaterials = false, skipReceptorValidation = false } = {}) {
    const amountSchema = z
        .string()
        .trim()
        .min(1, "Debe ingresar la cantidad del préstamo")
        .regex(/^\d+$/, "La cantidad debe ser un numero entero")
        .refine((value) => Number(value) > 0, {
            message: "La cantidad debe ser mayor a 0",
        })
        .refine((value) => Number(value) <= 999999, {
            message: "La cantidad no puede superar 999999",
        });

    return z.object({
        loanResponsableUser: z
            .string()
            .min(1, "Debe seleccionar un usuario responsable"),

        // Requerido solo cuando el receptor está registrado — ver superRefine.
        loanReceptorUser: z.string().optional().default(""),
        // Checkbox "¿El receptor está registrado en el sistema?" — cuando es
        // false, se exige receptorName/receptorEmail en su lugar.
        receptorIsRegistered: z.boolean().default(true),
        receptorName: z.string().optional().default(""),
        receptorEmail: z.string().optional().default(""),

        loanMaterial: multipleMaterials
            ? z.array(z.string()).min(1, "Debe seleccionar al menos un material")
            : z.string().min(1, "Debe seleccionar un material"),

        ...(multipleMaterials
            ? { loanMaterialQuantities: z.record(z.string(), amountSchema) }
            : { loanAmount: amountSchema }),

        loanGroup: z
            .string()
            .trim()
            .min(1, "Debe ingresar el grupo")
            .regex(/^\d+$/, "El grupo debe contener solo numeros")
            .max(10, "El grupo no puede tener mas de 10 caracteres")
            .optional(),

        loanType: z
            .string()
            .min(1, "Debe seleccionar el tipo de préstamo")
            .refine((val) => ["Interno", "Externo"].includes(val), {
                message: "El tipo de préstamo debe ser Interno o Externo",
            }),

        loanJustification: z
            .string()
            .trim()
            .min(10, "La justificacion debe tener minimo 10 caracteres")
            .max(255, "La justificacion es demasiado larga"),

        loanReturnDate: z
            .string()
            .min(1, "Debe ingresar la fecha de devolucion")
            .refine(isValidDateString, { message: "Debe ingresar una fecha válida" })
            .refine((value) => value >= getTodayDateString(), {
                message: "La fecha de devolucion no puede ser anterior a hoy",
            }),
    }).superRefine((data, ctx) => {
        // En edición, el receptor es de solo lectura (no se puede reasignar
        // ni cambiar su tipo registrado/externo desde este formulario) —
        // no tiene sentido volver a exigir estos campos ahí.
        if (!skipReceptorValidation) {
        if (data.receptorIsRegistered) {
            if (!data.loanReceptorUser) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["loanReceptorUser"],
                    message: "Debe seleccionar un usuario receptor",
                });
            }
        } else {
            if (!data.receptorName.trim()) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["receptorName"],
                    message: "Debe ingresar el nombre del receptor",
                });
            }
            if (!z.string().email().safeParse(data.receptorEmail).success) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["receptorEmail"],
                    message: "Debe ingresar un correo electrónico válido",
                });
            }
        }
        }

        const selectedMaterialIds = Array.isArray(data.loanMaterial)
            ? data.loanMaterial
            : [data.loanMaterial];

        const insufficientMaterial = selectedMaterialIds
            .map((id) => materials.find((material) => String(material.id) === String(id)))
            .find((material) => {
                const amount = multipleMaterials
                    ? data.loanMaterialQuantities[String(material?.id)]
                    : data.loanAmount;
                return material?.available_quantity != null && Number(amount) > material.available_quantity;
            });

        if (insufficientMaterial) {
            const path = multipleMaterials
                ? ["loanMaterialQuantities", String(insufficientMaterial.id)]
                : ["loanAmount"];
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path,
                message: `Solo hay ${insufficientMaterial.available_quantity} unidades disponibles de este material.`,
            });
        }
    });
}
