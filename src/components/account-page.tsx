import { KeyRound } from "lucide-react";
import { changePasswordAction } from "@/app/actions/session";
import { PASSWORD_MIN } from "@/lib/constants";
import { PageHeader } from "./ui";
import { PasswordForm } from "./password-form";

/** Page « Mon compte » commune à l'admin et aux créateurs. */
export function AccountPage({ email }: { email: string }) {
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Mon compte" subtitle={`Connecté en tant que ${email}`} />
      <div className="card p-6">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <KeyRound size={20} aria-hidden /> Changer mon mot de passe
        </h2>
        <p className="mb-5 text-sm text-muted">Vos autres appareils seront déconnectés.</p>
        <PasswordForm action={changePasswordAction} min={PASSWORD_MIN} />
      </div>
    </div>
  );
}
