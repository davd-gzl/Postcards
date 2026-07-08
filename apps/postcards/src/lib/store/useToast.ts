import { create } from "zustand";

// One restrained toast at a time, optionally with an Undo action. The undo
// callback restores a snapshot taken by the caller before the mutation.
export interface Toast {
  id: number;
  message: string;
  undo?: () => void | Promise<void>;
}

interface ToastState {
  toast: Toast | null;
  show: (message: string, undo?: Toast["undo"]) => void;
  dismiss: () => void;
}

let nextId = 1;

export const useToast = create<ToastState>((set) => ({
  toast: null,
  show: (message, undo) => set({ toast: { id: nextId++, message, undo } }),
  dismiss: () => set({ toast: null }),
}));
