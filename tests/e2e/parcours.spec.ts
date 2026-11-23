import { expect, test, type Page } from "@playwright/test";
import { parseCsv, toCsv } from "../../src/lib/csv";
import { SUMUP_HEADERS } from "../../src/lib/product-sheet";

// Prérequis : base initialisée avec `npm run seed`.

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

async function loginOk(page: Page, email: string, password: string) {
  await login(page, email, password);
  await expect(page).toHaveURL(/\/(admin|creator\/sales)$/);
}

async function logout(page: Page) {
  await page.getByRole("banner").getByRole("button", { name: "Déconnexion" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test("mauvais mot de passe refusé", async ({ page }) => {
  await login(page, "crochet@boutique.test", "mauvais");
  await expect(page.getByText("Identifiants incorrects.")).toBeVisible();
});

test("créateur : feed, stock et nouveau produit ; admin : validation", async ({ page }) => {
  await loginOk(page, "crochet@boutique.test", "demo123");
  // Vue « La boutique » retirée : absente du menu, l'ancienne adresse renvoie vers « Mes ventes »
  await expect(page.getByRole("link", { name: "La boutique" })).toHaveCount(0);
  await page.goto("/creator/boutique");
  await expect(page).toHaveURL(/\/creator\/sales$/);

  // Ajout de stock sur le premier produit
  await page.getByRole("link", { name: "Mes produits" }).click();
  await expect(page.getByRole("heading", { name: "Mon catalogue" })).toBeVisible();
  const row = page.getByRole("row", { name: /Porte-clefs Petit/ });
  // Catalogue créateur : plus de code "001 - " devant le nom, colonne Marque
  await expect(row).not.toContainText("001 -");
  await expect(page.getByRole("columnheader", { name: "Marque" })).toBeVisible();
  const before = Number(await row.getByRole("cell").nth(4).innerText());
  await row.getByRole("button", { name: "Stock" }).click();
  await page.getByLabel("Quantité").fill("2");
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByText(`Stock mis à jour : ${before + 2}.`)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(row.getByRole("cell").nth(4)).toHaveText(String(before + 2));

  // Nouveau produit → en attente
  const stamp = Date.now();
  const name = `Produit e2e ${stamp}`;
  const reference = `e2e-${stamp}`;
  await page.getByRole("button", { name: "Ajouter des produits" }).click();
  await page.getByLabel("Référence produit").fill(reference);
  await page.getByLabel("Nom du produit").fill(name);
  await page.getByLabel("Prix (€)").fill("14,50");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText(/en attente de validation/)).toBeVisible();
  // Même référence une seconde fois : refusée
  await page.getByLabel("Référence produit").fill(reference);
  await page.getByLabel("Nom du produit").fill(`${name} bis`);
  await page.getByLabel("Prix (€)").fill("10");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText(/est déjà utilisée par/)).toBeVisible();
  await page.keyboard.press("Escape");
  const newRow = page.getByRole("row", { name: new RegExp(name) });
  await expect(newRow).toContainText("En attente");
  await expect(newRow).toContainText(reference.toUpperCase());

  // Déconnexion → admin valide
  await logout(page);
  await loginOk(page, "admin@boutique.test", "admin123");
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
  await page.goto("/admin/products");
  const item = page.getByRole("listitem").filter({ hasText: name });
  await item.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: name })).toHaveCount(0);

  // Tous les produits : colonnes Référence, Marque, Nom du créateur
  await page.goto(`/admin/products?tab=all&q=${encodeURIComponent(reference)}`);
  for (const col of ["Référence", "Marque", "Nom du créateur"]) {
    await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
  }
  const adminRow = page.getByRole("row", { name: new RegExp(name) });
  await expect(adminRow).toContainText(reference.toUpperCase());
  await expect(adminRow).toContainText("Le jardin du crochet");

  // Retour créateur : produit actif + notification
  await logout(page);
  await loginOk(page, "crochet@boutique.test", "demo123");
  await page.goto("/creator/products");
  await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText("Actif");
  await page.getByRole("button", { name: "Notifications" }).click();
  await expect(page.getByText("Produit validé par Les Songes Créatifs").first()).toBeVisible();
});

