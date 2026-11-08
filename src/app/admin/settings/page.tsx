import { prisma } from "@/lib/db";
import { SETTING_KEYS, getCardFeeRate, getDefaultCommissionRate, getSetting, sumupConfig } from "@/lib/settings";
import { relativeLabel } from "@/lib/dates";
import { PageHeader, Pill } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { syncNowAction, testSumUpAction, updateSettingsAction } from "@/app/actions/admin";

export default async function SettingsPage() {
  const cfg = sumupConfig();
  const [defaultRate, feeRate, lastRun, lastSync, lastError, lastResult, sumupSales] = await Promise.all([
    getDefaultCommissionRate(),
    getCardFeeRate(),
    getSetting(SETTING_KEYS.sumupLastRunAt),
    getSetting(SETTING_KEYS.sumupLastSyncAt),
    getSetting(SETTING_KEYS.sumupLastError),
    getSetting(SETTING_KEYS.sumupLastResult),
    prisma.sale.count({ where: { source: "SUMUP" } }),
  ]);
  const result = lastResult ? (JSON.parse(lastResult) as { fetched: number; created: number; refunded: number }) : null;
  const mask = (s: string) => (s ? `${s.slice(0, 6)}…${s.slice(-4)}` : "non défini");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Paramètres & SumUp" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold">Connexion SumUp</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">Mode</dt>
            <dd>
              {cfg.mode === "live" ? <Pill tone="green">Live</Pill> : cfg.mode === "mock" ? <Pill tone="amber">Simulation</Pill> : <Pill>Désactivé</Pill>}
            </dd>
            <dt className="text-muted">Clé API</dt>
            <dd className="font-mono">{mask(cfg.apiKey)}</dd>
            <dt className="text-muted">Code marchand</dt>
            <dd className="font-mono">{cfg.merchantCode || "non défini"}</dd>
            <dt className="text-muted">Fréquence</dt>
            <dd>toutes les {cfg.intervalSeconds} s</dd>
            <dt className="text-muted">Dernière exécution</dt>
            <dd>{lastRun ? relativeLabel(new Date(lastRun)) : "jamais"}</dd>
            <dt className="text-muted">Curseur</dt>
            <dd>{lastSync ? new Date(lastSync).toLocaleString("fr-FR") : "—"}</dd>
            <dt className="text-muted">Dernier résultat</dt>
            <dd>{result ? `${result.fetched} lues, ${result.created} importées, ${result.refunded} remboursées` : "—"}</dd>
            <dt className="text-muted">Ventes SumUp en base</dt>
            <dd>{sumupSales}</dd>
          </dl>
          {lastError && <p className="mt-4 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600">{lastError}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <ActionForm action={syncNowAction}>
              <SubmitButton className="btn-dark" pendingLabel="Synchronisation…">
                {cfg.mode === "mock" ? "Simuler une vente" : "Synchroniser maintenant"}
              </SubmitButton>
            </ActionForm>
            {cfg.mode === "live" && (
              <ActionForm action={testSumUpAction}>
                <SubmitButton className="btn-outline" pendingLabel="Test…">
                  Tester la connexion
                </SubmitButton>
              </ActionForm>
            )}
          </div>
          <p className="mt-6 text-xs text-muted">
            Les identifiants SumUp sont des variables d&apos;environnement (SUMUP_MODE, SUMUP_API_KEY, SUMUP_MERCHANT_CODE) définies dans Coolify — jamais
            stockées en base ni dans le dépôt Git.
          </p>
        </div>

        <div className="card self-start p-6">
          <h2 className="mb-4 text-lg font-semibold">Commissions & frais</h2>
          <ActionForm action={updateSettingsAction} className="space-y-4">
            <div>
              <label className="label">Commission Les Songes Créatifs par défaut (%)</label>
              <input name="defaultCommission" type="number" step="0.5" min={0} max={100} defaultValue={Math.round(defaultRate * 1000) / 10} className="input" />
              <p className="mt-1 text-xs text-muted">Appliquée aux nouveaux créateurs. Chaque créateur peut avoir son propre taux.</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="applyAll" className="h-4 w-4" /> Appliquer ce taux à tous les créateurs existants
            </label>
            <div>
              <label className="label">Taux de frais carte SumUp (%)</label>
              <input name="cardFeeRate" type="number" step="0.01" min={0} max={10} defaultValue={Math.round(feeRate * 10000) / 100} className="input" />
              <p className="mt-1 text-xs text-muted">
                Utilisé seulement si SumUp ne fournit pas les frais réels d&apos;une transaction, et pour les ventes simulées.
              </p>
            </div>
            <SubmitButton>Enregistrer</SubmitButton>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
