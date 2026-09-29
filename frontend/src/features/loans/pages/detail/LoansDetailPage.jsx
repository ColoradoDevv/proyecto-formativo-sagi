import { useParams } from "react-router-dom";
import LoanDetailView from "../../components/detail/LoanDetailView";
import BatchDetailView from "../../components/detail/BatchDetailView";

// Dos rutas comparten esta página:
//   /prestamos/visualizar/:id  → detalle de UN préstamo (id_loan)
//   /prestamos/lote/:batchId   → detalle del LOTE (batch_id)
export default function LoansDetailPage() {
    const { batchId } = useParams();
    if (batchId) return <BatchDetailView />;
    return <LoanDetailView />;
}
