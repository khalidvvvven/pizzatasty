import { expect, test, type Locator } from '@playwright/test';

const euros = async (l: Locator) => Number(((await l.textContent()) ?? '').replace(/[^\d,]/g, '').replace(',', '.'));

test('order on a phone: customise, cart, delivery checkout, WhatsApp demo ticket', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/fr/menu');

  await test.step('customise a Margherita: Méga + 2 extras × 2', async () => {
    await page.getByRole('button', { name: 'Margherita', exact: true }).click();
    const sheet = page.locator('dialog[open]');
    await sheet.getByRole('radio', { name: /^Méga/ }).check();
    await sheet.getByText('Chèvre', { exact: true }).click();
    await sheet.getByText('Olives', { exact: true }).click();
    await sheet.getByRole('button', { name: 'Ajouter un' }).click();
    const add = sheet.getByRole('button', { name: /^Ajouter · / });
    expect(await euros(add)).toBe(34);
    await add.click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });

  await test.step('quick add and validated tacos', async () => {
    await page.getByRole('button', { name: 'Ajouter Américain au panier' }).click();
    await page.getByRole('button', { name: 'Tacos Classique', exact: true }).click();
    const sheet = page.locator('dialog[open]');
    await sheet.getByRole('radio', { name: /^L\b/ }).check();
    await sheet.getByRole('button', { name: /^Ajouter · / }).click();
    await expect(sheet.getByText('Choisissez 2 options.')).toBeVisible();
    await sheet.getByText('Merguez', { exact: true }).click();
    await expect(sheet.getByRole('checkbox', { name: 'Nuggets' })).toBeDisabled();
    await sheet.getByText('Algérienne', { exact: true }).click();
    await sheet.getByRole('button', { name: /^Ajouter · / }).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });

  const cart = page.locator('dialog[open]');
  await test.step('cart maths, quantity, remove + undo', async () => {
    await page.getByRole('button', { name: /Voir le panier/ }).first().click();
    const subtotal = cart.locator('dl div', { hasText: 'Sous-total' }).locator('dd');
    expect(await euros(subtotal)).toBe(52);
    await cart.getByRole('button', { name: 'Ajouter un · Américain' }).click();
    expect(await euros(subtotal)).toBe(60.5);
    await cart.getByRole('button', { name: 'Retirer un · Américain' }).click();
    await cart.getByRole('button', { name: 'Retirer · Américain' }).click();
    await expect(cart.getByText('Américain', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect(cart.getByText('Américain', { exact: true })).toHaveCount(1);
  });

  await test.step('delivery details with validation', async () => {
    await cart.getByRole('radio', { name: /^Livraison/ }).check();
    await expect(cart.locator('dl div', { hasText: 'Livraison' }).locator('dd')).toHaveText('Offerte');
    await cart.getByRole('button', { name: /^Continuer/ }).click();
    await cart.getByRole('button', { name: 'Voir le récapitulatif' }).click();
    await expect(cart.locator('[aria-invalid="true"]')).toHaveCount(3);
    await expect(cart.getByLabel('Prénom et nom')).toBeFocused();
    await cart.getByLabel('Prénom et nom').fill('Client Démo');
    await cart.getByLabel('Téléphone').fill('06 12 34 56 78');
    await cart.getByLabel('Adresse de livraison').fill('1 rue de la Démo, 00000 Ville');
    await cart.getByRole('button', { name: 'Voir le récapitulatif' }).click();
  });

  await test.step('WhatsApp ticket ends in a demo state, never a fake number', async () => {
    const ticket = cart.locator('pre');
    await expect(ticket).toContainText('2 × Margherita (Méga)');
    await expect(ticket).toContainText('Mode : Livraison');
    await expect(ticket).toContainText('TOTAL : 52,00');
    await cart.getByRole('button', { name: 'Envoyer sur WhatsApp' }).click();
    await expect(cart.getByText('Commande prête (démo)')).toBeVisible();
    expect(page.url()).not.toContain('wa.me');
  });

  await test.step('cart persists across reload and language switch', async () => {
    await cart.getByRole('button', { name: 'Garder le panier' }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: /Voir le panier/ }).first()).toContainText('52,00');
    await page.locator('footer').getByRole('link', { name: 'English' }).click();
    await expect(page).toHaveURL(/\/en\/menu$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('button', { name: /View cart/ }).first()).toContainText('52.00');
  });

  expect(errors).toEqual([]);
});

test('menu search and category navigation', async ({ page }) => {
  await page.goto('/fr/menu');
  await page.getByLabel('Rechercher un plat').fill('creme');
  await expect(page.getByText(/\d+ plats? trouvés?/)).toBeVisible();
  await page.getByLabel('Rechercher un plat').fill('zzzz');
  await expect(page.getByText('Aucun plat ne correspond')).toBeVisible();
  await page.getByLabel('Rechercher un plat').fill('');
  await page.getByRole('link', { name: 'Desserts' }).click();
  await expect.poll(() => page.evaluate(() => document.getElementById('desserts')!.getBoundingClientRect().top)).toBeLessThan(300);
});

test('reservation request ends in an honest demo confirmation', async ({ page }) => {
  await page.goto('/fr/reservation?guests=4');
  await expect(page.locator('main')).toContainText('4 personnes');
  await page.getByRole('button', { name: 'Envoyer la demande' }).click();
  await expect(page.getByText(/Corrigez \d champs/)).toBeVisible();
  await page.getByLabel('Prénom et nom').fill('Client Démo');
  await page.getByLabel('Téléphone').fill('+33 6 12 34 56 78');
  const inThreeDays = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  await page.getByLabel('Date').fill(inThreeDays);
  await page.locator('input[name="res-time"]').first().check({ force: true });
  await page.getByRole('button', { name: 'Envoyer la demande' }).click();
  await expect(page.getByText('Demande enregistrée (démo)')).toBeVisible();
  await expect(page.getByText('Une demande n’est pas une confirmation.')).toBeVisible();
});
