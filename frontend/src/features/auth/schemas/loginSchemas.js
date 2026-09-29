import { z } from "zod";

export const loginSchemas = z.object({
    userEmail: z
        .string()
        .min(1, "El correo es obligatorio")
        .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Debe ingresar un email válido"),

    userPassword: z
        .string()
        .min(1, "La contraseña es obligatoria"),
});

export const forgotSchemas = z.object({
    userEmail: z
        .string()
        .min(1, "El correo es obligatorio")
        .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Debe ingresar un email válido"),
});

// Nueva contraseña: politica de complejidad (mismo criterio que el backend)
// + confirmacion obligatoria.
export const resetSchemas = z
    .object({
        password: z
            .string()
            .min(10, "Mínimo 10 caracteres")
            .regex(/[A-Z]/, "Debe incluir una mayúscula")
            .regex(/[a-z]/, "Debe incluir una minúscula")
            .regex(/\d/, "Debe incluir un número")
            .regex(/[^A-Za-z0-9]/, "Debe incluir un carácter especial"),

        confirmPassword: z
            .string()
            .min(1, "Debe confirmar la contraseña"),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Las contraseñas no coinciden",
        path: ["confirmPassword"],
    });