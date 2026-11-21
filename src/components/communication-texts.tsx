"use client";

import { useState } from "react";
import { ActionForm, SubmitButton, type FormAction } from "./action-form";
import { cn } from "@/lib/utils";

/** Même règle de comptage que le serveur (src/lib/text.ts) : un emoji = 1 caractère. */
function count(s: string) {
  return Array.from(s.replace(/\r\n?/g, "\n").trim()).length;
}

function CountedTextarea({
  id,
  name,
  label,
  max,
  rows,
  defaultValue,
  placeholder,
}: {
  id: string;
  name: string;
  label: string;
  max: number;
  rows: number;
  defaultValue: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const n = count(value);
  const over = n > max;
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        aria-describedby={`${id}-count`}
        aria-invalid={over}
        className={cn("input resize-y leading-relaxed", over && "border-danger-500 focus:border-danger-500 focus:ring-danger-100")}
      />
      <p id={`${id}-count`} aria-live="polite" className={cn("mt-1 text-right text-xs", over ? "font-semibold text-danger-600" : "text-muted")}>
        {n}/{max}
      </p>
    </div>
  );
}

export function CommunicationTexts({
  action,
  brandPitch,
  salesNotes,
  pitchMax,
  notesMax,
}: {
  action: FormAction;
  brandPitch: string;
  salesNotes: string;
  pitchMax: number;
  notesMax: number;
}) {
  return (
    <ActionForm action={action} className="space-y-6">
      <CountedTextarea
        id="brandPitch"
        name="brandPitch"
        label="Présentation courte de votre marque pour notre communication"
        max={pitchMax}
        rows={3}
        defaultValue={brandPitch}
        placeholder="Qui êtes-vous, que créez-vous, qu'est-ce qui rend vos créations uniques ?"
      />
      <CountedTextarea
        id="salesNotes"
        name="salesNotes"
        label="Recommandations, spécificités des produits, conseils de ventes et tout ce qui est bon à savoir pour les personnes en permanences"
        max={notesMax}
        rows={7}
        defaultValue={salesNotes}
        placeholder="Matières, entretien, tailles, fragilité, arguments de vente…"
      />
      <SubmitButton pendingLabel="Enregistrement…">Enregistrer les textes</SubmitButton>
    </ActionForm>
  );
}
