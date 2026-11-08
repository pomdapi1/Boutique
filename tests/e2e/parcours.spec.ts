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
  await login(page, "crochet@conserve.test", "mauvais");
  await expect(page.getByText("Identifiants incorrects.")).toBeVisible();
});

test("créateur : feed, stock et nouveau produit ; admin : validation", async ({ page }) => {
  await loginOk(page, "crochet@conserve.test", "demo123");
  await expect(page.getByRole("heading", { name: "La boutique" })).toBeVisible();

  // Ajout de stock sur le premier produit
  await page.getByRole("link", { name: "Mes produits" }).click();
  await expect(page.getByRole("heading", { name: "Mon catalogue" })).toBeVisible();
  const row = page.getByRole("row", { name: /001 - Porte-clefs Petit/ });
  const before = Number(await row.getByRole("cell").nth(3).innerText());
  await row.getByRole("button", { name: "Stock" }).click();
  await page.getByLabel("Quantité").fill("2");
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByText(`Stock mis à jour : ${before + 2}.`)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(row.getByRole("cell").nth(3)).toHaveText(String(before + 2));

  // Nouveau produit → en attente
  const name = `Produit e2e ${Date.now()}`;
  await page.getByRole("button", { name: "Ajouter des produits" }).click();
  await page.getByLabel("Nom du produit").fill(name);
  await page.getByLabel("Prix (€)").fill("14,50");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText(/en attente de validation/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText("En attente");

  // Déconnexion → admin valide
  await logout(page);
  await loginOk(page, "admin@conserve.test", "admin123");
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
  await page.goto("/admin/products");
  const item = page.getByRole("listitem").filter({ hasText: name });
  await item.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: name })).toHaveCount(0);

  // Retour créateur : produit actif + notification
  await logout(page);
  await loginOk(page, "crochet@conserve.test", "demo123");
  await page.goto("/creator/products");
  await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText("Actif");
  await page.getByRole("button", { name: "Notifications" }).click();
  await expect(page.getByText("Produit validé par Conserve").first()).toBeVisible();
});

test("un créateur n'accède pas à l'admin", async ({ page }) => {
  await loginOk(page, "crochet@conserve.test", "demo123");
  await expect(page).toHaveURL(/creator\/boutique/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/creator\/boutique/);
});
