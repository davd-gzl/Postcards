// Minimal ambient types for `jsdom`, used only by unit tests to boot the
// published reader in a real DOM. The package ships no declarations and
// `@types/jsdom` is intentionally not a dependency (the reader itself pulls in
// nothing), so we declare just the tiny surface the tests touch.
declare module "jsdom" {
  export class VirtualConsole {}
  export class JSDOM {
    constructor(
      html?: string,
      options?: {
        runScripts?: "dangerously" | "outside-only";
        pretendToBeVisual?: boolean;
        virtualConsole?: VirtualConsole;
      },
    );
    readonly window: Window & typeof globalThis;
  }
}
