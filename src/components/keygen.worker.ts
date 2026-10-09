import { generateKeyPair } from '../lib/ssh';
import type { GenerateOptions } from '../lib/ssh';

self.onmessage = async (event: MessageEvent<GenerateOptions>) => {
  try {
    const pair = await generateKeyPair(event.data);
    self.postMessage({ ok: true, pair });
  } catch (error) {
    self.postMessage({ ok: false, message: error instanceof Error ? error.message : String(error) });
  }
};
