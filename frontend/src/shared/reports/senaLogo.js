import logoVerdeUrl from "@/assets/images/sena/logo-sena-verde-500.png";
import logoBlancoUrl from "@/assets/images/sena/logo-sena-blanco-500.png";

// Logosímbolo oficial del SENA (vector de sena.edu.co, versión monocromática
// corporativa) como dataURL para incrustar en PDFs con jsPDF.
// Se cachea en memoria: el fetch al asset empaquetado solo ocurre una vez.
const cache = {};

async function _toDataUrl(url) {
    if (cache[url]) return cache[url];
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
        if (dataUrl) cache[url] = dataUrl;
        return dataUrl;
    } catch {
        return null;
    }
}

/** Logo verde (fondos claros). Devuelve dataURL PNG o null si falla. */
export function getSenaLogoVerde() {
    return _toDataUrl(logoVerdeUrl);
}

/** Logo blanco (fondos oscuros, ej. banda azul del reporte). */
export function getSenaLogoBlanco() {
    return _toDataUrl(logoBlancoUrl);
}
