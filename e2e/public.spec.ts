import { expect, test } from "@playwright/test";
import { guest, nextWeekday, q } from "./support/helpers";

test.describe("главная и навигация", () => {
  test("главная открывается, видны hero, популярные блюда и контакты", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Огонь, соль");
    await expect(page.getByRole("heading", { name: "Популярные блюда" })).toBeVisible();
    await expect(page.locator("main a[href^='/menu/']").first()).toBeVisible();
    await expect(page.getByRole("contentinfo")).toContainText("Москва");
  });

  for (const [label, url, heading] of [
    ["О ресторане", /\/about/, /История/],
    ["Меню", /\/menu/, /Что мы готовим/],
    ["Галерея", /\/gallery/, /Aroma в кадрах/],
    ["Контакты", /\/contacts/, /Как нас найти/],
  ] as const) {
    test(`навигация: ${label}`, async ({ page }) => {
      await page.goto("/");
      await page.getByRole("navigation", { name: "Основная навигация" }).getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(url);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
    });
  }

  test("кнопка бронирования ведёт на форму", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: "Забронировать" }).click();
    await expect(page).toHaveURL(/\/reservation/);
  });

  test("отзывы: видны опубликованные и скрыты неопубликованные", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Лучшая паста в городе")).toBeVisible();
    await expect(page.getByText("Рёбра — просто огонь")).toHaveCount(0); // seeded as unpublished
  });
});

