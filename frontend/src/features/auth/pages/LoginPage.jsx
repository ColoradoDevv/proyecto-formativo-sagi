import { AuthLayout } from "@/shared"
import LoginForm from "../components/LoginForm"


export default function LoginPage() {
    return (
        <div className="select-none">
            <AuthLayout>
                <LoginForm />
            </AuthLayout>
        </div>
    )
}
