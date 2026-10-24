import type { TaskRef } from '@/types/category';

/**
 * Selectors confirmed against the live tasks.google.com DOM (2026-10).
 * jsname values are Google build identifiers and may change on Google's side.
 */
const SEL = {
  row: '[jsname="nXjgFc"][data-task-id]',
  editArea: '[jsname="sMyUPe"]',
  dateContainer: '[jsname="LM4p8e"]',
  // Only rendered while a task's edit area is expanded.
  repeatButton: '[jsname="gF1kvc"]',
  taskList: '[data-task-list-id]:not([data-task-list-id=""])',
  headerAnchor: 'header[role="banner"] [jsname="cAuFpc"]',
} as const;

/** Every element this extension inserts carries this class. */
export const OWN_CLASS = 'gtc-root';
const CATEGORY_ATTR = 'data-gtc-category';

export interface AdapterHandlers {
  onRows(rows: HTMLElement[]): void;
  onFlush(): void;
}

export class GoogleTasksDOMAdapter {
  private observer?: MutationObserver;
  private pending = new Set<Element>();
  private frame = 0;

  constructor(private handlers: AdapterHandlers) {}

  start(): void {
    this.observer = new MutationObserver((records) => this.collect(records));
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.handlers.onRows(this.getAllRows());
    this.handlers.onFlush();
  }

  stop(): void {
    this.observer?.disconnect();
    cancelAnimationFrame(this.frame);
    this.pending.clear();
  }

  getAllRows(): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>(SEL.row)];
  }

  getRowOf(el: Element): HTMLElement | null {
    return el.closest<HTMLElement>(SEL.row);
  }

  getTaskRef(row: HTMLElement): TaskRef | null {
    const taskId = row.dataset.taskId;
    const taskListId = row.closest<HTMLElement>(SEL.taskList)?.dataset.taskListId ?? '';
    return taskId ? { taskId, taskListId } : null;
  }

  /** Returns the date/time container of an expanded edit area, or null when collapsed. */
  getExpandedDateContainer(row: HTMLElement): HTMLElement | null {
    const area = [...row.querySelectorAll<HTMLElement>(SEL.editArea)].find((el) => el.closest(SEL.row) === row);
    if (!area?.querySelector(SEL.repeatButton)) return null;
    return area.querySelector<HTMLElement>(SEL.dateContainer);
  }

  applyCategoryColor(row: HTMLElement, color: string | null): void {
    if (color) {
      row.setAttribute(CATEGORY_ATTR, '');
      row.style.setProperty('--gtc-color', color);
    } else if (row.hasAttribute(CATEGORY_ATTR)) {
      row.removeAttribute(CATEGORY_ATTR);
      row.style.removeProperty('--gtc-color');
    }
  }

  clearAllColors(): void {
    document.querySelectorAll<HTMLElement>(`[${CATEGORY_ATTR}]`).forEach((row) => this.applyCategoryColor(row, null));
  }

  findHeaderAnchor(): Element | null {
    return document.querySelector(SEL.headerAnchor);
  }

  isDarkTheme(): boolean {
    const match = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g);
    if (!match || match.length < 3) return false;
    const [r, g, b] = match.map(Number) as [number, number, number];
    return 0.299 * r + 0.587 * g + 0.114 * b < 128;
  }

  private collect(records: MutationRecord[]): void {
    for (const record of records) {
      // Skip mutations caused only by our own elements to avoid feedback loops,
      // except removals inside a task row: Google Tasks re-renders the date
      // container (e.g. for tasks without a due date) and drops our button.
      const nodes = [...record.addedNodes, ...record.removedNodes];
      const removedFromRow = record.removedNodes.length > 0 && record.target instanceof Element && !!this.getRowOf(record.target);
      if (nodes.length && nodes.every(isOwnNode) && !removedFromRow) continue;
      if (record.target instanceof Element) this.pending.add(record.target);
      record.addedNodes.forEach((node) => node instanceof Element && this.pending.add(node));
    }
    if (this.pending.size && !this.frame) {
      this.frame = requestAnimationFrame(() => this.flush());
    }
  }

  private flush(): void {
    this.frame = 0;
    const rows = new Set<HTMLElement>();
    for (const el of this.pending) {
      if (!el.isConnected) continue;
      const row = this.getRowOf(el);
      if (row) rows.add(row);
      el.querySelectorAll<HTMLElement>(SEL.row).forEach((r) => rows.add(r));
    }
    this.pending.clear();
    if (rows.size) this.handlers.onRows([...rows]);
    this.handlers.onFlush();
  }
}

function isOwnNode(node: Node): boolean {
  return node instanceof Element ? node.classList.contains(OWN_CLASS) : node.nodeType !== Node.ELEMENT_NODE;
}
