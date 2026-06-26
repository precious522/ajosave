import { AsyncLocalStorage } from "async_hooks";

const store = new AsyncLocalStorage<{ correlationId: string }>();

export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  return store.run({ correlationId }, fn);
}

export function getCorrelationId(): string | undefined {
  return store.getStore()?.correlationId;
}
