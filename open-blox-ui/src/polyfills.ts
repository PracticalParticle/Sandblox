import { Buffer } from "buffer";

type ProcessEnv = Record<string, string>;

interface Process {
  env: ProcessEnv;
  stdout: any;
  stderr: any;
  stdin: any;
  argv: string[];
  version: string;
  versions: { node: string };
  platform: string;
  pid: number;
  title: string;
}

declare global {
  interface Window {
    global: typeof globalThis;
    Buffer: typeof Buffer;
    process: any;
  }
}

window.global = window;
window.Buffer = Buffer;
window.process = {
  env: {} as ProcessEnv,
  stdout: null,
  stderr: null,
  stdin: null,
  argv: [],
  version: '1.0.0',
  versions: { node: '1.0.0' },
  platform: 'browser',
  pid: 1,
  title: 'browser'
} as Process;
