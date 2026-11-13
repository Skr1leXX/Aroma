import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as s from "../src/db/schema";
import { createReservation, getAvailability } from "../src/services/reservations";
import { guest, nextWeekday, pool, q } from "./support/helpers";

const db = drizzle(pool, { schema: s });
const rejects = async (p: Promise<unknown>) => expect(await p.then(() => "ok", (e: Error) => e.message)).not.toBe("ok");

test.describe("база данных (реальный PostgreSQL)", () => {
  test("подключение и миграции применены", async () => {
    expect((await q<{ v: string }>("select version() v"))[0].v).toMatch(/PostgreSQL/);
    const tables = (await q<{ t: string }>("select table_name t from information_schema.tables where table_schema='public'")).map((r) => r.t);
    for (const t of ["users", "sessions", "accounts", "verifications", "profiles", "user_roles", "menu_categories", "menu_items", "menu_item_images", "reservations", "restaurant_settings", "reviews", "gallery_images", "contact_messages", "audit_log"]) {
      expect(tables, t).toContain(t);
    }
    expect((await q("select 1 from drizzle.__drizzle_migrations")).length).toBe(3);
  });

  test("Drizzle: запись и чтение с типами и связями", async () => {
    const [cat] = await db.select().from(s.menuCategories).limit(1);
    const [item] = await db.insert(s.menuItems).values({ categoryId: cat.id, slug: `drz-${Date.now()}`, name: "Drizzle", description: "проверка записи", price: "123.45", ingredients: ["а", "б"] }).returning();
    expect(item.price).toBe("123.45");
    expect(item.ingredients).toEqual(["а", "б"]);
    expect(item.createdAt).toBeInstanceOf(Date);
    const joined = await db.select({ n: s.menuItems.name, c: s.menuCategories.name }).from(s.menuItems).innerJoin(s.menuCategories, eq(s.menuCategories.id, s.menuItems.categoryId)).where(eq(s.menuItems.id, item.id));
    expect(joined[0].c).toBe(cat.name);
    await db.delete(s.menuItems).where(eq(s.menuItems.id, item.id));
  });

  test("целостность связей: FK, cascade, set null, restrict", async () => {
    const [cat] = await q<{ id: string }>("select id from menu_categories limit 1");
    await rejects(q("insert into menu_items (category_id, slug, name, description, price) values (gen_random_uuid(),'fk-bad','x','y description',1)"));
    await rejects(q("insert into menu_item_images (menu_item_id, url) values (gen_random_uuid(),'u')"));
    await rejects(q("delete from menu_categories where id=$1", [cat.id])); // has dishes

    const [u] = await q<{ id: string }>("insert into users (name, email) values ('FK','fk-test@aroma.test') returning id");
    await q("insert into profiles (user_id, full_name) values ($1,'FK')", [u.id]);
    await q("insert into user_roles (user_id) values ($1)", [u.id]);
    await q("insert into sessions (user_id, token, expires_at) values ($1, gen_random_uuid()::text, now() + interval '1 day')", [u.id]);
    const [r] = await q<{ id: string }>("insert into reservations (user_id, name, phone, email, reservation_date, reservation_time, guests) values ($1,'FK','+7 900 111 22 33','fk@x.y','2031-01-01','12:00',2) returning id", [u.id]);
    await q("delete from users where id=$1", [u.id]);
    expect(await q("select 1 from profiles where user_id=$1", [u.id])).toHaveLength(0); // cascade
    expect(await q("select 1 from sessions where user_id=$1", [u.id])).toHaveLength(0);
    expect((await q<{ user_id: string | null }>("select user_id from reservations where id=$1", [r.id]))[0].user_id).toBeNull(); // set null keeps the booking
  });

  test("ограничения: цена, гости, время, рейтинг, контакт, уникальность, единственное главное фото", async () => {
    const [cat] = await q<{ id: string }>("select id from menu_categories limit 1");
    const mk = (extra: string) => q(`insert into menu_items (category_id, slug, name, description, price) values ('${cat.id}', 'c-${Math.random()}', 'x', 'описание', ${extra})`);
    await rejects(mk("0"));
    await rejects(mk("-5"));
    await rejects(q("insert into reservations (name, phone, email, reservation_date, reservation_time, guests) values ('a','1','a@b.c','2031-01-01','12:00',13)"));
    await rejects(q("insert into reservations (name, phone, email, reservation_date, reservation_time, guests) values ('a','1','a@b.c','2031-01-01','25:61',2)"));
    await rejects(q("insert into reservations (name, phone, email, reservation_date, reservation_time, guests, status) values ('a','1','a@b.c','2031-01-01','12:00',2,'new')")); // old status gone
    await rejects(q("insert into reviews (author, rating, text) values ('a', 9, 't')"));
    await rejects(q("insert into contact_messages (name, message) values ('a','no contact')"));
    await rejects(q("insert into menu_categories (slug, name) values ('desserts','dup')"));
    await rejects(q("insert into restaurant_settings (id, phone, email, address, hours) values (2,'p','e','a','[]')")); // singleton
    const [item] = await q<{ id: string }>("select id from menu_items limit 1");
    await q("insert into menu_item_images (menu_item_id, url, is_primary) values ($1,'p1',true)", [item.id]).catch(() => {});
    await rejects(q("insert into menu_item_images (menu_item_id, url, is_primary) values ($1,'p2',true)", [item.id]));
    await q("delete from menu_item_images where url in ('p1','p2')");
  });

  test("поиск без учёта регистра работает для кириллицы (локаль БД)", async () => {
    expect((await q<{ m: boolean }>("select 'Паста' ilike 'паста' m"))[0].m).toBe(true);
    const found = await q<{ name: string }>("select name from menu_items where name ilike $1", ["%ПЕСТО%"]);
    expect(found.map((d) => d.name)).toContain("Фарфалле с песто и томатами");
  });

  test.describe("конкурентные бронирования", () => {
    test.afterEach(async () => {
      await q("update restaurant_settings set seating_capacity=40, max_concurrent_reservations=12");
    });

    test("30 параллельных заявок на последние места: принято ровно столько, сколько вмещает зал", async () => {
      await q("update restaurant_settings set seating_capacity=16, max_concurrent_reservations=12");
      const date = nextWeekday(2, 20);
      const results = await Promise.all(
        Array.from({ length: 30 }, () => {
          const g = guest("race");
          return createReservation({ name: g.name, phone: g.phone, email: g.email, date, time: "19:00", guests: 4, idempotencyKey: g.key }, {}, db);
        }),
      );
      const accepted = results.filter((r) => r.ok);
      expect(accepted).toHaveLength(4); // 16 seats / 4 guests
      expect(results.filter((r) => !r.ok && r.code === "unavailable")).toHaveLength(26);
      const [{ seats }] = await q<{ seats: string }>("select coalesce(sum(guests),0) seats from reservations where reservation_date=$1 and reservation_time='19:00' and status in ('pending','confirmed')", [date]);
      expect(Number(seats)).toBeLessThanOrEqual(16);
    });

    test("лимит одновременных броней: 20 заявок по 1 гостю при лимите 5", async () => {
      await q("update restaurant_settings set max_concurrent_reservations=5");
      const date = nextWeekday(3, 20);
      const results = await Promise.all(
        Array.from({ length: 20 }, () => {
          const g = guest("par");
          return createReservation({ name: g.name, phone: g.phone, email: g.email, date, time: "13:00", guests: 1, idempotencyKey: g.key }, {}, db);
        }),
      );
      expect(results.filter((r) => r.ok)).toHaveLength(5);
    });

    test("параллельные повторы с одним ключом идемпотентности создают одну бронь", async () => {
      const g = guest("idem");
      const date = nextWeekday(4, 20);
      const results = await Promise.all(Array.from({ length: 8 }, () => createReservation({ name: g.name, phone: g.phone, email: g.email, date, time: "17:00", guests: 2, idempotencyKey: g.key }, {}, db)));
      expect(results.every((r) => r.ok)).toBe(true);
      expect(new Set(results.map((r) => (r.ok ? r.id : ""))).size).toBe(1);
      expect(await q("select 1 from reservations where idempotency_key=$1", [g.key])).toHaveLength(1);
    });

    test("доступность отражает занятость сразу после брони", async () => {
      await q("update restaurant_settings set seating_capacity=4, max_concurrent_reservations=12");
      const date = nextWeekday(1, 25);
      const g = guest("av");
      await createReservation({ name: g.name, phone: g.phone, email: g.email, date, time: "12:00", guests: 4, idempotencyKey: g.key }, {}, db);
      const av = await getAvailability(date, 2, db);
      expect(av.ok && av.slots.find((x) => x.time === "12:00")?.available).toBe(false);
      expect(av.ok && av.slots.find((x) => x.time === "14:00")?.available).toBe(true);
    });
  });
});

