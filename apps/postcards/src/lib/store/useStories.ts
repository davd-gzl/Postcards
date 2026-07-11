import { create } from "zustand";
import type { Photo, PlaceRef, Story } from "../schema/models";
import * as db from "../db/storiesDb";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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
    const stories = sortStories(await db.getAllStories());
    set({ stories, loaded: true });
  },
  async addStory({ place, date, title, text, photos = [] }) {
    const story: Story = {
      storyId: uuid(),
      place,
      date,
      title,
      text,
      // Only carry `photos` when there is at least one — keeps records and exports lean.
      ...(photos.length ? { photos } : {}),
      addedAt: new Date().toISOString(),
    };
    set({ stories: sortStories([...get().stories, story]) });
    await db.putStory(story);
    return story;
  },
  async updateStory(storyId, changes) {
    const existing = get().stories.find((s) => s.storyId === storyId);
    if (!existing) return;
    const updated: Story = { ...existing, ...changes };
    if (!updated.photos?.length) delete updated.photos;
    set({ stories: sortStories(get().stories.map((s) => (s.storyId === storyId ? updated : s))) });
    await db.putStory(updated);
  },
  async removeStory(storyId) {
    set({ stories: get().stories.filter((s) => s.storyId !== storyId) });
    await db.deleteStory(storyId);
  },
  async setAll(stories) {
    const sorted = sortStories(stories);
    set({ stories: sorted });
    await db.replaceAllStories(sorted);
  },
}));
