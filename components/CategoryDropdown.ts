import { OWN_CLASS } from '@/adapters/GoogleTasksDOMAdapter';
import type { CategoryService } from '@/services/CategoryService';
import { isolateEvents, keepFocus } from './CategoryButton';

interface OpenOptions {
  anchor: HTMLElement;
  currentId: string | null;
  onSelect(categoryId: string | null): void;
}

interface Item {
  id: string | null;
  el: HTMLElement;
}

const MENU_ID = 'gtc-dropdown';

/**
 * DOM focus never leaves the task while the menu is open (see keepFocus);
 * keyboard navigation moves a highlight exposed via aria-activedescendant.
 */
export class CategoryDropdown {
  private menu: HTMLDivElement;
  private options?: OpenOptions;
  private items: Item[] = [];
  private activeIndex = 0;
  private onOutside = (e: Event) => {
    const target = e.target as Node;
    if (!this.menu.contains(target) && !this.options?.anchor.contains(target)) this.close();
  };
  private onKey = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        this.close();
        break;
      case 'Tab':
        this.close();
        return;
      case 'ArrowDown':
      case 'ArrowUp': {
        const step = e.key === 'ArrowDown' ? 1 : -1;
        this.setActive((this.activeIndex + step + this.items.length) % this.items.length);
        break;
      }
      case 'Enter':
      case ' ':
        this.select(this.items[this.activeIndex]?.id ?? null);
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  };
  private onViewportChange = (e: Event) => {
    if (!this.menu.contains(e.target as Node)) this.close();
  };

  constructor(private service: CategoryService) {
    this.menu = document.createElement('div');
    this.menu.id = MENU_ID;
    this.menu.className = `${OWN_CLASS} gtc-dropdown`;
    this.menu.setAttribute('role', 'menu');
    isolateEvents(this.menu, ['pointerdown', 'mousedown', 'mouseup', 'click', 'keydown', 'keyup']);
    keepFocus(this.menu);
  }

  get isOpen(): boolean {
    return !!this.options;
  }

  toggle(options: OpenOptions): void {
    if (this.options?.anchor === options.anchor) this.close();
    else this.open(options);
  }

  open(options: OpenOptions): void {
    this.close();
    this.options = options;
    this.render();
    this.setActive(Math.max(0, this.items.findIndex((item) => item.id === options.currentId)));
    document.body.append(this.menu);
    this.position();
    options.anchor.setAttribute('aria-expanded', 'true');
    options.anchor.setAttribute('aria-controls', MENU_ID);
    document.addEventListener('pointerdown', this.onOutside, true);
    document.addEventListener('keydown', this.onKey, true);
    window.addEventListener('scroll', this.onViewportChange, true);
    window.addEventListener('resize', this.onViewportChange);
  }

  close(): void {
    if (!this.options) return;
    const { anchor } = this.options;
    anchor.setAttribute('aria-expanded', 'false');
    anchor.removeAttribute('aria-activedescendant');
    this.options = undefined;
    this.menu.remove();
    document.removeEventListener('pointerdown', this.onOutside, true);
    document.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('scroll', this.onViewportChange, true);
    window.removeEventListener('resize', this.onViewportChange);
  }

  /** Re-renders an open menu when categories change, or closes it if its anchor is gone. */
  refresh(): void {
    if (!this.options) return;
    if (!this.options.anchor.isConnected) {
      this.close();
      return;
    }
    const activeId = this.items[this.activeIndex]?.id;
    this.render();
    this.setActive(Math.max(0, this.items.findIndex((item) => item.id === activeId)));
  }

  private render(): void {
    const { currentId } = this.options!;
    const entries = [
      { id: null, name: '未分類', color: null },
      ...this.service.getCategories().map((c) => ({ id: c.id, name: c.name, color: c.color })),
    ];
    this.items = entries.map((entry, index) => ({
      id: entry.id,
      el: this.createItem(index, entry.id, entry.name, entry.color, entry.id === currentId),
    }));
    this.menu.replaceChildren(...this.items.map((item) => item.el));
  }

  private setActive(index: number): void {
    this.activeIndex = index;
    this.items.forEach((item, i) => item.el.classList.toggle('gtc-dropdown-item--active', i === index));
    const active = this.items[index]?.el;
    if (!active) return;
    this.options?.anchor.setAttribute('aria-activedescendant', active.id);
    active.scrollIntoView({ block: 'nearest' });
  }

  private select(id: string | null): void {
    const onSelect = this.options?.onSelect;
    this.close();
    onSelect?.(id);
  }

  private createItem(index: number, id: string | null, name: string, color: string | null, selected: boolean): HTMLElement {
    const item = document.createElement('div');
    item.id = `${MENU_ID}-item-${index}`;
    item.className = 'gtc-dropdown-item';
    item.setAttribute('role', 'menuitemradio');
    item.setAttribute('aria-checked', String(selected));

    const circle = document.createElement('span');
    circle.className = color ? 'gtc-circle' : 'gtc-circle gtc-circle--none';
    if (color) circle.style.backgroundColor = color;

    const label = document.createElement('span');
    label.className = 'gtc-dropdown-label';
    label.textContent = name;

    const check = document.createElement('span');
    check.className = 'gtc-dropdown-check';
    check.textContent = selected ? '✓' : '';

    item.append(circle, label, check);
    item.addEventListener('mouseenter', () => this.setActive(index));
    item.addEventListener('click', () => this.select(id));
    return item;
  }

  private position(): void {
    const rect = this.options!.anchor.getBoundingClientRect();
    const menuRect = this.menu.getBoundingClientRect();
    const margin = 8;
    let top = rect.bottom + 4;
    if (top + menuRect.height > window.innerHeight - margin) top = Math.max(margin, rect.top - menuRect.height - 4);
    const left = Math.min(rect.left, window.innerWidth - menuRect.width - margin);
    this.menu.style.top = `${top}px`;
    this.menu.style.left = `${Math.max(margin, left)}px`;
  }
}
