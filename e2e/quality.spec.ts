import { expect, test, type Page } from "@playwright/test";

const pages = ["/", "/about", "/menu", "/menu/panna-cotta", "/gallery", "/contacts", "/reservation", "/login", "/register", "/forgot-password"];

/** Collects console errors, uncaught exceptions and failed/4xx/5xx responses from the app's own origin. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => problems.push(`failed: ${r.url()} ${r.failure()?.errorText}`));
  page.on("response", (r) => r.status() >= 400 && problems.push(`${r.status()}: ${r.url()}`));
  return problems;
}

test.describe("ошибки консоли и сети", () => {
  for (const path of pages) {
    test(path, async ({ page }) => {
      const problems = watch(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(problems).toEqual([]);
    });
  }

  test("админка (под администратором)", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "e2e/.auth/admin.json" });
    const page = await ctx.newPage();
    const problems = watch(page);
    for (const path of ["/admin", "/admin/bookings", "/admin/menu", "/admin/categories", "/admin/gallery", "/admin/reviews", "/admin/settings", "/admin/audit"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    expect(problems).toEqual([]);
    await ctx.close();
  });
});

test("health: 200 и только статус", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ status: "ok", database: "up" });
});

test.describe("производительность", () => {
  test("изображения оптимизируются Next.js: webp/avif, srcset, lazy вне первого экрана", async ({ page }) => {
    const optimized: { url: string; type: string; bytes: number }[] = [];
    page.on("response", async (r) => {
      if (r.url().includes("/_next/image")) optimized.push({ url: r.url(), type: r.headers()["content-type"] ?? "", bytes: (await r.body().catch(() => Buffer.alloc(0))).length });
    });
    await page.goto("/menu");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForLoadState("networkidle");

    const imgs = await page.locator("main img:not([src$='.svg'])").evaluateAll((els) => (els as HTMLImageElement[]).map((i) => ({ src: i.currentSrc || i.src, srcset: i.srcset, loading: i.loading })));
    expect(imgs.length).toBeGreaterThan(10);
    for (const i of imgs) {
      expect(i.src).toContain("/_next/image");
      expect(i.srcset).not.toBe("");
    }
    expect(imgs.filter((i) => i.loading === "lazy").length).toBeGreaterThan(5);
    expect(optimized.length).toBeGreaterThan(5);
    expect(optimized.every((o) => /image\/(webp|avif|jpeg)/.test(o.type))).toBe(true);
    expect(optimized.some((o) => /webp|avif/.test(o.type))).toBe(true);
    const heaviest = Math.max(...optimized.map((o) => o.bytes));
    expect(heaviest).toBeLessThan(400_000);
  });

  for (const [path, maxRequests] of [["/", 70], ["/menu", 70], ["/reservation", 40], ["/admin", 60]] as const) {
    test(`число запросов и скорость: ${path}`, async ({ browser }) => {
      const ctx = await browser.newContext(path.startsWith("/admin") ? { storageState: "e2e/.auth/admin.json" } : {});
      const page = await ctx.newPage();
      let requests = 0;
      page.on("request", () => requests++);
      const start = Date.now();
      await page.goto(path, { waitUntil: "domcontentloaded" });
      const dcl = Date.now() - start;
      await page.waitForLoadState("networkidle");
      expect(requests, "requests").toBeLessThan(maxRequests);
      expect(dcl, "DOMContentLoaded ms").toBeLessThan(3000);
      const timing = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        return { ttfb: nav.responseStart - nav.requestStart, transfer: performance.getEntriesByType("resource").reduce((s, r) => s + ((r as PerformanceResourceTiming).transferSize || 0), 0) };
      });
      expect(timing.ttfb, "TTFB ms").toBeLessThan(1500);
      expect(timing.transfer, "transferred bytes").toBeLessThan(4_000_000);
      await ctx.close();
    });
  }

  test("доступность: у всех изображений есть alt, у кнопок-иконок — подписи", async ({ page }) => {
    for (const path of ["/", "/menu", "/gallery", "/reservation"]) {
      await page.goto(path);
      const noAlt = await page.locator("img:not([alt])").count();
      expect(noAlt, `${path}: img without alt`).toBe(0);
      const unnamed = await page.locator("button, a").evaluateAll((els) =>
        els.filter((e) => !(e.textContent ?? "").trim() && !e.getAttribute("aria-label") && !e.getAttribute("title")).map((e) => e.outerHTML.slice(0, 80)));
      expect(unnamed, `${path}: unnamed controls`).toEqual([]);
      expect(await page.locator("h1").count(), `${path}: exactly one h1`).toBe(1);
    }
  });
});
