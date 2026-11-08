import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion — Boutique" };

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const contact = process.env.CONTACT_EMAIL?.trim();
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
        <div className="text-center">
          <span className="logo text-4xl">BOUTIQUE</span>
          <p className="mt-6 text-muted">Connectez-vous à votre espace</p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-muted">
          Mot de passe oublié ? Contactez la boutique
          {contact ? (
            <>
              {" "}
              à{" "}
              <a className="underline" href={`mailto:${contact}`}>
                {contact}
              </a>
            </>
          ) : null}{" "}
          pour recevoir un nouveau mot de passe.
        </p>
      </div>
    </main>
  );
}
