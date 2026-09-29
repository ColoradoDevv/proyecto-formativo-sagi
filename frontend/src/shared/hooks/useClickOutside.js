import { useEffect } from "react";

// useClickOutside
// Cierra algo (panel, dropdown, popover) cuando el usuario hace click fuera
// de los elementos dados o presiona Escape.
//
// Args:
//   - containerRef: React ref al contenedor principal del popover.
//   - contentRef:   React ref opcional al contenido flotante (portal). Si
//                   el popover renderiza el contenido en otro nodo del DOM,
//                   pasalo aqui para que los clicks sobre el tampoco cierren.
//   - isActive:     boolean. Si es false, no se montan listeners (util
//                   cuando el popover esta cerrado y queremos evitar ruido).
//   - onClose:      callback invocado cuando se detecta "click fuera" o Escape.
//
// Notas:
//   - No se hace nada si `onClose` no esta definido (modo "dry").
//   - Se usa el evento "click" en document. Si en el futuro hace falta
//     soportar pointerdown para una UX mas robusta, se puede cambiar.
export function useClickOutside({ containerRef, contentRef, isActive = true, onClose }) {
    useEffect(() => {
        if (!isActive || typeof onClose !== "function") return;

        const handleClick = (event) => {
            const insideContainer = containerRef?.current?.contains(event.target);
            const insideContent   = contentRef?.current?.contains(event.target);
            if (!insideContainer && !insideContent) onClose();
        };

        const handleKey = (event) => {
            if (event.key === "Escape") onClose();
        };

        document.addEventListener("click", handleClick);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("click", handleClick);
            document.removeEventListener("keydown", handleKey);
        };
    }, [containerRef, contentRef, isActive, onClose]);
}
