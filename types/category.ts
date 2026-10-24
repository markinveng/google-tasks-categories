export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface TaskCategoryAssignment {
  taskListId: string;
  taskId: string;
  categoryId: string;
}

/** assignments are keyed by taskId */
export interface StoredData {
  categories: Category[];
  assignments: Record<string, TaskCategoryAssignment>;
}

export interface TaskRef {
  taskId: string;
  taskListId: string;
}
