import type { StoredData } from '@/types/category';

const KEYS = ['categories', 'assignments'] as const;

export const StorageService = {
  async load(): Promise<StoredData> {
    const data = (await browser.storage.local.get([...KEYS])) as Partial<StoredData>;
    return {
      categories: Array.isArray(data.categories) ? data.categories : [],
      assignments: data.assignments ?? {},
    };
  },

  save(data: Partial<StoredData>): Promise<void> {
    return browser.storage.local.set(data);
  },

  /** Notifies when another tab (or this one) changes the stored data. */
  onChange(callback: () => void): () => void {
    const listener = (changes: Record<string, unknown>, area: string) => {
      if (area === 'local' && KEYS.some((key) => key in changes)) callback();
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  },
};
