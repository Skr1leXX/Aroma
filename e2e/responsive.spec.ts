import { expect, test, type Page } from "@playwright/test";

// Runs in three projects: mobile (Pixel 7), tablet (820x1180) and desktop.
const publicPages = ["/", "/about", "/menu", "/menu/panna-cotta", "/gallery", "/contacts", "/reservation", "/login", "/register"];
const adminPages = ["/admin", "/admin/bookings", "/admin/menu", "/admin/menu/new", "/admin/categories", "/admin/gallery", "/admin/reviews", "/admin/settings", "/admin/audit"];

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;

test.describe("публичный сайт: нет горизонтальной прокрутки", () => {
  for (const path of publicPages) {
    test(path, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await overflow(page)).toBeLessThanOrEqual(1);
      // every image has loaded (images uploaded to the offline Cloudinary stand-in are 1x1 placeholders and are skipped)
      const broken = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && !i.src.includes('127.0.0.1')).map((i) => i.src));
      expect(broken).toEqual([]);
    });
  }
});

test("навигация: на мобильном бургер-меню, на широких экранах — полное меню", async ({ page }) => {
  await page.goto("/");
  const burger = page.getByRole("button", { name: "Открыть меню" });
  const desktopNav = page.getByRole("navigation", { name: "Основная навигация" });
  if (isMobile(page)) {
    await expect(desktopNav).toBeHidden();
    await burger.click();
    await expect(page.getByRole("button", { name: "Закрыть меню" })).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("navigation", { name: "Мобильная навигация" }).getByRole("link", { name: "Меню" }).click();
    await expect(page).toHaveURL(/\/menu/);
    await expect(page.getByRole("navigation", { name: "Мобильная навигация" })).toBeHidden(); // closes after navigation
  } else {
    await expect(burger).toBeHidden();
    await expect(desktopNav.getByRole("link", { name: "Галерея" })).toBeVisible();
  }
});

test("карточки блюд: колонки зависят от ширины, цена и название видны", async ({ page }) => {
  await page.goto("/menu");
  const cards = page.locator("main a[href^='/menu/']");
  const xs = await cards.evaluateAll((els) => [...new Set(els.slice(0, 6).map((e) => Math.round(e.getBoundingClientRect().x)))].length);
  const width = page.viewportSize()!.width;
  if (width < 640) expect(xs).toBe(1);
  else if (width < 1024) expect(xs).toBe(2);
  else expect(xs).toBe(3);
  await expect(cards.first().getByRole("heading")).toBeVisible();
  await expect(cards.first()).toContainText("₽");
});

test("форма бронирования удобна: поля крупные, время выбирается, кнопка видна", async ({ page }) => {
  await page.goto("/reservation");
  for (const label of ["Имя", "Телефон", "Email", "Дата"]) {
    const box = await page.getByLabel(label).boundingBox();
    expect(box!.height, label).toBeGreaterThanOrEqual(36);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  await expect(page.getByRole("button", { name: "Отправить заявку" })).toBeVisible();
});

test("галерея: фильтры, модальное окно открывается и закрывается (Esc и кнопка)", async ({ page }) => {
  await page.goto("/gallery");
  await page.getByRole("tab", { name: "Интерьер" }).click();
  await expect(page.getByRole("tab", { name: "Интерьер" })).toHaveAttribute("aria-selected", "true");
  const first = page.getByRole("button", { name: /^Открыть:/ }).first();
  await first.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const box = await dialog.locator("img").boundingBox();
  expect(box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await first.click();
  await page.getByRole("button", { name: "Закрыть" }).click();
  await expect(dialog).toBeHidden();
});

test("состояния: пустой результат и 404 адаптивны", async ({ page }) => {
  await page.goto("/menu?q=zzzzzz");
  await expect(page.getByText(/ничего не найдено/)).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(1);
  await page.goto("/no-such-page");
  await expect(page.getByText("Страница не найдена")).toBeVisible();
});

test.describe("административная панель", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  for (const path of adminPages) {
    test(`без горизонтальной прокрутки страницы: ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await overflow(page)).toBeLessThanOrEqual(1);
    });
  }

  test("боковое меню: выезжающее на мобильном/планшете, постоянное на десктопе", async ({ page }) => {
    await page.goto("/admin");
    const nav = page.getByRole("navigation", { name: "Админ-навигация" });
    const width = page.viewportSize()!.width;
    if (width < 1024) {
      await expect(nav).not.toBeInViewport();
      await page.getByRole("button", { name: "Открыть меню" }).click();
      await expect(nav).toBeInViewport();
      await nav.getByRole("link", { name: "Бронирования" }).click();
      await expect(page).toHaveURL(/\/admin\/bookings/);
      await expect(nav).not.toBeInViewport();
    } else {
      await expect(nav).toBeInViewport();
    }
  });

  test("таблицы прокручиваются внутри контейнера, а не ломают страницу", async ({ page }) => {
    await page.goto("/admin/menu");
    const wrapper = page.locator("table").first().locator("xpath=ancestor::div[contains(@class,'overflow-x-auto')][1]");
    await expect(wrapper).toBeVisible();
  });
});
