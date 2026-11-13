import { expect, test, request as pwRequest } from "@playwright/test";
import { guest, PNG, q } from "./support/helpers";

const BASE = "http://localhost:3200";
const anonymous = { cookies: [], origins: [] };
const origin = { Origin: BASE };

// Better Auth rate-limits sign-up/sign-in per IP (429). That is desired in production, so tests wait it out.
async function signUp(email: string, extra: Record<string, unknown> = {}) {
  const ctx = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: origin });
  for (let attempt = 0; ; attempt++) {
    const res = await ctx.post("/api/auth/sign-up/email", { data: { name: "Новый", email, password: "very-long-password-1", ...extra } });
    if (res.status() !== 429 || attempt >= 3) return { ctx, res };
    await new Promise((r) => setTimeout(r, 11_000));
  }
}
const roleOf = async (email: string) => (await q<{ role: string }>("select r.role from user_roles r join users u on u.id=r.user_id where u.email=$1", [email]))[0]?.role;

test.describe("авторизация (Better Auth)", () => {
  test.use({ storageState: anonymous });

  test("регистрация через форму создаёт customer с профилем; админка недоступна", async ({ page }) => {
    const email = `reg-${Date.now()}@aroma.test`;
    await page.goto("/register");
    await page.getByLabel("Имя").fill("Регистрант");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Пароль", { exact: true }).fill("registrant-pass-1");
    await page.getByLabel("Повторите пароль").fill("registrant-pass-1");
    await page.getByRole("button", { name: "Создать аккаунт" }).click();
    await expect(page).toHaveURL(/\/account/);
    expect(await roleOf(email)).toBe("customer");
    expect(await q("select 1 from profiles p join users u on u.id=p.user_id where u.email=$1", [email])).toHaveLength(1);
    await page.goto("/admin");
    await expect(page).toHaveURL("http://localhost:3200/");
  });

  test("регистрация: слабый пароль и несовпадение паролей отклоняются", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Имя").fill("Х Y");
    await page.getByLabel("Email").fill("weak@aroma.test");
    await page.getByLabel("Пароль", { exact: true }).fill("short");
    await page.getByLabel("Повторите пароль").fill("different");
    await page.getByRole("button", { name: "Создать аккаунт" }).click();
    await expect(page.getByText("Не менее 8 символов")).toBeVisible();
    await expect(page.getByText("Пароли не совпадают")).toBeVisible();
    expect(await q("select 1 from users where email='weak@aroma.test'")).toHaveLength(0);
  });

  test("нельзя назначить себе admin: лишние поля в запросе регистрации игнорируются", async () => {
    for (const [i, extra] of [{ role: "admin" }, { roles: ["admin"] }, { user_roles: { role: "admin" } }, { isAdmin: true }].entries()) {
      const email = `evil-${Date.now()}-${i}@aroma.test`;
      const { ctx, res } = await signUp(email, extra);
      expect(res.status()).toBe(200);
      expect(await roleOf(email)).toBe("customer");
      await ctx.dispose();
    }
  });

  test("обычный пользователь не может вызвать админские операции: API и server actions", async ({ browser }) => {
    const email = `cust-${Date.now()}@aroma.test`;
    const { ctx } = await signUp(email);
    // image API
    for (const [method, url] of [["POST", "/api/admin/images"], ["PUT", "/api/admin/images"], ["DELETE", "/api/admin/images?target=gallery&id=00000000-0000-4000-8000-000000000000"]] as const) {
      const res = await ctx.fetch(url, { method, multipart: method === "DELETE" ? undefined : { target: "gallery", file: { name: "a.png", mimeType: "image/png", buffer: PNG } } });
      expect(res.status(), `${method} ${url}`).toBe(403);
    }

    // capture a real server-action call made by the admin, then replay it with the customer's cookies
    const adminCtx = await browser.newContext({ storageState: "e2e/.auth/admin.json" });
    const page = await adminCtx.newPage();
    await page.goto("/admin/reviews");
    const card = page.locator("li", { hasText: "Рёбра — просто огонь" });
    const [req] = await Promise.all([
      page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]),
      card.getByRole("button", { name: "Опубликовать" }).click(),
    ]);
    await expect.poll(async () => (await q<{ a: boolean }>("select is_approved a from reviews where author='Игорь М.'"))[0].a).toBe(true);
    await q("update reviews set is_approved=false where author='Игорь М.'");

    const replay = await ctx.post("/admin/reviews", { headers: { "next-action": req.headers()["next-action"], "content-type": req.headers()["content-type"] ?? "text/plain;charset=UTF-8" }, data: req.postData() ?? "" });
    expect(await replay.text()).toContain("Нет доступа");
    expect((await q<{ a: boolean }>("select is_approved a from reviews where author='Игорь М.'"))[0].a).toBe(false);

    // and without any session at all
    const anon = await pwRequest.newContext({ baseURL: BASE });
    const replay2 = await anon.post("/admin/reviews", { headers: { "next-action": req.headers()["next-action"], "content-type": req.headers()["content-type"] ?? "text/plain;charset=UTF-8" }, data: req.postData() ?? "" });
    expect(await replay2.text()).toContain("Нет доступа");
    expect((await q<{ a: boolean }>("select is_approved a from reviews where author='Игорь М.'"))[0].a).toBe(false);
    await adminCtx.close();
    await ctx.dispose();
    await anon.dispose();
  });

  test("истечение сессии: просроченная сессия не даёт доступ к кабинету", async ({ browser }) => {
    const email = `exp-${Date.now()}@aroma.test`;
    const { ctx } = await signUp(email);
    const state = await ctx.storageState();
    const context = await browser.newContext({ storageState: state });
    const page = await context.newPage();
    await page.goto("/account");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Новый");

    await q("update sessions set expires_at = now() - interval '1 hour' where user_id = (select id from users where email=$1)", [email]);
    await page.reload();
    await expect(page).toHaveURL(/\/login/);
    await context.close();
    await ctx.dispose();
  });

  test("выход инвалидирует сессию на сервере (старая cookie не работает)", async ({ browser }) => {
    const email = `out-${Date.now()}@aroma.test`;
    const { ctx } = await signUp(email);
    const state = await ctx.storageState();
    const context = await browser.newContext({ storageState: state });
    const page = await context.newPage();
    await page.goto("/account");
    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(page).toHaveURL("http://localhost:3200/");
    expect(await q("select 1 from sessions where user_id=(select id from users where email=$1)", [email])).toHaveLength(0);

    const replay = await browser.newContext({ storageState: state }); // the stolen/old cookie
    const p2 = await replay.newPage();
    await p2.goto("/account");
    await expect(p2).toHaveURL(/\/login/);
    await context.close();
    await replay.close();
    await ctx.dispose();
  });

  test("восстановление пароля: без раскрытия существования аккаунта, ссылка одноразовая", async ({ page }) => {
    const email = `reset-${Date.now()}@aroma.test`;
    const { ctx } = await signUp(email);
    await ctx.dispose();

    const msg = "Если такой аккаунт существует";
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("nobody-here@aroma.test");
    await page.getByRole("button", { name: "Отправить ссылку" }).click();
    await expect(page.getByRole("status")).toContainText(msg);
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Отправить ссылку" }).click();
    await expect(page.getByRole("status")).toContainText(msg); // identical answer

    // no mail provider is configured, so read the token Better Auth stored for the reset
    const [v] = await q<{ identifier: string }>("select identifier from verifications where identifier like 'reset-password:%' order by created_at desc limit 1");
    const token = v.identifier.split(":")[1];
    await page.goto(`/reset-password?token=${token}`);
    await page.getByLabel("Новый пароль").fill("brand-new-password-2");
    await page.getByRole("button", { name: "Сохранить пароль" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto(`/reset-password?token=${token}`);
    await page.getByLabel("Новый пароль").fill("another-password-3");
    await page.getByRole("button", { name: "Сохранить пароль" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("недействительна");

    const login = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: origin });
    expect((await login.post("/api/auth/sign-in/email", { data: { email, password: "very-long-password-1" } })).status()).toBe(401);
    expect((await login.post("/api/auth/sign-in/email", { data: { email, password: "brand-new-password-2" } })).status()).toBe(200);
    await login.dispose();
  });
});

