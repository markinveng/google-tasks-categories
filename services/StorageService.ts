import type { Category, StoredData, TaskCategoryAssignment } from '@/types/category';

/**
 * Data lives in storage.sync so it follows the user's Chrome profile across devices.
 * storage.sync allows ~8KB per item and ~100KB in total, so assignments are spread
 * over hash buckets: each bucket stays well under the per-item limit, and edits on
 * different devices only conflict when they touch the same bucket.
 */
const CATEGORIES_KEY = 'categories';
const BUCKET_PREFIX = 'assignments.';
const BUCKET_COUNT = 16;
/** Keys used by earlier versions, which stored everything in storage.local. */
const LEGACY_KEYS = ['categories', 'assignments'] as const;

/** Compact bucket form: taskId -> [taskListId, categoryId] */
type Bucket = Record<string, [string, string]>;

/** JSON of each bucket as last read or written, so saves only touch changed buckets. */
const writtenBuckets = new Map<string, string>();
let migration: Promise<void> | undefined;

function bucketKey(taskId: string): string {
  // FNV-1a: stable across devices, unlike anything order- or session-dependent.
  let hash = 0x811c9dc5;
  for (let i = 0; i < taskId.length; i++) {
    hash ^= taskId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return BUCKET_PREFIX + ((hash >>> 0) % BUCKET_COUNT);
}

function isBucketKey(key: string): boolean {
  return key.startsWith(BUCKET_PREFIX);
}

async function writeSync(data: Partial<StoredData>): Promise<void> {
  const items: Record<string, unknown> = {};
  if (data.categories) items[CATEGORIES_KEY] = data.categories;
  if (data.assignments) {
    const buckets = new Map<string, Bucket>();
    for (let i = 0; i < BUCKET_COUNT; i++) buckets.set(BUCKET_PREFIX + i, {});
    for (const a of Object.values(data.assignments)) {
      buckets.get(bucketKey(a.taskId))![a.taskId] = [a.taskListId, a.categoryId];
    }
    for (const [key, bucket] of buckets) {
      const json = JSON.stringify(bucket);
      if ((writtenBuckets.get(key) ?? '{}') !== json) items[key] = bucket;
    }
  }
  if (!Object.keys(items).length) return;
  try {
    await browser.storage.sync.set(items);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes('QUOTA')) throw new Error('同期ストレージの容量上限に達しました。不要なカテゴリの割り当てを解除してください');
    throw e;
  }
  for (const [key, value] of Object.entries(items)) {
    if (isBucketKey(key)) writtenBuckets.set(key, JSON.stringify(value));
  }
}

/** Moves data from storage.local once, unless synced data already exists (e.g. from another device). */
async function migrateLegacy(): Promise<void> {
  const synced = await browser.storage.sync.get(CATEGORIES_KEY);
  if (CATEGORIES_KEY in synced) return;
  const legacy = (await browser.storage.local.get([...LEGACY_KEYS])) as Partial<StoredData>;
  if (!Array.isArray(legacy.categories)) return;
  await writeSync({ categories: legacy.categories, assignments: legacy.assignments ?? {} });
  await browser.storage.local.remove([...LEGACY_KEYS]);
}

export const StorageService = {
  async load(): Promise<StoredData> {
    await (migration ??= migrateLegacy().catch((e) => {
      migration = undefined;
      console.error('[Google Tasks Categories] migration failed', e);
    }));
    const data = await browser.storage.sync.get(null);
    const assignments: Record<string, TaskCategoryAssignment> = {};
    writtenBuckets.clear();
    for (const [key, value] of Object.entries(data)) {
      if (!isBucketKey(key) || !value || typeof value !== 'object') continue;
      writtenBuckets.set(key, JSON.stringify(value));
      for (const [taskId, [taskListId, categoryId]] of Object.entries(value as Bucket)) {
        assignments[taskId] = { taskId, taskListId, categoryId };
      }
    }
    const categories = data[CATEGORIES_KEY];
    return {
      categories: Array.isArray(categories) ? (categories as Category[]) : [],
      assignments,
    };
  },

  save(data: Partial<StoredData>): Promise<void> {
    return writeSync(data);
  },

  /** Notifies when another tab or device (or this one) changes the stored data. */
  onChange(callback: () => void): () => void {
    const listener = (changes: Record<string, unknown>, area: string) => {
      if (area === 'sync' && Object.keys(changes).some((key) => key === CATEGORIES_KEY || isBucketKey(key))) callback();
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  },
};
