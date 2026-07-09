import { test, expect } from "@playwright/test";

// A small valid 8×8 PNG — enough for the browser to decode + downscale on-device.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFElEQVR4nGP8z8Dwn4EIwDiqkL4KAZM0A/9c0iBQAAAAAElFTkSuQmCC",
  "base64",
);

test("attach a postcard photo to a visited place, then view and remove it", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Search a city or country").fill("Paris");
  await page.getByRole("button", { name: /Paris/ }).first().click();

  await page.getByRole("button", { name: "Places", exact: true }).click();

  // No photo yet → the "Photo" affordance is present; attach the image.
  await expect(page.getByRole("button", { name: /Add a photo for Paris/ })).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "postcard.png",
    mimeType: "image/png",
    buffer: PNG,
  });

  // A thumbnail appears (downscaled on-device to a JPEG data URL).
  const thumb = page.locator(".postcard-thumb img");
  await expect(thumb).toBeVisible();
  await expect(thumb).toHaveAttribute("src", /^data:image\/jpeg/);

  // Open the lightbox, then remove the photo.
  await page.locator(".postcard-thumb").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Add a photo for Paris/ })).toBeVisible();
});
