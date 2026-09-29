import { z } from "zod";

const nameRegex = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .-]+$/;

export const inventorySchema = z.object({
    inventoryName: z
        .string()
        .trim()
        .min(2, "El nombre debe tener mínimo 2 caracteres")
        .max(100, "El nombre es demasiado largo")
        .regex(nameRegex, "Solo se permiten letras, números, espacios, puntos y guiones."),

    inventoryDescription: z
        .string()
        .trim()
        .max(255, "La descripción es demasiado larga")
        .optional()
        .transform((value) => value ?? ""),
});