test("admin : création d'un créateur avec nom de personne et nom de marque", async ({ page }) => {
  const stamp = Date.now();
  const owner = `Alice Test ${stamp}`;
  const brand = `Marque e2e ${stamp}`;
  const email = `e2e-${stamp}@boutique.test`;

  await loginOk(page, "admin@boutique.test", "admin123");
  await page.goto("/admin/creators");
  await page.getByRole("button", { name: "Ajouter un créateur" }).click();
  await page.getByLabel("Nom du créateur").fill(owner);
  await page.getByLabel("Nom de la marque").fill(brand);
  await page.getByLabel("Email de connexion").fill(email);
  await page.getByLabel("Mot de passe provisoire").fill("motdepasse123");
  await page.getByRole("button", { name: "Créer le compte" }).click();
  await expect(page.getByText(`Compte créé pour ${owner} (${brand})`)).toBeVisible();
  await page.keyboard.press("Escape");

  const row = page.getByRole("row", { name: new RegExp(brand) });
  await expect(row).toContainText(owner);

  // Le créateur se connecte : le menu affiche le nom de sa marque
  await logout(page);
  await loginOk(page, email, "motdepasse123");
  await expect(page.getByText(brand).first()).toBeVisible();

  // Suppression par l'admin (aucune vente) : confirmation par saisie du nom de la marque
  await logout(page);
  await loginOk(page, "admin@boutique.test", "admin123");
  await page.goto("/admin/creators");
  await page.getByRole("button", { name: `Supprimer ${brand}` }).click();
  const confirmBtn = page.getByRole("button", { name: "Supprimer définitivement" });
  await expect(confirmBtn).toBeDisabled();
  await page.getByLabel(/Pour confirmer, saisissez le nom de la marque/).fill(brand);
  await expect(confirmBtn).toBeEnabled();
  await confirmBtn.click();
  await expect(page.getByRole("row", { name: new RegExp(brand) })).toHaveCount(0);

  // Le compte supprimé ne peut plus se connecter
  await logout(page);
  await login(page, email, "motdepasse123");
  await expect(page.getByText("Identifiants incorrects.")).toBeVisible();
});

test("admin : un créateur avec des ventes ne peut pas être supprimé", async ({ page }) => {
  await loginOk(page, "admin@boutique.test", "admin123");
  await page.goto("/admin/creators");
  await page.getByRole("button", { name: "Supprimer Le jardin du crochet" }).click();
  await expect(page.getByText(/ne peut pas être supprimé/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Désactiver le compte" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Supprimer définitivement" })).toHaveCount(0);
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByRole("row", { name: /Le jardin du crochet/ })).toContainText("Actif");
});

test("créateur : suppression d'un produit avec confirmation", async ({ page }) => {
  const stamp = Date.now();
  const name = `A supprimer ${stamp}`;
  await loginOk(page, "crochet@boutique.test", "demo123");
  await page.goto("/creator/products");
  await page.getByRole("button", { name: "Ajouter des produits" }).click();
  await page.getByLabel("Référence produit").fill(`DEL-${stamp}`);
  await page.getByLabel("Nom du produit").fill(name);
  await page.getByLabel("Prix (€)").fill("5");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText(/en attente de validation/)).toBeVisible();
  await page.keyboard.press("Escape");

  const row = page.getByRole("row", { name: new RegExp(name) });
  await row.getByRole("button", { name: `Supprimer ${name}` }).click();
  await expect(page.getByRole("dialog")).toContainText("ne peut pas être annulée");
  // Annuler ne supprime rien
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(row).toHaveCount(1);
  // Confirmer supprime
  await row.getByRole("button", { name: `Supprimer ${name}` }).click();
  await page.getByRole("button", { name: "Supprimer le produit" }).click();
  await expect(page.getByRole("row", { name: new RegExp(name) })).toHaveCount(0);
});

