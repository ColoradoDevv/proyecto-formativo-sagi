import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { Button, showAlert } from "@/shared";

// Panel de códigos de recuperación: qué son, por qué guardarlos,
// copiarlos todos y descargarlos en .txt. Se muestran una sola vez.
export default function RecoveryCodesPanel({ codes }) {
    const [copied, setCopied] = useState(false);

    const text = (codes ?? []).join("\n");

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            await showAlert({
                icon: "error",
                iconColor: "var(--color-error)",
                title: "No se pudo copiar",
                text: "Selecciónalos manualmente y cópialos.",
            });
        }
    };

    const handleDownload = () => {
        const header = [
            "SAGI - Códigos de recuperación",
            "Guárdalos en un lugar seguro (gestor de contraseñas o papel).",
            "Cada código sirve UNA sola vez y no se muestran de nuevo.",
            "Úsalos para entrar si pierdes tu celular o cambias de aplicación.",
            "",
        ].join("\n");
        const blob = new Blob([header + text + "\n"], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "sagi-codigos-recuperacion.txt";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    };

    return (
        <div className="flex flex-col gap-3">
            <p className="text-small text-text-muted text-center">
                Son tu llave de repuesto: si pierdes tu celular o cambias de
                aplicación autenticadora, ingresa uno de estos códigos en lugar
                del código de 6 dígitos. Cada uno sirve una sola vez y no se
                muestran de nuevo.
            </p>

            <ul className="grid grid-cols-1 gap-1.5 rounded-xl border border-border bg-surface p-4 font-mono text-medium text-center">
                {(codes ?? []).map((code) => (
                    <li key={code} className="tracking-[0.2em]">{code}</li>
                ))}
            </ul>

            <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={handleCopy} className="flex-1" icon={copied ? Check : Copy}>
                    {copied ? "¡Copiados!" : "Copiar"}
                </Button>
                <Button type="button" variant="secondary" onClick={handleDownload} className="flex-1" icon={Download}>
                    Descargar
                </Button>
            </div>
        </div>
    );
}