test.describe("безопасность API", () => {
  test.use({ storageState: anonymous });

  test("анонимные вызовы админского API → 403, а не 500", async ({ request }) => {
    expect((await request.post("/api/admin/images", { multipart: { target: "gallery" } })).status()).toBe(403);
    expect((await request.delete("/api/admin/images?target=gallery&id=x")).status()).toBe(403);
  });

  test.describe("администратор", () => {
    test.use({ storageState: "e2e/.auth/admin.json" });
    test("валидация API загрузки: цель, id, файл", async ({ request }) => {
      const png = { name: "a.png", mimeType: "image/png", buffer: PNG };
      expect((await request.post("/api/admin/images", { multipart: { target: "nope", file: png } })).status()).toBe(400);
      expect((await request.post("/api/admin/images", { multipart: { target: "gallery", alt: "x", group: "dishes" } })).status()).toBe(400); // no file
      expect((await request.post("/api/admin/images", { multipart: { target: "gallery", alt: "ok", group: "hacker", file: png } })).status()).toBe(400);
      expect((await request.post("/api/admin/images", { multipart: { target: "gallery", alt: "ok", group: "dishes", file: { name: "a.png", mimeType: "image/png", buffer: Buffer.from("MZ not an image") } } })).status()).toBe(400);
      expect((await request.post("/api/admin/images", { multipart: { target: "gallery", alt: "ok", group: "dishes", file: { name: "big.png", mimeType: "image/png", buffer: Buffer.concat([PNG, Buffer.alloc(9 * 1024 * 1024)]) } } })).status()).toBe(400);
      expect((await request.put("/api/admin/images", { multipart: { target: "gallery", id: "not-a-uuid", file: png } })).status()).toBe(400);
      expect((await request.delete("/api/admin/images?target=gallery&id=00000000-0000-4000-8000-000000000000")).status()).toBe(404);
    });
  });

  test("API доступности: строгая валидация параметров, нет утечки деталей", async ({ request }) => {
    for (const qs of ["", "date=2030-01-01", "date=2030-01-01&guests=0", "date=2030-01-01&guests=999", "date=%27%3B%20drop%20table%20users;--&guests=2", "date=2030-02-31&guests=2"]) {
      const res = await request.get(`/api/reservations/availability?${qs}`);
      expect([200, 400], qs).toContain(res.status());
      expect(await res.text()).not.toMatch(/select |postgres|stack|ECONN/i);
    }
  });

  test("ни один секрет не попадает в HTML и клиентские бандлы", async ({ page }) => {
    const secrets = ["e2e-api-secret-do-not-leak", "e2e-secret-0123456789abcdef", "postgres:postgres@", "DATABASE_URL"];
    const seen = new Set<string>();
    const bodies: string[] = [];
    page.on("response", async (r) => {
      const url = r.url();
      if (!url.startsWith(BASE) || seen.has(url)) return;
      seen.add(url);
      const type = r.headers()["content-type"] ?? "";
      if (/javascript|html|json|x-component/.test(type)) bodies.push(await r.text().catch(() => ""));
    });
    for (const path of ["/", "/menu", "/reservation", "/login", "/register", "/contacts"]) await page.goto(path);
    await page.goto("/api/auth/get-session");
    expect(bodies.length).toBeGreaterThan(10);
    for (const s of secrets) expect(bodies.some((b) => b.includes(s)), `leak: ${s}`).toBe(false);
  });

  test("ответ сессии не содержит хэшей паролей", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "e2e/.auth/customer.json" });
    const res = await ctx.request.get("/api/auth/get-session");
    const text = await res.text();
    expect(text).toContain("guest@aroma.test");
    expect(text).not.toMatch(/password|scrypt|\$argon|hash/i);
    await ctx.close();
  });

  test("security-заголовки и отсутствие X-Powered-By", async ({ request }) => {
    const h = (await request.get("/")).headers();
    expect(h["x-powered-by"]).toBeUndefined();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBeTruthy();
  });

  test("ошибки контактной формы не раскрывают техническую информацию", async ({ page }) => {
    const g = guest("lim");
    for (let i = 0; i < 4; i++) {
      await page.goto("/contacts");
      await page.getByLabel("Имя").fill(g.name);
      await page.getByLabel("Email").fill(g.email);
      await page.getByLabel("Сообщение").fill(`Сообщение номер ${i} для проверки лимита`);
      await page.route("**/contacts", (route) => route.continue({ headers: { ...route.request().headers(), "x-forwarded-for": "198.51.100.9" } }), { times: 1 });
      await page.getByRole("button", { name: "Отправить" }).click();
      await page.waitForTimeout(400);
    }
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/postgres|select |ECONN|stack/i);
  });
});
