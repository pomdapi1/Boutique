/**
 * Limitation des tentatives de connexion échouées (anti force brute).
 * En mémoire : suffisant pour une instance unique (un conteneur Coolify) ;
 * remis à zéro au redémarrage.
 */

const WINDOW_MS = 15 * 60 * 1000;
/** Échecs tolérés par compte (email) sur la fenêtre. */
export const MAX_FAILURES_PER_ACCOUNT = 5;
/** Échecs tolérés par adresse IP sur la fenêtre (plusieurs comptes essayés). */
export const MAX_FAILURES_PER_IP = 20;

type Entry = { count: number; resetAt: number };
const failures = new Map<string, Entry>();

function live(key: string, now: number): Entry | undefined {
  const e = failures.get(key);
  if (e && e.resetAt <= now) {
    failures.delete(key);
    return undefined;
  }
  return e;
}

function keys(email: string, ip: string | null) {
  return { account: `a:${email.trim().toLowerCase()}`, ip: ip ? `i:${ip}` : null };
}

/** Secondes d'attente restantes si la connexion est bloquée, sinon 0. */
export function loginBlockedFor(email: string, ip: string | null, now = Date.now()): number {
  const k = keys(email, ip);
  const a = live(k.account, now);
  const i = k.ip ? live(k.ip, now) : undefined;
  const waits = [
    a && a.count >= MAX_FAILURES_PER_ACCOUNT ? a.resetAt - now : 0,
    i && i.count >= MAX_FAILURES_PER_IP ? i.resetAt - now : 0,
  ];
  return Math.ceil(Math.max(...waits) / 1000);
}

export function recordLoginFailure(email: string, ip: string | null, now = Date.now()) {
  const k = keys(email, ip);
  for (const key of [k.account, k.ip]) {
    if (!key) continue;
    const e = live(key, now);
    if (e) e.count++;
    else failures.set(key, { count: 1, resetAt: now + WINDOW_MS });
  }
  // Ménage pour éviter une croissance sans fin de la table
  if (failures.size > 10_000) for (const [key] of failures) if (!live(key, now)) failures.delete(key);
}

/** Connexion réussie : le compteur du compte est remis à zéro (pas celui de l'IP). */
export function recordLoginSuccess(email: string) {
  failures.delete(keys(email, null).account);
}

/** Pour les tests. */
export function resetLoginLimits() {
  failures.clear();
}

/**
 * IP du client. Derrière le proxy de Coolify (Traefik), l'IP réelle est la dernière
 * entrée de X-Forwarded-For (ajoutée par le proxy) ; les entrées précédentes peuvent
 * être falsifiées par le client.
 */
export function clientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const last = xff.split(",").map((s) => s.trim()).filter(Boolean).at(-1);
    if (last) return last;
  }
  return headers.get("x-real-ip");
}