test("créateur : communication (textes, photos) et kit com déposé par l'admin", async ({ page }) => {
  const stamp = Date.now();
  // PNG 1×1 valide et faux PNG (texte)
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

  // Admin : dépôt du kit com (ZIP)
  await loginOk(page, "admin@boutique.test", "admin123");
  await page.goto("/admin/settings");
  await page.getByLabel("Fichier du kit com").setInputFiles({
    name: `kit-${stamp}.zip`,
    mimeType: "application/zip",
    buffer: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64)]),
  });
  await expect(page.getByText(/Kit com mis à jour/)).toBeVisible();
  await logout(page);

  // Créateur : textes
  await loginOk(page, "crochet@boutique.test", "demo123");
  await page.goto("/creator/documents");
  await expect(page.getByRole("heading", { name: "Communication" })).toBeVisible();
  // Rubrique « Facture mensuelle » retirée
  await expect(page.getByText("Facture mensuelle")).toHaveCount(0);
  // Textes d'origine, remis en place à la fin du test
  const pitchBefore = await page.getByLabel(/Présentation courte de votre marque/).inputValue();
  const notesBefore = await page.getByLabel(/Recommandations, spécificités des produits/).inputValue();
  const pitch = `Marque test ${stamp} 🌸`;
  await page.getByLabel(/Présentation courte de votre marque/).fill(pitch);
  await expect(page.getByText(`${Array.from(pitch).length}/300`)).toBeVisible();
  await page.getByLabel(/Recommandations, spécificités des produits/).fill("Coton.\nLavage à la main.");
  await page.getByRole("button", { name: "Enregistrer les textes" }).click();
  await expect(page.getByText("Textes enregistrés.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(/Présentation courte de votre marque/)).toHaveValue(pitch);

  // Créateur : photo refusée (faux PNG), puis photo valide ajoutée et supprimée
  await page.getByLabel("Ajouter une photo").setInputFiles({ name: "faux.png", mimeType: "image/png", buffer: Buffer.from("pas une image") });
  await expect(page.getByText("Format accepté : JPEG ou PNG.")).toBeVisible();
  const photoName = `photo-${stamp}.png`;
  await page.getByLabel("Ajouter une photo").setInputFiles({ name: photoName, mimeType: "image/png", buffer: png });
  await expect(page.getByText(photoName)).toBeVisible();
  await page.getByRole("button", { name: `Supprimer ${photoName}` }).click();
  await expect(page.getByText(photoName)).toHaveCount(0);

  // Créateur : téléchargement du kit
  const kitLink = page.getByRole("link", { name: /Télécharger le kit com/ });
  await expect(kitLink).toBeVisible();
  const res = await page.request.get("/api/kit");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-disposition"]).toContain(`kit-${stamp}.zip`);
  await logout(page);

  // Admin : retrait du kit (nettoyage) et texte visible sur la fiche du créateur
  await loginOk(page, "admin@boutique.test", "admin123");
  await page.goto("/admin/settings");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Retirer" }).click();
  await expect(page.getByText("Kit com retiré.")).toBeVisible();
  await page.goto("/admin/creators");
  await page.getByRole("link", { name: "Le jardin du crochet" }).click();
  await page.waitForURL(/\/admin\/creators\/[^/]+$/, { timeout: 30_000 }); // compilation à la volée en mode dev
  await expect(page.getByText(pitch)).toBeVisible();

  // Nettoyage : textes d'origine du créateur
  await logout(page);
  await loginOk(page, "crochet@boutique.test", "demo123");
  await page.goto("/creator/documents");
  await page.getByLabel(/Présentation courte de votre marque/).fill(pitchBefore);
  await page.getByLabel(/Recommandations, spécificités des produits/).fill(notesBefore);
  await page.getByRole("button", { name: "Enregistrer les textes" }).click();
  await expect(page.getByText("Textes enregistrés.")).toBeVisible();
});

