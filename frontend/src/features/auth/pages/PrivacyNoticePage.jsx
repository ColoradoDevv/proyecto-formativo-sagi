import { Link } from "react-router-dom";
import { ShieldCheck, Undo2 } from "lucide-react";
import { IconButton } from "@/shared";

const HABEAS_DATA_URL = "https://www.sena.edu.co/es-co/transparencia/Paginas/habeas_data.aspx";

// Aviso de privacidad de SAGI (Ley 1581 de 2012, Decreto 1377 de 2013).
// Ruta pública: cualquier persona puede leerlo antes de entregar sus datos.
export default function PrivacyNoticePage() {
    return (
        <div className="min-h-screen flex items-start sm:items-center justify-center bg-surface p-4 py-10">
            <div className="bg-surface-hover rounded-[var(--radius-3xl)] shadow-[var(--shadow-elevation-5)] px-6 sm:px-10 py-8 w-full max-w-2xl flex flex-col gap-4 animate-slide-up">
                <div className="flex items-center gap-3">
                    <Link to="/iniciar-sesion" aria-label="Volver al inicio de sesión">
                        <IconButton variant="ghost">
                            <Undo2 size={20} />
                        </IconButton>
                    </Link>
                    <h1 className="text-h2 font-heading text-text-primary flex items-center gap-2">
                        <ShieldCheck size={22} className="text-brand shrink-0" />
                        Aviso de privacidad
                    </h1>
                </div>

                <div className="flex flex-col gap-3 text-small text-text-secondary leading-relaxed">
                    <p>
                        El <strong className="text-text-primary">Servicio Nacional de Aprendizaje – SENA</strong>,
                        a través del SAGI (Sistema Administrativo de Gestión de Inventarios), es responsable del tratamiento de
                        tus datos personales, en cumplimiento de la <strong className="text-text-primary">Ley 1581
                        de 2012</strong>, el Decreto 1377 de 2013 y demás normas vigentes a 2026 sobre protección
                        de datos personales.
                    </p>

                    <section className="flex flex-col gap-1">
                        <h2 className="text-body font-medium text-text-primary">Datos que recolectamos</h2>
                        <p>
                            Identificación y contacto: nombres, apellidos, tipo y número de documento, correos
                            (personal e institucional), teléfonos, dirección y foto de perfil. En préstamos con
                            receptor no registrado: nombre y correo del receptor, únicamente para gestionar la
                            firma del préstamo.
                        </p>
                    </section>

                    <section className="flex flex-col gap-1">
                        <h2 className="text-body font-medium text-text-primary">Finalidades</h2>
                        <p>
                            Gestionar usuarios, préstamos y devoluciones de materiales; autenticación y seguridad
                            de la cuenta; envío de notificaciones operativas (códigos de firma, credenciales);
                            auditoría y trazabilidad exigida a la entidad.
                        </p>
                    </section>

                    <section className="flex flex-col gap-1">
                        <h2 className="text-body font-medium text-text-primary">Tus derechos</h2>
                        <p>
                            Como titular puedes conocer, actualizar, rectificar y suprimir tus datos, y revocar
                            esta autorización en cualquier momento. Para ejercerlos escribe al administrador del
                            sistema de tu centro de formación o consulta el manual de habeas data del SENA:{" "}
                            <a
                                href={HABEAS_DATA_URL}
                                target="_blank"
                                rel="noreferrer"
                                className="text-brand underline underline-offset-2 hover:opacity-80"
                            >
                                sena.edu.co — habeas data
                            </a>
                            .
                        </p>
                    </section>

                    <section className="flex flex-col gap-1">
                        <h2 className="text-body font-medium text-text-primary">Conservación y seguridad</h2>
                        <p>
                            Tus datos se conservan solo el tiempo necesario para las finalidades descritas y las
                            obligaciones legales de la entidad, protegidos con controles de acceso, cifrado de
                            contraseñas y registro de auditoría. No se comparten con terceros con fines
                            comerciales.
                        </p>
                    </section>
                </div>

                <p className="text-small text-text-muted text-center">
                    Al crear tu cuenta o firmar un préstamo aceptas este aviso mediante la casilla
                    de autorización correspondiente.
                </p>
            </div>
        </div>
    );
}
