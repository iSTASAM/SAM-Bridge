type LockGlobals = typeof globalThis & {
  __ixacsConnectionLocks?: Map<string, Promise<void>>;
};

const shared = globalThis as LockGlobals;
const connectionLocks = shared.__ixacsConnectionLocks ??= new Map();

/** Serialize context-sensitive iXacs requests that share a company session. */
export async function acquireIxacsConnectionLock(connectionId: string) {
  const previous = connectionLocks.get(connectionId) ?? Promise.resolve();
  let releaseCurrent!: () => void;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const queued = previous.then(() => current);
  connectionLocks.set(connectionId, queued);
  await previous;
  return () => {
    releaseCurrent();
    if (connectionLocks.get(connectionId) === queued) connectionLocks.delete(connectionId);
  };
}
