import { useEffect, useRef, useState } from "react";

// Progreso narrado para esperas: la espera se percibe más corta si se ve
// avance. Los mensajes describen etapas reales sin prometer fin antes de
// tiempo. Uso:
//   const { busyMessage, startBusyProgress, stopBusyProgress } = useBusyProgress();
//   startBusyProgress(["Guardando…", "Notificando…"]);
//   ... await operacion ...
//   stopBusyProgress();
export function useBusyProgress() {
    const [busyMessage, setBusyMessage] = useState("");
    const timers = useRef([]);

    const stopBusyProgress = () => {
        timers.current.forEach(clearTimeout);
        timers.current = [];
        setBusyMessage("");
    };

    const startBusyProgress = (steps, stepMs = 900) => {
        stopBusyProgress();
        setBusyMessage(steps[0] ?? "");
        steps.slice(1).forEach((message, index) => {
            timers.current.push(setTimeout(
                () => setBusyMessage(message),
                stepMs * (index + 1),
            ));
        });
    };

    useEffect(() => () => stopBusyProgress(), []);

    return { busyMessage, startBusyProgress, stopBusyProgress };
}
