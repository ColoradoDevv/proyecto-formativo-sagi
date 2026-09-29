// jsPDF dibuja en un canvas/PDF binario, fuera del DOM, así que no puede leer
// las variables CSS del proyecto (styles/tokens.css, semantic.css). Estos
// arreglos RGB son la única forma de pasarle color, por eso viven en un único
// módulo compartido: mantenerlos alineados a mano con los tokens de la UI
// evita que ambos generadores de PDF terminen con tonos ligeramente distintos.
export const PDF_COLORS = {
    navy:      [12,  45,  72],   // --color-secondary-950 / text-primary
    steel:     [32,  63,  87],   // --color-secondary-900 / brand
    muted:     [82, 107, 123],   // --color-secondary-700 / text-secondary
    stripe:    [240, 245, 238],  // --color-secondary-100 / background (fila alterna)
    lightGray: [202, 213, 211],  // --color-secondary-300 / border (línea separadora)
    white:     [255, 255, 255],
};
