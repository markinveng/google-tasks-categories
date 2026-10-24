import type { Category, TaskCategoryAssignment, TaskRef } from '@/types/category';
import { StorageService } from './StorageService';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const MAX_NAME_LENGTH = 50;

export class CategoryService {
  private categories: Category[] = [];
  private assignments: Record<string, TaskCategoryAssignment> = {};
  private listeners = new Set<() => void>();
  private unsubscribeStorage?: () => void;

  async init(): Promise<void> {
    await this.reload();
    this.unsubscribeStorage = StorageService.onChange(() => void this.reload());
  }

  dispose(): void {
    this.unsubscribeStorage?.();
    this.listeners.clear();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getCategories(): readonly Category[] {
    return this.categories;
  }

  getCategory(id: string): Category | undefined {
    return this.categories.find((c) => c.id === id);
  }

  getCategoryForTask(ref: TaskRef): Category | undefined {
    const assignment = this.assignments[ref.taskId];
    if (!assignment) return undefined;
    // Never apply a category recorded for a task in a different list.
    if (assignment.taskListId && ref.taskListId && assignment.taskListId !== ref.taskListId) {
      return undefined;
    }
    return this.getCategory(assignment.categoryId);
  }

  /** Returns an error message, or null when the name is valid. */
  validateName(name: string, excludeId?: string): string | null {
    const trimmed = name.trim();
    if (!trimmed) return 'カテゴリ名を入力してください';
    if (trimmed.length > MAX_NAME_LENGTH) return `カテゴリ名は${MAX_NAME_LENGTH}文字以内で入力してください`;
    const lower = trimmed.toLowerCase();
    if (this.categories.some((c) => c.id !== excludeId && c.name.toLowerCase() === lower)) {
      return '同じ名前のカテゴリが既に存在します';
    }
    return null;
  }

  async createCategory(name: string, color: string): Promise<void> {
    this.assertValid(name, color);
    this.categories = [...this.categories, { id: crypto.randomUUID(), name: name.trim(), color: color.toUpperCase() }];
    await this.persist({ categories: this.categories });
  }

  async updateCategory(id: string, patch: Partial<Pick<Category, 'name' | 'color'>>): Promise<void> {
    const current = this.getCategory(id);
    if (!current) return;
    const next = { ...current, ...patch };
    this.assertValid(next.name, next.color, id);
    next.name = next.name.trim();
    next.color = next.color.toUpperCase();
    this.categories = this.categories.map((c) => (c.id === id ? next : c));
    await this.persist({ categories: this.categories });
  }

  async deleteCategory(id: string): Promise<void> {
    this.categories = this.categories.filter((c) => c.id !== id);
    this.assignments = Object.fromEntries(
      Object.entries(this.assignments).filter(([, a]) => a.categoryId !== id),
    );
    await this.persist({ categories: this.categories, assignments: this.assignments });
  }

  async assign(ref: TaskRef, categoryId: string | null): Promise<void> {
    const assignments = { ...this.assignments };
    if (categoryId && this.getCategory(categoryId)) {
      assignments[ref.taskId] = { taskListId: ref.taskListId, taskId: ref.taskId, categoryId };
    } else {
      delete assignments[ref.taskId];
    }
    this.assignments = assignments;
    await this.persist({ assignments });
  }

  private assertValid(name: string, color: string, excludeId?: string): void {
    const error = this.validateName(name, excludeId);
    if (error) throw new Error(error);
    if (!HEX_COLOR.test(color)) throw new Error('色の形式が正しくありません');
  }

  private async persist(data: Parameters<typeof StorageService.save>[0]): Promise<void> {
    this.emit();
    await StorageService.save(data);
  }

  private async reload(): Promise<void> {
    const data = await StorageService.load();
    this.categories = data.categories;
    this.assignments = data.assignments;
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}
