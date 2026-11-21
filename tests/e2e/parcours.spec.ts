import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

// Prérequis : base initialisée avec `npm run seed`.

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

async function loginOk(page: Page, email: string, password: string) {
  await login(page, email, password);
  await expect(page).toHaveURL(/\/(admin|creator\/boutique)$/);
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
  await expect(page.getByRole("heading", { name: "La boutique" })).toBeVisible();

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
  await expect(page.getByText(pitch)).toBeVisible();
});

test("créateur : export puis import Excel du catalogue (aperçu, confirmation, erreurs)", async ({ page }) => {
  const stamp = Date.now();
  await loginOk(page, "crochet@boutique.test", "demo123");
  await page.goto("/creator/products");

  // Export
  const res = await page.request.get("/api/products/export");
  expect(res.status()).toBe(200);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await res.body()) as unknown as ArrayBuffer);
  const ws = wb.getWorksheet("Produits")!;
  expect(ws.getRow(1).getCell(2).value).toBe("Référence");

  // Modification : +1 sur la ligne « Bague », ajout d'une nouvelle ligne
  let bagueStock = 0;
  ws.eachRow((row, n) => {
    if (n > 1 && row.getCell(3).value === "Bague") {
      bagueStock = Number(row.getCell(5).value);
      row.getCell(5).value = bagueStock + 1;
    }
  });
  ws.addRow(["", `xls-${stamp}`, `Produit Excel ${stamp}`, 9.5, 4]);
  const file = Buffer.from(await wb.xlsx.writeBuffer());

  // Import : aperçu puis confirmation
  await page.getByRole("button", { name: "Importer (Excel)" }).click();
  await page.getByLabel("Fichier Excel à importer").setInputFiles({
    name: "catalogue.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: file,
  });
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("1 nouveau(x) produit(s)");
  await expect(dialog).toContainText(`Bague : stock ${bagueStock} → ${bagueStock + 1}`);
  await dialog.getByRole("button", { name: "Confirmer l'import" }).click();
  await expect(dialog).toContainText("Import terminé : 1 produit(s) créé(s)");
  await dialog.getByRole("button", { name: "Voir le catalogue" }).click();

  const newRow = page.getByRole("row", { name: new RegExp(`Produit Excel ${stamp}`) });
  await expect(newRow).toContainText(`XLS-${stamp}`);
  await expect(newRow).toContainText("En attente");
  await expect(page.getByRole("row", { name: /\bBague\b/ }).getByRole("cell").nth(4)).toHaveText(String(bagueStock + 1));

  // Fichier avec erreurs : rien n'est importé, pas de bouton de confirmation
  const bad = new ExcelJS.Workbook();
  const bs = bad.addWorksheet("Produits");
  bs.addRow(["Identifiant (ne pas modifier)", "Référence", "Nom", "Prix (€)", "Quantité"]);
  bs.addRow(["", `bad-${stamp}`, "Produit sans prix", "", 1]);
  bs.addRow(["999", "X-1", "Identifiant inventé", 5, 1]);
  await page.getByRole("button", { name: "Importer (Excel)" }).click();
  await page.getByLabel("Fichier Excel à importer").setInputFiles({
    name: "erreurs.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await bad.xlsx.writeBuffer()),
  });
  await expect(page.getByRole("dialog")).toContainText("2 erreur(s)");
  await expect(page.getByRole("dialog")).toContainText("Ligne 2 :");
  await expect(page.getByRole("dialog")).toContainText("Identifiant 999 inconnu");
  await expect(page.getByRole("button", { name: "Confirmer l'import" })).toHaveCount(0);
});

test("admin : export puis import Excel de tout le catalogue, avec avertissement", async ({ page }) => {
  const stamp = Date.now();
  const xlsxType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  await loginOk(page, "admin@boutique.test", "admin123");
  await page.goto("/admin/products?tab=all");

  const res = await page.request.get("/api/admin/products/export");
  expect(res.status()).toBe(200);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await res.body()) as unknown as ArrayBuffer);
  const ws = wb.getWorksheet("Produits")!;
  expect(ws.getRow(1).getCell(1).value).toBe("Marque");
  // Stock de « Print A5 » (Koloro) fixé à 42 + nouveau produit Koloro
  ws.eachRow((row, n) => {
    if (n > 1 && row.getCell(1).value === "Koloro" && row.getCell(4).value === "Print A5") row.getCell(6).value = 42;
  });
  ws.addRow(["Koloro", "", `adm-${stamp}`, `Produit admin ${stamp}`, 15, 2, "", ""]);

  await page.getByRole("button", { name: "Importer (Excel)" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Attention : cet import écrase les données des créateurs.");
  await page.getByLabel("Fichier Excel à importer").setInputFiles({ name: "boutique.xlsx", mimeType: xlsxType, buffer: Buffer.from(await wb.xlsx.writeBuffer()) });
  await expect(dialog).toContainText("1 nouveau(x) produit(s)");
  await expect(dialog).toContainText(`Koloro · ADM-${stamp}`);
  const confirm = dialog.getByRole("button", { name: "Confirmer l'import" });
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await confirm.click();
  await expect(dialog).toContainText(/Import terminé : 1 produit\(s\) créé\(s\), \d+ produit\(s\) modifié\(s\), 1 créateur\(s\) notifié\(s\)/);
  await dialog.getByRole("button", { name: "Voir le catalogue" }).click();

  await page.goto(`/admin/products?tab=all&q=${encodeURIComponent(`Produit admin ${stamp}`)}`);
  await expect(page.getByRole("row", { name: new RegExp(`Produit admin ${stamp}`) })).toContainText("Actif");

  // Marque inconnue : refusée
  const bad = new ExcelJS.Workbook();
  bad.addWorksheet("Produits").addRows([
    ["Marque", "Identifiant (ne pas modifier)", "Référence", "Nom", "Prix (€)", "Quantité"],
    ["Marque fantôme", "", "Z-1", "Produit", 5, 1],
  ]);
  await page.getByRole("button", { name: "Importer (Excel)" }).click();
  await page.getByLabel("Fichier Excel à importer").setInputFiles({ name: "bad.xlsx", mimeType: xlsxType, buffer: Buffer.from(await bad.xlsx.writeBuffer()) });
  await expect(page.getByRole("dialog")).toContainText("Marque « Marque fantôme » inconnue");
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
  await expect(page).toHaveURL(/creator\/boutique/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/creator\/boutique/);
});
