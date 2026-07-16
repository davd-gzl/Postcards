// The auto-sync SCHEDULER (spec 013): the small state machine that turns a stream
// of triggers (app launch, focus, backgrounding, and debounced local edits) into
// at-most-one sync run at a time. It is deliberately DOM-free and React-free so the
// lock + debounce + coalesce logic can be unit-tested with fake timers; the
// `useAutoSync` hook only wires browser events and store subscriptions to it.
//
// Guarantees:
//  - IN-FLIGHT LOCK: never two overlapping runs (FR reuse of syncOnce; the API is
//    never hammered by concurrent calls).
//  - COALESCE: a burst of rapid edits collapses into one debounced run.
//  - NO LOST EDIT: a trigger that arrives WHILE a run is in flight is remembered
//    and serviced by exactly one follow-up run after the current one settles.

export interface SyncScheduler {
  /** Run as soon as possible (launch / focus / visibility / online / backgrounding). */
  requestImmediate(): void;
  /** Run after a quiet period (a local edit); repeated calls reset the timer. */
  requestDebounced(): void;
  /** Cancel any pending timer (on unmount). */
  dispose(): void;
  /** Test/introspection: is a run currently in flight? */
  isRunning(): boolean;
}

export interface SyncSchedulerOptions {
  /** Perform one sync. Rejections are swallowed here (the run logs its own outcome). */
  run: () => Promise<unknown>;
  /** Whether a run is currently allowed (enabled + configured + online). */
  canRun: () => boolean;
  /** Quiet period before an edit-triggered run, in ms. */
  debounceMs: number;
  /** Injectable timer for tests; defaults to the DOM timers. */
  setTimeoutFn?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeoutFn?: (h: ReturnType<typeof setTimeout>) => void;
}

export function createSyncScheduler(opts: SyncSchedulerOptions): SyncScheduler {
  const setT = opts.setTimeoutFn ?? ((fn, ms) => setTimeout(fn, ms));
  const clearT = opts.clearTimeoutFn ?? ((h) => clearTimeout(h));

  let running = false;
  // A trigger seen during an in-flight run — serviced once the run settles.
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function cancelTimer(): void {
    if (timer !== null) {
      clearT(timer);
      timer = null;
    }
  }

  function schedule(): void {
    cancelTimer();
    timer = setT(() => {
      timer = null;
      void runNow();
    }, opts.debounceMs);
  }

  async function runNow(): Promise<void> {
    if (running) {
      // Coalesce: don't start a second run; remember to run again afterwards.
      pending = true;
      return;
    }
    if (!opts.canRun()) return;
    running = true;
    try {
      await opts.run();
    } catch {
      /* the run reports its own failure (sync log); the scheduler stays alive */
    } finally {
      running = false;
      // Something asked to sync while we were busy — service it once, debounced so
      // a flurry during the run still collapses into a single follow-up.
      if (pending) {
        pending = false;
        schedule();
      }
    }
  }

  return {
    requestImmediate() {
      cancelTimer();
      void runNow();
    },
    requestDebounced() {
      if (running) {
        pending = true;
        return;
      }
      schedule();
    },
    dispose() {
      cancelTimer();
    },
    isRunning() {
      return running;
    },
  };
}