/** Ligne CSV SumUp minimale (autres colonnes vides) à partir de quelques valeurs. */
function sumupLine(values: Partial<Record<(typeof SUMUP_HEADERS)[number], string>>) {
  return SUMUP_HEADERS.map((h) => values[h] ?? "");
}
const CSV_TYPE = "text/csv";

test("créateur : export puis import CSV SumUp du catalogue (aperçu, confirmation, erreurs)", async ({ page }) => {
  const stamp = Date.now();
  await loginOk(page, "crochet@boutique.test", "demo123");
  await page.goto("/creator/products");

  // Export : format CSV SumUp exact
  const res = await page.request.get("/api/products/export");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/csv");
  const rows = parseCsv(await res.text());
  expect(rows[0]).toEqual([...SUMUP_HEADERS]);
  const qty = SUMUP_HEADERS.indexOf("Quantity");
  const bague = rows.find((r) => r[0] === "Le jardin du crochet - Bague")!;
  expect(bague[SUMUP_HEADERS.indexOf("Category")]).toBe("Le jardin du crochet");
  const bagueStock = Number(bague[qty]);

  // Modification : +1 sur « Bague », ajout d'une nouvelle ligne
  bague[qty] = String(bagueStock + 1);
  rows.push(
    sumupLine({
      "Item name": `Le jardin du crochet - Produit CSV ${stamp}`,
      Price: "9.50",
      Quantity: "4",
      SKU: `csv-${stamp}`,
      Category: "Le jardin du crochet",
    }),
  );

  // Import : aperçu puis confirmation
  await page.getByRole("button", { name: "Importer (CSV SumUp)" }).click();
  await page.getByLabel("Fichier CSV à importer").setInputFiles({ name: "catalogue.csv", mimeType: CSV_TYPE, buffer: Buffer.from(toCsv(rows)) });
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("1 nouveau(x) produit(s)");
  await expect(dialog).toContainText(`Bague : stock ${bagueStock} → ${bagueStock + 1}`);
  await dialog.getByRole("button", { name: "Confirmer l'import" }).click();
  await expect(dialog).toContainText("Import terminé : 1 produit(s) créé(s)");
  await dialog.getByRole("button", { name: "Voir le catalogue" }).click();

  const newRow = page.getByRole("row", { name: new RegExp(`Produit CSV ${stamp}`) });
  await expect(newRow).toContainText(`CSV-${stamp}`);
  await expect(newRow).toContainText("En attente");
  await expect(page.getByRole("row", { name: /\bBague\b/ }).getByRole("cell").nth(4)).toHaveText(String(bagueStock + 1));

  // Fichier avec erreurs (point-virgule, comme réenregistré par Excel) : rien n'est importé
  const bad = toCsv(
    [
      ["Item name", "Price", "SKU", "Quantity", "Category"],
      [`Le jardin du crochet - Sans SKU ${stamp}`, "5,00", "", "1", "Le jardin du crochet"],
      ["Baldck - Bague", "18,00", "X-1", "1", "Baldck"],
    ],
    ";",
  );
  await page.getByRole("button", { name: "Importer (CSV SumUp)" }).click();
  await page.getByLabel("Fichier CSV à importer").setInputFiles({ name: "erreurs.csv", mimeType: CSV_TYPE, buffer: Buffer.from(bad) });
  await expect(page.getByRole("dialog")).toContainText("2 erreur(s)");
  await expect(page.getByRole("dialog")).toContainText("Ligne 2 :");
  await expect(page.getByRole("dialog")).toContainText("appartient à la marque « Baldck »");
  await expect(page.getByRole("button", { name: "Confirmer l'import" })).toHaveCount(0);
});

