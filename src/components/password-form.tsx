"use client";

import { ActionForm, SubmitButton, type FormAction } from "./action-form";

export function PasswordForm({ action, min }: { action: FormAction; min: number }) {
  return (
    <ActionForm action={action} resetOnSuccess className="space-y-5">
      <div>
        <label className="label" htmlFor="current">
          Mot de passe actuel
        </label>
        <input id="current" name="current" type="password" required autoComplete="current-password" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Nouveau mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={min}
          maxLength={200}
          autoComplete="new-password"
          className="input"
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="mt-1 text-xs text-muted">
          {min} caractères minimum. Une phrase de passe (plusieurs mots) est facile à retenir et difficile à deviner.
        </p>
      </div>
      <div>
        <label className="label" htmlFor="confirm">
          Confirmer le nouveau mot de passe
        </label>
        <input id="confirm" name="confirm" type="password" required minLength={min} maxLength={200} autoComplete="new-password" className="input" />
      </div>
      <SubmitButton className="w-full" pendingLabel="Enregistrement…">
        Changer le mot de passe
      </SubmitButton>
    </ActionForm>
  );
}
