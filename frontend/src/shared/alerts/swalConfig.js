import Swal from "sweetalert2";
import "./swal.css";

// Mixin base: desactiva el estilo por defecto de SweetAlert2 y aplica
// las clases del sistema de diseño para que todas las alertas (success,
// error, warning, confirm, etc.) se vean consistentes entre sí.
export const swalBase = Swal.mixin({
    reverseButtons: true,
    customClass: {
        popup: "!rounded-[var(--radius-3xl)] !shadow-[var(--shadow-elevation-5)] !p-6 !bg-surface-hover/90 !backdrop-blur-2xl !border !border-surface-hover/50",
        title: "!text-h3 !font-heading !text-text-primary",
        htmlContainer: "!text-small !text-text-secondary",
        icon: "!border-0",
        actions: "!w-full !gap-3",
    },
});
