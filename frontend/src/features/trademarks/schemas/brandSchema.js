import { z } from "zod";

const nameRegex = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .-]+$/;

export const brandSchema = z.object({
    brandName: z
        .string()
        .trim()
        .min(2, "El nombre debe tener mínimo 2 caracteres")
        .max(100, "El nombre es demasiado largo")
        .regex(nameRegex, "Solo se letras, números, espacios, puntos y guiones."),
});
