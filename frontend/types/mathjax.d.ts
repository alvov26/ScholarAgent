declare global {
  interface Window {
    MathJax?: {
      typesetPromise: (elements?: HTMLElement[]) => Promise<void>;
      startup?: {
        promise?: Promise<void>;
      };
    };
  }
}

export {};
