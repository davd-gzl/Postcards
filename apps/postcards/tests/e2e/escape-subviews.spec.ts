import { test, expect } from "@playwright/test";

// Escape / Back should step out of a LOCAL sub-view (a screen's own inner view)
// back to that screen's home view BEFORE leaving the tab — the same way the
// Journal's map view backs out to the feed. Places' collections (Moments, Photos,
// Passport) are little screens of their own; Escape returns to the Visited list
// instead of jumping straight to the map.
test("Escape backs out of a Places collection to the Visited list before leaving the tab", async ({
  page,
}) => {
  await page.goto("/");

  // Land on Places (its default view is Visited).
  await page.getByRole("button", { name: "Places", exact: true }).click();
  const visitedTab = page.getByRole("button", { name: /^Visited/ });
  await expect(visitedTab).toHaveAttribute("aria-pressed", "true");

  // Open the Moments collection — a sub-view of Places.
  const moments = page.getByRole("button", { name: "Moments", exact: true });
  await moments.click();
  await expect(moments).toHaveAttribute("aria-pressed", "true");

  // Move focus off the button (so the global handler owns Escape, not the button),
  // then press Escape: it must return to Visited, NOT navigate away from Places.
  // (The collection's own "Moments" heading — the redundant "Places" title is
  // hidden on collection views.)
  await page.getByRole("heading", { name: "Moments" }).click();
  await page.keyboard.press("Escape");

  await expect(visitedTab).toHaveAttribute("aria-pressed", "true");
  await expect(moments).toHaveAttribute("aria-pressed", "false");
  // Still on the Places tab (didn't fall through to the previous screen).
  await expect(page.getByRole("button", { name: "Places", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );

  // A second Escape (now on the home view) leaves Places for the previous screen.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Places", exact: true })).not.toHaveAttribute(
    "aria-current",
    "page",
  );
});