test.describe("ошибки соединения с БД (приложение без доступа к базе)", () => {
  const BROKEN = "http://localhost:3201";
  const technical = /ECONN|127\.0\.0\.1|postgres(ql)?:|password|stack|at Object|node_modules|Failed query/i;

  test("форма бронирования деградирует понятно, без технических деталей", async ({ page }) => {
    await page.goto(`${BROKEN}/reservation`);
    await expect(page.getByText("Онлайн-бронирование временно недоступно")).toBeVisible();
    expect(await page.content()).not.toMatch(technical);
  });

  test("API доступности → 503 с общим сообщением", async ({ request }) => {
    const res = await request.get(`${BROKEN}/api/reservations/availability?date=2031-01-07&guests=2`);
    expect(res.status()).toBe(503);
    const text = await res.text();
    expect(JSON.parse(text).error).toBe("Не удалось загрузить доступное время");
    expect(text).not.toMatch(technical);
  });

  test("health: 503 без деталей, когда БД недоступна", async ({ request }) => {
    const res = await request.get(`${BROKEN}/api/health`);
    expect(res.status()).toBe(503);
    expect(await res.json()).toEqual({ status: "degraded", database: "down" });
  });

  test("страница меню показывает аккуратную ошибку с кнопкой повтора", async ({ page }) => {
    await page.goto(`${BROKEN}/menu`);
    await expect(page.getByText("Что-то пошло не так")).toBeVisible();
    await expect(page.getByRole("button", { name: "Повторить" })).toBeVisible();
    expect(await page.content()).not.toMatch(technical);
  });

  test("контактная форма при недоступной БД: общая ошибка, ввод сохраняется", async ({ page }) => {
    await page.goto(`${BROKEN}/contacts`);
    await page.getByLabel("Имя").fill("Аня");
    await page.getByLabel("Email").fill("anya@example.com");
    await page.getByLabel("Сообщение").fill("Сообщение, которое нельзя сохранить");
    await page.getByRole("button", { name: "Отправить" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("Не удалось отправить");
    await expect(page.getByLabel("Сообщение")).toHaveValue("Сообщение, которое нельзя сохранить");
    expect(await page.locator("body").innerText()).not.toMatch(technical);
  });

  test("главная и подвал не падают из-за настроек (используются значения по умолчанию)", async ({ page }) => {
    const res = await page.goto(`${BROKEN}/about`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("contentinfo")).toContainText("Москва");
  });
});
