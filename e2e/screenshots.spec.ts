// Portfolio screenshots taken from the RUNNING app (real pages, seeded demo data).
//   SHOTS=1 npx playwright test e2e/screenshots.spec.ts --project=chromium
import { expect, test, type Page } from "@playwright/test";
import { nextWeekday } from "./support/helpers";

test.skip(!process.env.SHOTS, "set SHOTS=1 to regenerate docs/screenshots");
test.use({ viewport: { width: 1440, height: 900 } });

const out = (name: string) => `docs/screenshots/${name}.png`;

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  // lazy images and scroll-reveal sections: scroll through once so everything is rendered
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
}

test.describe("публичный сайт", () => {
  test("01 главная", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await page.screenshot({ path: out("01-home"), fullPage: false });
  });
  test("02 о ресторане", async ({ page }) => {
    await page.goto("/about");
    await settle(page);
    await page.screenshot({ path: out("02-about"), fullPage: true });
  });
  test("03 меню", async ({ page }) => {
    await page.goto("/menu");
    await settle(page);
    await page.screenshot({ path: out("03-menu"), fullPage: false });
  });
  test("04 карточка блюда", async ({ page }) => {
    await page.goto("/menu/salmon-grilled-vegetables");
    await settle(page);
    await page.screenshot({ path: out("04-dish"), fullPage: false });
  });
  test("05 галерея", async ({ page }) => {
    await page.goto("/gallery");
    await settle(page);
    await page.screenshot({ path: out("05-gallery"), fullPage: true });
  });
  test("06 форма бронирования", async ({ page }) => {
    await page.goto("/reservation");
    await page.getByLabel("Имя").fill("Анна Демонстрационная");
    await page.getByLabel("Телефон").fill("+7 900 000 00 00");
    await page.getByLabel("Email").fill("demo@example.com");
    await page.getByLabel("Дата").fill(nextWeekday(2, 6));
    await page.getByLabel("Количество гостей").selectOption("4");
    await page.getByRole("radiogroup", { name: "Время" }).locator("label", { hasText: /^19:00$/ }).click();
    await settle(page);
    await page.screenshot({ path: out("06-reservation"), fullPage: false });
  });
});

test.describe("административная панель", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("07 dashboard", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Бронирования по дням" })).toBeVisible();
    await settle(page);
    await page.screenshot({ path: out("07-admin-dashboard"), fullPage: true });
  });
  test("08 управление блюдами", async ({ page }) => {
    await page.goto("/admin/menu");
    await settle(page);
    await page.screenshot({ path: out("08-admin-menu"), fullPage: false });
  });
  test("09 управление бронированиями", async ({ page }) => {
    await page.goto("/admin/bookings");
    await settle(page);
    await page.screenshot({ path: out("09-admin-bookings"), fullPage: false });
  });
  test("10 настройки", async ({ page }) => {
    await page.goto("/admin/settings");
    await settle(page);
    await page.screenshot({ path: out("10-admin-settings"), fullPage: false });
  });
});
