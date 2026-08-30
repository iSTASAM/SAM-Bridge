import { getLineUserProfile, type LineUserProfile } from "@/lib/line-messaging";

type CacheGlobals = typeof globalThis & {
  __lineProfileCache?: Map<string, { expiresAt: number; value: LineUserProfile | null }>;
};

const CACHE_MS = 5 * 60_000;
const shared = globalThis as CacheGlobals;
const cache = (shared.__lineProfileCache ??= new Map());

export async function getLineUserProfiles(lineUserIds: string[]) {
  const unique = [...new Set(lineUserIds.filter(Boolean))];
  const result = new Map<string, LineUserProfile | null>();
  await Promise.all(
    unique.map(async (lineUserId) => {
      const cached = cache.get(lineUserId);
      if (cached && cached.expiresAt > Date.now()) {
        result.set(lineUserId, cached.value);
        return;
      }
      const profile = await getLineUserProfile(lineUserId);
      cache.set(lineUserId, { expiresAt: Date.now() + CACHE_MS, value: profile });
      result.set(lineUserId, profile);
    }),
  );
  return result;
}
