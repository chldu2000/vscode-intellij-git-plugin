import type { WebviewToExtensionMessage } from './messages';

interface VsCodeApi {
  postMessage(message: WebviewToExtensionMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare const acquireVsCodeApi: (() => VsCodeApi) | undefined;

let cachedApi: VsCodeApi | undefined;

export function getVsCodeApi(): VsCodeApi {
  if (cachedApi !== undefined) {
    return cachedApi;
  }

  if (typeof acquireVsCodeApi === 'function') {
    cachedApi = acquireVsCodeApi();
    return cachedApi;
  }

  cachedApi = {
    postMessage: () => undefined,
    getState: () => undefined,
    setState: () => undefined
  };

  return cachedApi;
}
