import { z } from "zod";

const VALID_CONDITIONS = ["Bueno", "Mantenimiento", "Baja"];

const materialCondition = z.enum(["Bueno", "Mantenimiento", "Baja"], {
    errorMap: () => ({ message: "Selecciona la condición del material" }),
});

// Schema de devolucion. Depende del tipo de material y de la cantidad prestada:
// - consumo: cantidad sobrante obligatoria (0 ≤ sobrante ≤ prestado) + condición.
// - devolutivo: cantidad devuelta obligatoria + condición.
export function buildReturnSchema({ materialType, amountLent }) {
    const observations = z
        .string()
        .trim()
        .max(255, "Las observaciones son demasiado largas")
        .optional();

    if (materialType === "consumo") {
        return z.object({
            observations,
            materialCondition,
            leftoverQuantity: z
                .string()
                .trim()
                .min(1, "Debe ingresar la cantidad sobrante")
                .regex(/^\d+$/, "La cantidad debe ser un número entero")
                .refine((v) => Number(v) <= amountLent, {
                    message: `La cantidad sobrante no puede superar la prestada (${amountLent})`,
                }),
        });
    }

    // Devolutivo: se registra la cantidad devuelta (1 ≤ x ≤ prestada).
    // Si es menor a la prestada, el préstamo quedará "Incompleto".
    return z.object({
        observations,
        materialCondition,
        returnedQuantity: z
            .string()
            .trim()
            .min(1, "Debe ingresar la cantidad devuelta")
            .regex(/^\d+$/, "La cantidad debe ser un número entero")
            .refine((v) => Number(v) >= 1, {
                message: "La cantidad devuelta debe ser al menos 1",
            })
            .refine((v) => Number(v) <= amountLent, {
                message: `La cantidad devuelta no puede superar la prestada (${amountLent})`,
            }),
    });
}

export { VALID_CONDITIONS };
