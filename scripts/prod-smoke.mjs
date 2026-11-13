// Smoke test against the deployed site (real Neon + Vercel). Creates tagged demo rows and removes them afterwards.
//   node scripts/prod-smoke.mjs https://aroma-black-kappa.vercel.app admin@example.com 'password'
import { chromium } from "@playwright/test";

const [base, email, password] = process.argv.slice(2);
const tag = `SMOKE-${Date.now().toString(36)}`;
const problems = [];
const ok = (name, cond, extra = "") => console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`) || (!cond && problems.push(name));

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: "ru-RU", timezoneId: "Europe/Moscow", viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));

// --- public pages + images
for (const p of ["/", "/menu", "/menu/panna-cotta", "/gallery", "/contacts", "/reservation"]) {
  const res = await page.goto(base + p, { waitUntil: "networkidle" });
  ok(`open ${p}`, res.status() === 200);
}
await page.goto(base + "/menu", { waitUntil: "networkidle" });
const broken = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length);
ok("menu images load (Unsplash via /_next/image)", broken === 0, `${broken} broken`);

// --- booking (uses the WebSocket transaction path on Vercel)
const d = new Date(Date.now() + 9 * 864e5);
while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1);
const date = d.toISOString().slice(0, 10);
await page.goto(base + "/reservation", { waitUntil: "networkidle" });
await page.getByLabel("Имя").fill(`Демо ${tag}`);
await page.getByLabel("Телефон").fill(`+7 900 ${String(Date.now()).slice(-3)} ${String(Date.now()).slice(-5, -3)}-${String(Date.now()).slice(-7, -5)}`);
await page.getByLabel("Email").fill(`${tag.toLowerCase()}@example.com`);
await page.getByLabel("Дата").fill(date);
await page.getByRole("radiogroup", { name: "Время" }).locator("label", { hasText: /^19:00$/ }).click();
await page.getByRole("button", { name: "Отправить заявку" }).click();
await page.waitForURL(/reservation\/success/, { timeout: 30000 }).catch(() => {});
ok("booking saved on Neon (success page)", /reservation\/success\?id=/.test(page.url()), page.url().replace(base, ""));
if (!/success/.test(page.url())) console.log("   page says:", (await page.locator("body").innerText()).slice(0, 300).replace(/\n/g, " "));

// --- contact form
await page.goto(base + "/contacts", { waitUntil: "networkidle" });
await page.getByLabel("Имя").fill(`Демо ${tag}`);
await page.getByLabel("Email").fill(`${tag.toLowerCase()}@example.com`);
await page.getByLabel("Сообщение").fill(`Тестовое сообщение ${tag}, проверка формы`);
await page.getByRole("button", { name: "Отправить" }).click();
await page.getByRole("status").waitFor({ timeout: 20000 }).catch(() => {});
ok("contact message saved", /Сообщение получено/.test(await page.locator("body").innerText()));

// --- admin
await page.goto(base + "/login", { waitUntil: "networkidle" });
await page.getByLabel("Email").fill(email);
await page.getByLabel("Пароль").fill(password);
await page.getByRole("button", { name: "Войти" }).click();
await page.waitForURL(/account/, { timeout: 30000 }).catch(() => {});
ok("admin login", /account/.test(page.url()));
await page.goto(base + `/admin/bookings?q=${encodeURIComponent(tag)}`, { waitUntil: "networkidle" });
ok("booking visible in admin", await page.getByText(`Демо ${tag}`).first().isVisible().catch(() => false));
await page.locator("table").getByRole("link", { name: "Открыть" }).first().click();
await page.getByRole("button", { name: "Подтвердить" }).click();
await page.getByText("Подтверждена").first().waitFor({ timeout: 20000 }).catch(() => {});
ok("admin confirms booking", await page.getByText("Подтверждена").first().isVisible().catch(() => false));
await page.goto(base + "/admin", { waitUntil: "networkidle" });
ok("dashboard renders", await page.getByRole("heading", { name: "Бронирования по дням" }).isVisible());
await page.goto(base + "/admin/audit", { waitUntil: "networkidle" });
ok("audit log has the status change", (await page.locator("body").innerText()).includes("reservation.status"));

ok("no console/network errors", errors.length === 0, errors.slice(0, 4).join(" | "));
await browser.close();
console.log(problems.length ? `\n${problems.length} FAILED` : "\nAll smoke checks passed");
console.log("TAG", tag);
process.exit(problems.length ? 1 : 0);
