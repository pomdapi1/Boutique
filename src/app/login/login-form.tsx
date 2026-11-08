"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { loginAction } from "../actions/session";

export function LoginForm() {
  const [show, setShow] = useState(false);
  return (
    <ActionForm action={loginAction} className="mt-6 space-y-5">
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required placeholder="votre@email.com" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Mot de passe
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            className="input pr-12"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute top-1/2 right-4 -translate-y-1/2 text-muted"
            aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      <SubmitButton className="w-full py-3.5 text-base" pendingLabel="Connexion…">
        Se connecter
      </SubmitButton>
    </ActionForm>
  );
}
