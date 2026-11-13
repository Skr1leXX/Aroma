import { expect, test as setup } from "@playwright/test";
import { ADMIN, CUSTOMER } from "./support/pg-server";

// Sign in once per role through the real login form and reuse the session (Better Auth rate-limits sign-in).
for (const [name, user] of [["admin", ADMIN], ["customer", CUSTOMER]] as const) {
  setup(`sign in as ${name}`, async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Пароль").fill(user.password);
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page).toHaveURL(/\/account/);
    await page.context().storageState({ path: `e2e/.auth/${name}.json` });
  });
}
