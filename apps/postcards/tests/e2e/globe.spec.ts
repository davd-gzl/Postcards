import { test, expect } from "@playwright/test";

// The map can switch between the flat projection and the 3D globe, the choice
// is a toggle button (aria-pressed), and it survives a reload (persisted).
test("toggle the 3D globe view and persist the choice", async ({ page }) => {
  await page.goto("/");

  // The view toggles are grouped behind the Layers button now.
  await page.getByRole("button", { name: /Layers/ }).click();
  const globe = page.getByRole("button", { name: "Globe" });
  await expect(globe).toBeVisible();
  await expect(globe).toHaveAttribute("aria-pressed", "false");

  // Flip to the globe.
  await globe.click();
  await expect(globe).toHaveAttribute("aria-pressed", "true");
  // The map is still there (projection switched in place, no crash/remount fallback).
  await expect(page.getByLabel("Map of visited places")).toBeVisible();

  // The choice is remembered across a reload (the panel starts closed).
  await page.reload();
  await page.getByRole("button", { name: /Layers/ }).click();
  await expect(page.getByRole("button", { name: "Globe" })).toHaveAttribute("aria-pressed", "true");

  // And back to flat.
  await page.getByRole("button", { name: "Globe" }).click();
  await expect(page.getByRole("button", { name: "Globe" })).toHaveAttribute("aria-pressed", "false");
});
