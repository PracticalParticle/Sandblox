import { Buffer } from 'buffer';

declare global {
  interface Window {
    global: typeof globalThis;
    Buffer: typeof Buffer;
    process: {
      env: Record<string, string>;
    };
  }
}

window.global = window;
window.Buffer = Buffer;
window.process = { env: {} }; 