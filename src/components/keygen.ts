import { generateKeyPair } from '../lib/ssh';
import type { GenerateOptions, KeyPair } from '../lib/ssh';

type WorkerReply = { ok: true; pair: KeyPair } | { ok: false; message: string };

let worker: Worker | null = null;
let workerBroken = false;

function startWorker(): Worker | null {
  if (workerBroken || typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./keygen.worker.ts', import.meta.url), { type: 'module' });
    return worker;
  } catch {
    workerBroken = true;
    return null;
  }
}

function stopWorker(): void {
  worker?.terminate();
  worker = null;
}

async function generateOnMainThread(options: GenerateOptions): Promise<KeyPair> {
  await new Promise((resolve) => setTimeout(resolve, 30));
  return generateKeyPair(options);
}

/** Generates a key pair in a Web Worker so the page stays responsive, falling back to the main thread. */
export function generateInBackground(options: GenerateOptions): Promise<KeyPair> {
  const active = startWorker();
  if (!active) return generateOnMainThread(options);

  return new Promise<KeyPair>((resolve, reject) => {
    const cleanup = () => {
      active.removeEventListener('message', onMessage);
      active.removeEventListener('error', onError);
    };
    const onMessage = (event: MessageEvent<WorkerReply>) => {
      cleanup();
      if (event.data.ok) resolve(event.data.pair);
      else reject(new Error(event.data.message));
    };
    const onError = (event: ErrorEvent) => {
      event.preventDefault();
      cleanup();
      stopWorker();
      workerBroken = true;
      generateOnMainThread(options).then(resolve, reject);
    };
    active.addEventListener('message', onMessage);
    active.addEventListener('error', onError);
    active.postMessage(options);
  });
}
