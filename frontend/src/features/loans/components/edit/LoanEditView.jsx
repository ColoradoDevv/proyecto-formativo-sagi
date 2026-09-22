import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, IconButton, showAlert, cancelAlert } from "@/shared";
import { Undo2 } from "lucide-react";
import useLoan from "../../hooks/useLoan";
import { getUsers, getMaterials } from "../../services/selectServices";
import loanSchema from "../../schemas/loanSchema";
import { updateLoan } from "../../services/loanService";
import LoanForm from "../LoanForm";
import { TailChase } from "ldrs/react";
import "ldrs/react/TailChase.css";

// Clasificación fija de 2 valores — no requiere un endpoint propio.
const LOAN_TYPE_OPTIONS = [
    { id: "Interno", label: "Interno" },
    { id: "Externo", label: "Externo" },
];

// Componente externo: maneja el fetch, loading y error
export default function LoanEditView() {
    const { id } = useParams();
    const { loan, loading, error } = useLoan(id);

    const [users,     setUsers]     = useState([]);
    const [materials, setMaterials] = useState([]);

    useEffect(() => { getUsers().then(setUsers);         }, []);
    useEffect(() => { getMaterials().then(setMaterials); }, []);

    if (loading)
        return (
            <div className="h-full flex items-center justify-center">
                <TailChase size="40" speed="1.75" color="var(--semantic-text-primary)" />
            </div>
        );

    if (error) return <p>Error al cargar préstamo: {error.message}</p>;

    return <LoanEditForm loan={loan} users={users} materials={materials} />;
}

// Componente interno: recibe el prestamo ya cargado e inicializa el estado directamente
function LoanEditForm({ loan, users, materials }) {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        loanResponsableUser: loan.id_responsable_user != null ? String(loan.id_responsable_user) : "",
        loanReceptorUser:    loan.id_receptor_user     != null ? String(loan.id_receptor_user)    : "",
        loanMaterial:        loan.id_material          != null ? String(loan.id_material)         : "",
        loanAmount:          loan.amount_lent          != null ? String(loan.amount_lent)          : "",
        loanGroup:           loan.apprentice_group  ?? "",
        loanType:            loan.loan_type ?? "",
        loanJustification:   loan.justification_use ?? "",
        loanReturnDate:      loan.return_date        ?? "",
        // El receptor no se puede reasignar aquí (readonlyUsers más abajo,
        // y loanSchema se llama con skipReceptorValidation) — estos valores
        // solo importan para que LoanForm sepa que no debe pedir el checkbox.
        receptorIsRegistered: loan.id_receptor_user != null,
        receptorName:        "",
        receptorEmail:       "",
    });

    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    async function handleSubmit(e) {
        e.preventDefault();

        const schema = loanSchema(materials, { skipReceptorValidation: true });
        const result = schema.safeParse(formData);

        if (!result.success) {
            const fieldErrors = {};
            result.error.issues.forEach((issue) => {
                fieldErrors[issue.path[0]] = issue.message;
            });
            setErrors(fieldErrors);
            return;
        }

        setErrors({});
        setSubmitting(true);

        try {
            await updateLoan(loan.id_loan, result.data);
            await showAlert({ icon: "success", iconColor: "var(--color-success)", title: "Préstamo actualizado exitosamente" });
            navigate("/prestamos");
        } catch (err) {
            if (err.fieldErrors) setErrors((prev) => ({ ...prev, ...err.fieldErrors }));
            showAlert({ icon: "error", iconColor: "var(--color-error)", title: "Error al actualizar el préstamo", text: err.message });
        } finally {
            setSubmitting(false);
        }
    }

    async function handleCancel() {
        const result = await cancelAlert();
        if (result.isConfirmed) navigate(-1);
    }

    return (
        <div className="h-full text-text-primary flex flex-col gap-3">

            {/* Encabezado */}
            <div className="flex items-center gap-3">
                <IconButton onClick={() => navigate(-1)} variant="ghost">
                    <Undo2 size={18}/>
                </IconButton>
                <div>
                    <h2 className="text-h2 text-text-primary font-heading">Editar Préstamo</h2>
                </div>
            </div>

            <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">

                <LoanForm
                    formData={formData}
                    errors={errors}
                    onChange={handleChange}
                    users={users}
                    materials={materials}
                    loan_type={LOAN_TYPE_OPTIONS}
                    loanDepartureDate={loan.loan_date ?? ""}
                    readonlyUsers
                    receptorDisplayName={loan.usuario_receptor}
                />

                <div className="flex gap-4 justify-center md:justify-end">
                    <Button type="button" variant="secondary" size="md" onClick={handleCancel} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" variant="primary" size="md" disabled={submitting}>
                        {submitting ? "Guardando..." : "Guardar cambios"}
                    </Button>
                </div>

            </form>

        </div>
    );
}