test.describe("меню", () => {
  test("показывает блюда, скрытые (недоступные) блюда не показываются", async ({ page }) => {
    await page.goto("/menu");
    await expect(page.locator("main a[href^='/menu/']").first()).toBeVisible();
    expect(await page.locator("main a[href^='/menu/']").count()).toBeGreaterThanOrEqual(19);
    await expect(page.getByText("Боул с лососем")).toHaveCount(0);
    await expect(page.getByText("Популярное").first()).toBeVisible();
  });

  test("фильтр по категории", async ({ page }) => {
    await page.goto("/menu");
    await page.getByRole("navigation", { name: "Категории меню" }).getByRole("link", { name: "Десерты" }).click();
    await expect(page).toHaveURL(/category=desserts/);
    await expect(page.getByRole("heading", { name: "Панна-котта с малиной" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Тальятелле с лесными грибами" })).toHaveCount(0);
  });

  test("поиск по названию, регистр не важен, спецсимволы безопасны", async ({ page }) => {
    await page.goto("/menu");
    await page.getByRole("searchbox", { name: "Поиск по названию блюда" }).or(page.getByPlaceholder("Поиск по названию блюда")).fill("ПЕСТО");
    await page.getByRole("button", { name: "Найти" }).click();
    await expect(page).toHaveURL(/q=/);
    await expect(page.getByRole("heading", { name: "Фарфалле с песто и томатами" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Панна-котта с малиной" })).toHaveCount(0);

    await page.goto("/menu?q=%25%27%3B--");
    await expect(page.getByText(/ничего не найдено/)).toBeVisible();
  });

  test("поиск + категория вместе, пустой результат с кнопкой сброса", async ({ page }) => {
    await page.goto("/menu?category=desserts&q=стейк");
    await expect(page.getByText(/ничего не найдено/)).toBeVisible();
    await page.getByRole("link", { name: "Показать всё меню" }).click();
    await expect(page).toHaveURL(/\/menu$/);
  });

  test("карточка блюда: фото, состав, цена, вес, аллергены, похожие", async ({ page }) => {
    await page.goto("/menu");
    await page.getByRole("heading", { name: "Лосось с овощами на гриле" }).click();
    await expect(page).toHaveURL(/\/menu\/salmon-grilled-vegetables/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Лосось с овощами на гриле");
    await expect(page.getByText("Оливковое масло")).toBeVisible();
    await expect(page.getByText(/1\s?290/)).toBeVisible();
    await expect(page.getByText("260 г")).toBeVisible();
    await expect(page.locator("article p", { hasText: "Аллергены:" })).toContainText("Рыба");
    await expect(page.getByRole("heading", { name: "Похожие блюда" })).toBeVisible();
    await expect(page.locator("article img").first()).toBeVisible();
  });

  test("несуществующее и скрытое блюдо → 404", async ({ page }) => {
    for (const slug of ["no-such-dish", "salmon-poke"]) {
      const res = await page.goto(`/menu/${slug}`);
      expect(res?.status()).toBe(404);
      await expect(page.getByText("Страница не найдена")).toBeVisible();
    }
  });
});

test.describe("бронирование", () => {
  const wed = () => nextWeekday(2, 6);

  async function fill(page: import("@playwright/test").Page, g: ReturnType<typeof guest>, opts: { date?: string; guests?: string } = {}) {
    await page.getByLabel("Имя").fill(g.name);
    await page.getByLabel("Телефон").fill(g.phone);
    await page.getByLabel("Email").fill(g.email);
    await page.getByLabel("Дата").fill(opts.date ?? wed());
    if (opts.guests) await page.getByLabel("Количество гостей").selectOption(opts.guests);
  }
  const slot = (page: import("@playwright/test").Page, t: string) => page.getByRole("radiogroup", { name: "Время" }).locator("label", { hasText: new RegExp(`^${t}$`) });

  test("обязательные поля: пустая форма показывает ошибки и ничего не сохраняет", async ({ page }) => {
    const before = (await q<{ c: string }>("select count(*) c from reservations"))[0].c;
    await page.goto("/reservation");
    await page.getByRole("button", { name: "Отправить заявку" }).click();
    await expect(page.getByText("Укажите имя")).toBeVisible();
    await expect(page.getByText("Введите корректный телефон")).toBeVisible();
    await expect(page.getByText("Введите корректный email")).toBeVisible();
    await expect(page.locator("#date-error")).toHaveText("Выберите дату");
    await expect(page.getByText("Выберите время").first()).toBeVisible();
    expect((await q<{ c: string }>("select count(*) c from reservations"))[0].c).toBe(before);
  });

  test("некорректный телефон и email отклоняются", async ({ page }) => {
    await page.goto("/reservation");
    const g = guest();
    await fill(page, { ...g, phone: "abc", email: "no-at" });
    await slot(page, "19:00").click();
    await page.getByRole("button", { name: "Отправить заявку" }).click();
    await expect(page.getByText("Введите корректный телефон")).toBeVisible();
    await expect(page.getByText("Введите корректный email")).toBeVisible();
  });

  test("прошедшие даты недоступны: min у поля и отказ сервера", async ({ page, request }) => {
    await page.goto("/reservation");
    const min = await page.getByLabel("Дата").getAttribute("min");
    expect(min).toBe(new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" }));
    const res = await request.get("/api/reservations/availability?date=2020-01-01&guests=2");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("past");
  });

  test("рабочее время: только слоты по графику, 22:00 и ночь недоступны", async ({ page }) => {
    await page.goto("/reservation");
    await fill(page, guest());
    const group = page.getByRole("radiogroup", { name: "Время" });
    await expect(group).toBeVisible();
    await expect(slot(page, "12:00")).toBeVisible();
    await expect(slot(page, "21:00")).toBeVisible();
    await expect(slot(page, "22:00")).toHaveCount(0); // 23:00 close - 2h duration
    await expect(slot(page, "03:00")).toHaveCount(0);
  });

  test("закрытый день: слотов нет и сообщение", async ({ page }) => {
    await q("update restaurant_settings set schedule = jsonb_set(schedule, '{1}', 'null'::jsonb)"); // Tuesday closed
    try {
      await page.goto("/reservation");
      await fill(page, guest(), { date: nextWeekday(1, 6) });
      await expect(page.getByText("В этот день ресторан закрыт")).toBeVisible();
    } finally {
      await q(`update restaurant_settings set schedule = jsonb_set(schedule, '{1}', '{"open":"12:00","close":"23:00"}'::jsonb)`);
    }
  });

  test("занятый интервал отображается неактивным и не бронируется", async ({ page }) => {
    const date = nextWeekday(3, 9); // Thursday
    // fill the room at 19:00 with two big parties
    for (let i = 0; i < 4; i++) {
      const g = guest("full");
      await q(`insert into reservations (name, phone, email, reservation_date, reservation_time, guests, status) values ($1,$2,$3,$4,'19:00',10,'confirmed')`, [g.name, g.phone, g.email, date]);
    }
    await page.goto("/reservation");
    await fill(page, guest(), { date, guests: "4" });
    await expect(slot(page, "12:00").locator("input")).toBeEnabled();
    await expect(slot(page, "19:00").locator("input")).toBeDisabled();
    await expect(slot(page, "20:00").locator("input")).toBeDisabled(); // overlaps 19:00–21:00
    await expect(slot(page, "21:00").locator("input")).toBeEnabled();
  });

  test("успешное бронирование: pending в БД, страница успеха, без автоподтверждения", async ({ page }) => {
    const g = guest("ok");
    const date = wed();
    await page.goto("/reservation");
    await fill(page, g, { guests: "3" });
    await page.getByLabel("Комментарий").fill("Детский стул");
    await slot(page, "18:00").click();
    await page.getByRole("button", { name: "Отправить заявку" }).click();
    await expect(page).toHaveURL(/\/reservation\/success\?id=/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Заявка принята");
    await expect(page.getByText(/ожидает подтверждения/)).toBeVisible();
    const rows = await q<{ status: string; guests: number; comment: string; reservation_time: string; reservation_date: string }>("select status, guests, comment, reservation_time, to_char(reservation_date,'YYYY-MM-DD') reservation_date from reservations where email=$1", [g.email]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "pending", guests: 3, comment: "Детский стул", reservation_time: "18:00", reservation_date: date });
  });

  test("защита от повторной отправки: двойной клик создаёт одну бронь", async ({ page }) => {
    const g = guest("dbl");
    await page.goto("/reservation");
    await fill(page, g);
    await slot(page, "14:00").click();
    const submit = page.getByRole("button", { name: "Отправить заявку" });
    await Promise.all([submit.dblclick().catch(() => {}), page.waitForURL(/success/)]);
    expect(await q("select 1 from reservations where email=$1", [g.email])).toHaveLength(1);
  });

  test("повторная бронь тех же контактов на то же время отклоняется понятной ошибкой", async ({ page }) => {
    const g = guest("dup");
    for (let i = 0; i < 2; i++) {
      await page.goto("/reservation");
      await fill(page, g);
      await slot(page, "13:00").click();
      await page.getByRole("button", { name: "Отправить заявку" }).click();
      if (i === 0) await expect(page).toHaveURL(/success/);
    }
    await expect(page.locator("p[role=alert]").or(page.getByText("уже есть")).first()).toContainText(/уже есть/);
    expect(await q("select 1 from reservations where email=$1", [g.email])).toHaveLength(1);
  });

  test("лимит заявок с одного IP", async ({ browser }) => {
    const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "203.0.113.77" } });
    const page = await ctx.newPage();
    let lastAlert = "";
    for (let i = 0; i < 6; i++) {
      const g = guest("rl");
      await page.goto("/reservation");
      await fill(page, g, { date: nextWeekday(4, 12 + i * 0) });
      await slot(page, `${12 + i}:00`).click();
      await page.getByRole("button", { name: "Отправить заявку" }).click();
      if (i < 5) await expect(page).toHaveURL(/success/);
      else lastAlert = await page.getByText(/Слишком много заявок/).first().innerText();
    }
    expect(lastAlert).toContain("Слишком много заявок");
    await ctx.close();
  });
});

test.describe("контактная форма", () => {
  test("валидация: нужен телефон или email, сообщение ≥ 10 символов", async ({ page }) => {
    await page.goto("/contacts");
    await page.getByLabel("Имя").fill("Аня");
    await page.getByLabel("Сообщение").fill("коротко");
    await page.getByRole("button", { name: "Отправить" }).click();
    await expect(page.getByText("Укажите телефон или email")).toBeVisible();
    await expect(page.getByText("Сообщение слишком короткое")).toBeVisible();
  });

  test("успешная отправка сохраняется в contact_messages", async ({ page }) => {
    const g = guest("msg");
    await page.goto("/contacts");
    await page.getByLabel("Имя").fill(g.name);
    await page.getByLabel("Email").fill(g.email);
    await page.getByLabel("Сообщение").fill("Здравствуйте! Хотим забронировать банкет.");
    await page.getByRole("button", { name: "Отправить" }).click();
    await expect(page.getByRole("status")).toContainText("Сообщение получено");
    const rows = await q<{ message: string; ip_hash: string | null }>("select message, ip_hash from contact_messages where email=$1", [g.email]);
    expect(rows).toHaveLength(1);
    expect(rows[0].message).toContain("банкет");
  });

  test("спам-ловушка: заполненное скрытое поле ничего не сохраняет", async ({ page }) => {
    const g = guest("bot");
    await page.goto("/contacts");
    await page.getByLabel("Имя").fill(g.name);
    await page.getByLabel("Email").fill(g.email);
    await page.getByLabel("Сообщение").fill("Купите дешёвые часы прямо сейчас");
    await page.locator("input[name=website]").evaluate((el: HTMLInputElement) => { el.value = "http://spam"; });
    await page.getByRole("button", { name: "Отправить" }).click();
    await expect(page.getByRole("status")).toBeVisible();
    expect(await q("select 1 from contact_messages where email=$1", [g.email])).toHaveLength(0);
  });
});
