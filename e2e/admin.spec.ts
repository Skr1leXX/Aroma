import { expect, test, type Page } from "@playwright/test";
import { ADMIN } from "./support/pg-server";
import { guest, nextWeekday, PNG, q } from "./support/helpers";

const anonymous = { cookies: [], origins: [] };
const stamp = () => Date.now().toString(36);

test.describe("защита приватных страниц", () => {
  test.use({ storageState: anonymous });
  for (const path of ["/admin", "/admin/bookings", "/admin/menu", "/admin/menu/new", "/admin/categories", "/admin/gallery", "/admin/reviews", "/admin/settings", "/admin/audit", "/account"]) {
    test(`аноним: ${path} → /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    });
  }
});

test.describe("обычный пользователь", () => {
  test.use({ storageState: "e2e/.auth/customer.json" });
  test("видит кабинет, но не админку и без ссылки на неё", async ({ page }) => {
    await page.goto("/account");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Гость Тест");
    await expect(page.getByRole("link", { name: "Админ-панель" })).toHaveCount(0);
    for (const path of ["/admin", "/admin/settings", "/admin/audit", "/admin/bookings"]) {
      await page.goto(path);
      await expect(page).toHaveURL("http://localhost:3200/");
    }
  });
});

test.describe("вход и выход администратора", () => {
  test.use({ storageState: anonymous });
  test("неверный пароль → ошибка, верный → кабинет, выход закрывает админку", async ({ page }) => {
    await page.waitForTimeout(10_500); // Better Auth allows 3 sign-ins / 10 s per IP
    await page.goto("/login");
    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Пароль").fill("wrong-password");
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("Неверный email или пароль");

    await page.getByLabel("Пароль").fill(ADMIN.password);
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page).toHaveURL(/\/account/);
    await page.getByRole("link", { name: "Админ-панель" }).click();
    await expect(page.getByRole("heading", { name: "Бронирования по дням" })).toBeVisible();

    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(page).toHaveURL("http://localhost:3200/");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("панель администратора", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("dashboard: числа совпадают с БД", async ({ page }) => {
    await page.goto("/admin");
    const [{ c: dishes }] = await q<{ c: string }>("select count(*) c from menu_items");
    const [{ c: cats }] = await q<{ c: string }>("select count(*) c from menu_categories");
    const [{ c: pending }] = await q<{ c: string }>("select count(*) c from reservations where status='pending' and reservation_date >= (now() at time zone 'Europe/Moscow')::date");
    await expect(page.getByText("Категорий", { exact: true }).locator("xpath=preceding-sibling::p")).toHaveText(cats);
    await expect(page.getByText(/^Блюд \(в меню/).locator("xpath=preceding-sibling::p")).toHaveText(dishes);
    await expect(page.getByText("Ждут подтверждения").locator("xpath=preceding-sibling::p")).toHaveText(pending);
    await expect(page.getByRole("heading", { name: "Последние бронирования" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Популярные блюда" })).toBeVisible();
    await expect(page.locator("ol li[title]")).toHaveCount(14); // chart bars
  });

  test.describe("блюда: создание, редактирование, удаление", () => {
    const name = `Тест-блюдо ${stamp()}`;
    let id = "";

    test("создание", async ({ page }) => {
      await page.goto("/admin/menu/new");
      await page.getByLabel("Название").fill(name);
      await page.getByLabel("Категория").selectOption({ label: "Горячее" });
      await page.getByLabel("Цена, ₽").fill("555");
      await page.getByLabel("Вес / объём").fill("250 г");
      await page.getByLabel("Описание").fill("Тестовое описание блюда для проверки");
      await page.getByLabel("Состав (через запятую)").fill("мясо, соль");
      await page.getByLabel("Популярное блюдо").check();
      await page.getByRole("button", { name: "Создать блюдо" }).click();
      await expect(page).toHaveURL(/\/admin\/menu\/[0-9a-f-]{36}$/);
      id = page.url().split("/").pop()!;
      const [row] = await q<{ price: string; slug: string; ingredients: string[]; is_popular: boolean; is_available: boolean }>("select price, slug, ingredients, is_popular, is_available from menu_items where id=$1", [id]);
      expect(row).toMatchObject({ price: "555.00", ingredients: ["мясо", "соль"], is_popular: true, is_available: true });
      expect(row.slug).toMatch(/^test-blyudo-/);
      await page.goto(`/menu/${row.slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    });

    test("создание: ошибки валидации не сохраняют блюдо", async ({ page }) => {
      const before = (await q<{ c: string }>("select count(*) c from menu_items"))[0].c;
      await page.goto("/admin/menu/new");
      await page.getByLabel("Название").fill("Х");
      await page.getByLabel("Категория").selectOption({ label: "Горячее" });
      await page.getByLabel("Цена, ₽").fill("-5");
      await page.getByLabel("Описание").fill("достаточно длинное описание");
      await page.getByRole("button", { name: "Создать блюдо" }).evaluate((b: HTMLButtonElement) => b.form!.noValidate = true);
      await page.getByRole("button", { name: "Создать блюдо" }).click();
      await expect(page.getByText("Проверьте поля формы")).toBeVisible();
      expect((await q<{ c: string }>("select count(*) c from menu_items"))[0].c).toBe(before);
    });

    test("редактирование + журнал", async ({ page }) => {
      await page.goto(`/admin/menu/${id}`);
      await page.getByLabel("Цена, ₽").fill("600");
      await page.getByLabel("Показывать в меню").uncheck();
      await page.getByRole("button", { name: "Сохранить", exact: true }).click();
      await expect(page.getByText("Изменения сохранены")).toBeVisible();
      const [row] = await q<{ price: string; is_available: boolean }>("select price, is_available from menu_items where id=$1", [id]);
      expect(row).toMatchObject({ price: "600.00", is_available: false });
      const [log] = await q<{ details: Record<string, unknown>; user_email: string }>("select details, user_email from audit_log where action='menu_item.update' and entity_id=$1 order by created_at desc limit 1", [id]);
      expect(log.user_email).toBe(ADMIN.email);
      expect(log.details.price).toEqual(["555.00", "600.00"]);
      // hidden dish is not public any more
      const slug = (await q<{ slug: string }>("select slug from menu_items where id=$1", [id]))[0].slug;
      expect((await page.goto(`/menu/${slug}`))?.status()).toBe(404);
    });

    test("удаление с подтверждением", async ({ page }) => {
      await page.goto("/admin/menu");
      await page.getByLabel("Поиск блюда").fill(name);
      page.once("dialog", (d) => d.dismiss());
      await page.getByRole("button", { name: `Удалить ${name}` }).click();
      expect(await q("select 1 from menu_items where id=$1", [id])).toHaveLength(1); // cancelled -> still there
      page.once("dialog", (d) => d.accept());
      await page.getByRole("button", { name: `Удалить ${name}` }).click();
      await expect(page.getByText(name)).toHaveCount(0);
      expect(await q("select 1 from menu_items where id=$1", [id])).toHaveLength(0);
      expect((await q("select 1 from audit_log where action='menu_item.delete' and entity_id=$1", [id])).length).toBe(1);
    });
  });

  test("категории: создание, правка, порядок, защита от удаления с блюдами", async ({ page }) => {
    const name = `Тест-кат ${stamp()}`;
    await page.goto("/admin/categories");
    await page.getByLabel("Новая категория").fill(name);
    await page.getByRole("button", { name: "Добавить" }).click();
    await expect(page.getByText("Категория добавлена")).toBeVisible();
    const [cat] = await q<{ id: string; sort_order: number }>("select id, sort_order from menu_categories where name=$1", [name]);
    expect(cat.sort_order).toBeGreaterThanOrEqual(6);

    const row = page.locator("li", { has: page.locator(`input[value="${name}"]`) });
    await row.getByRole("button", { name: "Выше" }).click();
    await expect.poll(async () => (await q<{ sort_order: number }>("select sort_order from menu_categories where id=$1", [cat.id]))[0].sort_order).toBeLessThan(cat.sort_order);

    // category with dishes: delete is disabled in the UI and refused by the server
    const pasta = page.locator("li", { has: page.locator('input[value="Паста"]') });
    await expect(pasta.getByRole("button", { name: "Удалить Паста" })).toBeDisabled();

    page.once("dialog", (d) => d.accept());
    await row.getByRole("button", { name: `Удалить ${name}` }).click();
    await expect.poll(async () => (await q("select 1 from menu_categories where id=$1", [cat.id])).length).toBe(0);
  });

  test("бронирование: просмотр, подтверждение, отклонение, перенос, комментарий", async ({ page }) => {
    const g = guest("adm");
    const date = nextWeekday(2, 15);
    const [b] = await q<{ id: string }>("insert into reservations (name, phone, email, reservation_date, reservation_time, guests) values ($1,$2,$3,$4,'18:00',3) returning id", [g.name, g.phone, g.email, date]);

    await page.goto(`/admin/bookings?q=${encodeURIComponent(g.email.slice(0, 10))}`);
    await expect(page.getByText("Найдено: 0")).toBeVisible(); // search is by name/phone only
    await page.goto(`/admin/bookings?q=${encodeURIComponent(g.name)}&status=pending`);
    await page.getByRole("row", { name: new RegExp(g.phone.replace(/[+()]/g, "\\$&")) }).getByRole("link", { name: "Открыть" }).click();
    await expect(page).toHaveURL(new RegExp(b.id));
    await expect(page.getByText(g.email)).toBeVisible();
    await expect(page.getByText("Ожидает")).toBeVisible();

    await page.getByRole("button", { name: "Подтвердить" }).click();
    await expect(page.getByText("Подтверждена")).toBeVisible();
    expect((await q<{ status: string }>("select status from reservations where id=$1", [b.id]))[0].status).toBe("confirmed");

    await page.getByLabel("Время").fill("15:00");
    await page.getByRole("button", { name: "Перенести" }).click();
    await expect(page.getByText("Бронь перенесена")).toBeVisible();
    expect((await q<{ t: string }>("select reservation_time t from reservations where id=$1", [b.id]))[0].t).toBe("15:00");

    await page.getByLabel("Время").fill("23:00"); // not a valid start (closes at 23:00, 2 h stay)
    await page.getByRole("button", { name: "Перенести" }).click();
    await expect(page.getByText(/вне графика/)).toBeVisible();

    await page.getByLabel("Комментарий администратора").fill("VIP, столик у окна");
    await page.getByRole("button", { name: "Сохранить комментарий" }).click();
    await expect(page.getByText("Комментарий сохранён")).toBeVisible();
    expect((await q<{ n: string }>("select admin_note n from reservations where id=$1", [b.id]))[0].n).toBe("VIP, столик у окна");

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Отменить бронь" }).click();
    await expect(page.getByText("Бронь закрыта")).toBeVisible();
    const actions = (await q<{ action: string }>("select action from audit_log where entity_id=$1 order by created_at", [b.id])).map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["reservation.status", "reservation.reschedule", "reservation.note"]));

    // second booking: reject
    const g2 = guest("adm2");
    const [b2] = await q<{ id: string }>("insert into reservations (name, phone, email, reservation_date, reservation_time, guests) values ($1,$2,$3,$4,'19:00',2) returning id", [g2.name, g2.phone, g2.email, date]);
    await page.goto(`/admin/bookings/${b2.id}`);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Отклонить" }).click();
    await expect(page.getByText("Отклонена").first()).toBeVisible();
    expect((await q<{ status: string }>("select status from reservations where id=$1", [b2.id]))[0].status).toBe("rejected");
  });

  test("брони: фильтры по статусу и дате", async ({ page }) => {
    const g = guest("flt");
    const date = nextWeekday(0, 40);
    await q("insert into reservations (name, phone, email, reservation_date, reservation_time, guests, status) values ($1,$2,$3,$4,'13:00',2,'confirmed')", [g.name, g.phone, g.email, date]);
    await page.goto(`/admin/bookings?status=confirmed&from=${date}&to=${date}`);
    await expect(page.getByText("Найдено: 1")).toBeVisible();
    await page.goto(`/admin/bookings?status=pending&from=${date}&to=${date}`);
    await expect(page.getByText("Ничего не найдено")).toBeVisible();
    await page.goto(`/admin/bookings?q=${encodeURIComponent(g.phone.replace(/\D/g, "").slice(1, 9))}`);
    await expect(page.getByText("Найдено: 1")).toBeVisible(); // phone digits match regardless of formatting
  });

  test.describe("изображения (Cloudinary)", () => {
    async function dishWithoutPhotos() {
      const [cat] = await q<{ id: string }>("select id from menu_categories limit 1");
      const [row] = await q<{ id: string }>("insert into menu_items (category_id, slug, name, description, price) values ($1,$2,'Фото-тест','описание для фото',100) returning id", [cat.id, `photo-${stamp()}`]);
      return row.id;
    }
    const upload = (page: Page, file: { name: string; mimeType: string; buffer: Buffer }) =>
      page.getByLabel("Добавить фото").setInputFiles(file);

    test("загрузка, главное фото, замена, удаление", async ({ page }) => {
      const id = await dishWithoutPhotos();
      await page.goto(`/admin/menu/${id}`);
      await upload(page, { name: "a.png", mimeType: "image/png", buffer: PNG });
      await expect(page.getByText("Главное")).toBeVisible();
      let rows = await q<{ id: string; url: string; public_id: string; is_primary: boolean; width: number }>("select id, url, public_id, is_primary, width from menu_item_images where menu_item_id=$1", [id]);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ is_primary: true, width: 800 });
      expect(rows[0].public_id).toMatch(/^aroma\/dishes\/fake_/);
      expect(rows[0].url).toContain("127.0.0.1:54330");

      await upload(page, { name: "b.png", mimeType: "image/png", buffer: PNG });
      await expect.poll(async () => (await q("select 1 from menu_item_images where menu_item_id=$1", [id])).length).toBe(2);
      rows = await q("select id, url, public_id, is_primary, width from menu_item_images where menu_item_id=$1 order by sort_order", [id]);
      await expect(page.getByRole("button", { name: "Сделать главным" })).toHaveCount(2); // wait for the UI refresh, not just the DB
      await page.getByRole("button", { name: "Сделать главным" }).last().click();
      await expect.poll(async () => (await q<{ id: string }>("select id from menu_item_images where menu_item_id=$1 and is_primary", [id]))[0].id).toBe(rows[1].id);

      // replace the first image
      page.once("filechooser", (fc) => fc.setFiles({ name: "c.png", mimeType: "image/png", buffer: PNG }));
      await page.getByRole("button", { name: "Заменить файл" }).first().click();
      await expect.poll(async () => (await q<{ public_id: string }>("select public_id from menu_item_images where id=$1", [rows[0].id]))[0].public_id).not.toBe(rows[0].public_id);

      // delete the primary: the other image is promoted
      page.on("dialog", (d) => d.accept());
      await page.getByRole("button", { name: "Удалить фото" }).last().click();
      await expect.poll(async () => (await q("select 1 from menu_item_images where menu_item_id=$1", [id])).length).toBe(1);
      expect((await q("select 1 from menu_item_images where menu_item_id=$1 and is_primary", [id])).length).toBe(1);
    });

    test("неподдерживаемый формат и слишком большой файл отклоняются", async ({ page }) => {
      const id = await dishWithoutPhotos();
      await page.goto(`/admin/menu/${id}`);
      // client-side size check
      await upload(page, { name: "big.png", mimeType: "image/png", buffer: Buffer.concat([PNG, Buffer.alloc(9 * 1024 * 1024)]) });
      await expect(page.locator("p[role=alert]")).toContainText("Файл больше 8 МБ");
      // a text file pretending to be an image: the server checks magic bytes, not the extension
      await upload(page, { name: "fake.png", mimeType: "image/png", buffer: Buffer.from("this is not an image at all") });
      await expect(page.locator("p[role=alert]")).toContainText("Допустимы только JPEG, PNG, WebP и AVIF");
      expect(await q("select 1 from menu_item_images where menu_item_id=$1", [id])).toHaveLength(0);
    });

    test("галерея: загрузка, порядок, главное фото, замена, удаление", async ({ page }) => {
      await page.goto("/admin/gallery");
      const alt = `E2E фото ${stamp()}`;
      await page.getByLabel("Фото", { exact: true }).setInputFiles({ name: "g.png", mimeType: "image/png", buffer: PNG });
      await page.getByLabel("Описание (alt)").fill(alt);
      await page.getByLabel("Раздел").selectOption("events");
      await page.getByRole("button", { name: "Загрузить" }).click();
      await expect.poll(async () => (await q("select 1 from gallery_images where alt=$1", [alt])).length).toBe(1);
      const [img] = await q<{ id: string; public_id: string; group: string }>('select id, public_id, "group" from gallery_images where alt=$1', [alt]);
      expect(img).toMatchObject({ group: "events" });
      expect(img.public_id).toMatch(/^aroma\/gallery\/fake_/);

      const card = page.locator("li", { has: page.getByAltText(alt) });
      await card.getByRole("button", { name: "Сделать главным" }).click();
      await expect.poll(async () => (await q<{ id: string }>("select id from gallery_images where is_featured"))[0]?.id).toBe(img.id);

      page.once("filechooser", (fc) => fc.setFiles({ name: "r.png", mimeType: "image/png", buffer: PNG }));
      await card.getByRole("button", { name: "Заменить фото" }).click();
      await expect.poll(async () => (await q<{ p: string }>("select public_id p from gallery_images where id=$1", [img.id]))[0].p).not.toBe(img.public_id);

      page.once("dialog", (d) => d.accept());
      await card.getByRole("button", { name: "Удалить фото" }).click();
      await expect.poll(async () => (await q("select 1 from gallery_images where id=$1", [img.id])).length).toBe(0);
    });
  });

  test("отзывы: публикация, скрытие, рейтинг", async ({ page }) => {
    await page.goto("/admin/reviews");
    await expect(page.getByLabel("Рейтинг").getByText(/средняя оценка/)).toBeVisible();
    const card = page.locator("li", { hasText: "Рёбра — просто огонь" });
    await expect(card.getByText("Скрыт")).toBeVisible();
    await card.getByRole("button", { name: "Опубликовать" }).click();
    await expect.poll(async () => (await q<{ a: boolean }>("select is_approved a from reviews where author='Игорь М.'"))[0].a).toBe(true);
    await card.getByRole("button", { name: "Скрыть" }).click();
    await expect.poll(async () => (await q<{ a: boolean }>("select is_approved a from reviews where author='Игорь М.'"))[0].a).toBe(false);
    await page.getByRole("button", { name: "Опубликованные" }).click();
    await expect(page.getByText("Рёбра — просто огонь")).toHaveCount(0);
  });

  test("настройки: сохранение, отображение на сайте, валидация, журнал", async ({ page }) => {
    const original = (await q<{ phone: string }>("select phone from restaurant_settings"))[0].phone;
    try {
      await page.goto("/admin/settings");
      await page.getByLabel("Телефон").fill("+7 (495) 000-11-22");
      await page.locator("input[name=socialLabel0]").fill("Instagram");
      await page.locator("input[name=socialHref0]").fill("https://instagram.com/aroma_test");
      await page.getByLabel("Макс. гостей в брони").fill("8");
      await page.getByRole("button", { name: "Сохранить" }).click();
      await expect(page.getByText("Настройки сохранены")).toBeVisible();

      await page.goto("/contacts");
      await expect(page.getByRole("contentinfo")).toContainText("+7 (495) 000-11-22");
      await expect(page.getByRole("contentinfo").getByRole("link", { name: "Instagram" })).toHaveAttribute("href", "https://instagram.com/aroma_test");
      await page.goto("/reservation");
      await expect(page.getByLabel("Количество гостей").locator("option")).toHaveCount(8);

      await page.goto("/admin/settings");
      await page.locator("input[name=socialHref0]").fill("http://insecure.example");
      await page.getByRole("button", { name: "Сохранить" }).click();
      await expect(page.getByText(/Проверьте ссылки/)).toBeVisible();

      await page.goto("/admin/audit");
      await expect(page.getByRole("row", { name: /settings\.update/ }).first()).toContainText(ADMIN.email);
    } finally {
      await q("update restaurant_settings set phone=$1, max_party_size=12, social='[]'::jsonb", [original]);
    }
  });
});
