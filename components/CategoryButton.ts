import { OWN_CLASS } from '@/adapters/GoogleTasksDOMAdapter';
import type { Category } from '@/types/category';

export const CATEGORY_BUTTON_CLASS = 'gtc-cat-btn';

const SVG_NS = 'http://www.w3.org/2000/svg';
const TAG_ICON_PATH =
  'M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16zM16 17H5V7h11l3.55 5L16 17z';

export function createTagIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('gtc-icon');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', TAG_ICON_PATH);
  svg.append(path);
  return svg;
}

/** Prevents Google Tasks' delegated handlers from reacting to our controls. */
export function isolateEvents(el: HTMLElement, types: string[]): void {
  types.forEach((type) => el.addEventListener(type, (e) => e.stopPropagation()));
}

/**
 * Clicking must not move focus: Google Tasks collapses a task's edit area when
 * focus leaves it, which would remove our button together with its dropdown.
 */
export function keepFocus(el: HTMLElement): void {
  el.addEventListener('mousedown', (e) => e.preventDefault());
}

export function createCategoryButton(onOpen: (button: HTMLButtonElement) => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `${OWN_CLASS} ${CATEGORY_BUTTON_CLASS}`;
  button.setAttribute('aria-haspopup', 'menu');
  button.append(createTagIcon());
  const label = document.createElement('span');
  label.className = 'gtc-cat-btn-label';
  button.append(label);

  isolateEvents(button, ['pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick', 'keydown', 'keyup']);
  keepFocus(button);
  button.addEventListener('click', (e) => {
    e.preventDefault();
    onOpen(button);
  });
  button.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(button);
    }
  });
  return button;
}

export function updateCategoryButton(button: HTMLButtonElement, category: Category | undefined): void {
  const label = category ? `カテゴリ: ${category.name}` : 'カテゴリを設定';
  if (button.title !== label) {
    button.title = label;
    button.setAttribute('aria-label', label);
  }
  const text = button.querySelector('.gtc-cat-btn-label')!;
  if (text.textContent !== (category?.name ?? '')) text.textContent = category?.name ?? '';
  button.classList.toggle('gtc-cat-btn--assigned', !!category);
  if (category) button.style.setProperty('--gtc-color', category.color);
  else button.style.removeProperty('--gtc-color');
}
