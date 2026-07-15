import { create } from "zustand";
import { backfillUpdatedAt } from "../schema/helpers";
import type { Photo, PlaceRef, Story } from "../schema/models";
import * as db from "../db/storiesDb";
import * as visitsDb from "../db/visitsDb";
import { uuid } from "./uuid";

/** Now, as the ISO stamp written to `updatedAt` on every mutating path (spec 013). */
const stampNow = () => new Date().toISOString();

/** Journal order: newest story date first (ties broken by newest addedAt). */
export function sortStories(stories: Story[]): Story[] {
  return [...stories].sort(
    (a, b) => b.date.localeCompare(a.date) || b.addedAt.localeCompare(a.addedAt),
  );
}

interface StoriesState {
  stories: Story[];
  loaded: boolean;
  load: () => Promise<void>;
  addStory: (input: {
    place: PlaceRef;
    date: string;
    title: string;
    text: string;
    photos?: Photo[];
  }) => Promise<Story>;
  updateStory: (
    storyId: string,
    changes: Partial<Pick<Story, "place" | "date" | "title" | "text" | "photos">>,
  ) => Promise<void>;
  removeStory: (storyId: string) => Promise<void>;
  setAll: (stories: Story[]) => Promise<void>;
}

export const useStories = create<StoriesState>((set, get) => ({
  stories: [],
  loaded: false,
  async load() {
    // Backfill `updatedAt` from `addedAt` for stories made before sync existed.
    const stories = sortStories((await db.getAllStories()).map(backfillUpdatedAt));
    set({ stories, loaded: true });
  },
  async addStory({ place, date, title, text, photos = [] }) {
    const at = new Date().toISOString();
    const story: Story = {
      storyId: uuid(),
      place,
      date,
      title,
      text,
      // Only carry `photos` when there is at least one — keeps records and exports lean.
      ...(photos.length ? { photos } : {}),
      addedAt: at,
      updatedAt: at,
    };
    set({ stories: sortStories([...get().stories, story]) });
    await db.putStory(story);
    return story;
  },
  async updateStory(storyId, changes) {
    const existing = get().stories.find((s) => s.storyId === storyId);
    if (!existing) return;
    const updated: Story = { ...existing, ...changes, updatedAt: stampNow() };
    if (!updated.photos?.length) delete updated.photos;
    set({ stories: sortStories(get().stories.map((s) => (s.storyId === storyId ? updated : s))) });
    await db.putStory(updated);
  },
  async removeStory(storyId) {
    set({ stories: get().stories.filter((s) => s.storyId !== storyId) });
    await db.deleteStory(storyId);
    // Tombstone the deletion so it propagates on sync (spec 013, FR-009).
    await visitsDb.putTombstone("story", storyId, stampNow());
  },
  async setAll(stories) {
    // Bulk load: backfill `updatedAt` without stamping "now" (keep real ages).
    const sorted = sortStories(stories.map(backfillUpdatedAt));
    set({ stories: sorted });
    await db.replaceAllStories(sorted);
  },
}));