test("admin : export puis import CSV SumUp de tout le catalogue, avec avertissement", async ({ page }) => {
  const stamp = Date.now();
  await loginOk(page, "admin@boutique.test", "admin123");
  await page.goto("/admin/products?tab=all");

  const res = await page.request.get("/api/admin/products/export");
  expect(res.status()).toBe(200);
  const rows = parseCsv(await res.text());
  expect(rows[0]).toEqual([...SUMUP_HEADERS]);
  // Stock de « Print A5 » (Koloro) fixé à 42 + deux nouveaux produits Koloro
  // (l'un avec Category, l'autre seulement « Koloro - … » dans l'Item name)
  rows.find((r) => r[0] === "Koloro - Print A5")![SUMUP_HEADERS.indexOf("Quantity")] = "42";
  rows.push(sumupLine({ "Item name": `Koloro - Produit admin ${stamp}`, Price: "15.00", Quantity: "2", SKU: `adm-${stamp}`, Category: "Koloro" }));
  rows.push(sumupLine({ "Item name": `Koloro - Sans catégorie ${stamp}`, Price: "8.00", Quantity: "1", SKU: `adm2-${stamp}` }));

  await page.getByRole("button", { name: "Importer (CSV SumUp)" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Attention : cet import écrase les données des créateurs.");
  await page.getByLabel("Fichier CSV à importer").setInputFiles({ name: "boutique.csv", mimeType: CSV_TYPE, buffer: Buffer.from(toCsv(rows)) });
  await expect(dialog).toContainText("2 nouveau(x) produit(s)");
  await expect(dialog).toContainText(`Koloro · ADM-${stamp}`);
  await expect(dialog).toContainText(`Koloro · ADM2-${stamp}`);
  const confirm = dialog.getByRole("button", { name: "Confirmer l'import" });
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await confirm.click();
  await expect(dialog).toContainText(/Import terminé : 2 produit\(s\) créé\(s\), \d+ produit\(s\) modifié\(s\), 1 créateur\(s\) notifié\(s\)/);
  await dialog.getByRole("button", { name: "Voir le catalogue" }).click();

  await page.goto(`/admin/products?tab=all&q=${encodeURIComponent(`Produit admin ${stamp}`)}`);
  await expect(page.getByRole("row", { name: new RegExp(`Produit admin ${stamp}`) })).toContainText("Actif");

  // Marque inconnue : refusée
  const bad = toCsv([
    ["Item name", "Price", "SKU", "Quantity", "Category"],
    ["Marque fantôme - Produit", "5.00", "Z-1", "1", "Marque fantôme"],
  ]);
  await page.getByRole("button", { name: "Importer (CSV SumUp)" }).click();
  await page.getByLabel("Fichier CSV à importer").setInputFiles({ name: "bad.csv", mimeType: CSV_TYPE, buffer: Buffer.from(bad) });
  await expect(page.getByRole("dialog")).toContainText("Marque « Marque fantôme » (colonne Category) inconnue");
  await expect(page.getByRole("button", { name: "Confirmer l'import" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Le créateur est notifié
  await logout(page);
  await loginOk(page, "koloro@boutique.test", "demo123");
  await page.getByRole("button", { name: "Notifications" }).click();
  await expect(page.getByText("Votre catalogue a été mis à jour par Les Songes Créatifs").first()).toBeVisible();
});

test("un créateur n'accède pas à l'admin", async ({ page }) => {
  await loginOk(page, "crochet@boutique.test", "demo123");
  await expect(page).toHaveURL(/creator\/sales/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/creator\/sales/);
});

test("statistiques créateur : uniquement ses propres chiffres", async ({ page }) => {
  await loginOk(page, "crochet@boutique.test", "demo123");
  await page.goto("/creator/stats");
  await expect(page.getByRole("link", { name: "Boutique", exact: true })).toHaveCount(0);
  await expect(page.getByText(/Net à reverser/).first()).toBeVisible();
  // Ancien lien vers l'onglet boutique : affiche quand même les chiffres du créateur
  await page.goto("/creator/stats?tab=shop");
  await expect(page.getByText(/CA de la boutique/)).toHaveCount(0);
  await expect(page.getByText(/Net à reverser/).first()).toBeVisible();
});
