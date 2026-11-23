import { redirect } from "next/navigation";

// La vue « La boutique » a été retirée de l'espace créateur :
// l'ancienne adresse renvoie vers « Mes ventes » (favoris, anciens liens).
export default function BoutiqueRedirect() {
  redirect("/creator/sales");
}
