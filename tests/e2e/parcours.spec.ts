import { expect, test, type Page } from "@playwright/test";

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
  const row = page.getByRole("row", { name: /001 - Porte-clefs Petit/ });
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

test("un créateur n'accède pas à l'admin", async ({ page }) => {
  await loginOk(page, "crochet@boutique.test", "demo123");
  await expect(page).toHaveURL(/creator\/boutique/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/creator\/boutique/);
});
