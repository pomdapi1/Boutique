import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/**
 * Efface le cookie de session puis renvoie vers /login.
 * Utilisé quand la session est signée mais n'est plus valable (mot de passe changé,
 * compte désactivé ou supprimé) : sans cela, le middleware renverrait de /login vers
 * l'accueil, puis la page vers /login, en boucle.
 */
export function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
