import './style.css';
import { GoogleTasksDOMAdapter } from '@/adapters/GoogleTasksDOMAdapter';
import { CATEGORY_BUTTON_CLASS, createCategoryButton, updateCategoryButton } from '@/components/CategoryButton';
import { CategoryDropdown } from '@/components/CategoryDropdown';
import { CategoryManager } from '@/components/CategoryManager';
import { CategoryService } from '@/services/CategoryService';
import { applyTheme, placeBeforeHeaderAnchor } from '@/utils/page';

export default defineContentScript({
  matches: ['https://tasks.google.com/*'],
  // Google Calendar (calendar.google.com/.../r/tasks) shows Tasks in a
  // tasks.google.com/embed/ iframe; the calendar content script owns the header button there.
  allFrames: true,
  async main(ctx) {
    const service = new CategoryService();
    await service.init();
    if (ctx.isInvalid) return;

    const embedded = window !== window.top;
    const manager = new CategoryManager(service);
    const dropdown = new CategoryDropdown(service);

    const adapter = new GoogleTasksDOMAdapter({
      onRows: (rows) => rows.forEach(renderRow),
      onFlush: () => {
        applyTheme();
        if (!embedded) placeHeaderButton();
        dropdown.refresh();
      },
    });

    // Reusing the same button per row keeps an open dropdown anchored when
    // Google Tasks removes the button and we put it back.
    const buttons = new WeakMap<HTMLElement, HTMLButtonElement>();

    function renderRow(row: HTMLElement): void {
      const ref = adapter.getTaskRef(row);
      const category = ref ? service.getCategoryForTask(ref) : undefined;
      adapter.applyCategoryColor(row, category?.color ?? null);

      const container = ref ? adapter.getExpandedDateContainer(row) : null;
      let button = buttons.get(row);
      if (!container) {
        button?.remove();
        return;
      }
      if (!button) {
        button = createCategoryButton(openDropdown);
        buttons.set(row, button);
      }
      // Keep the button as the last item, right after the date/time control.
      if (container.lastElementChild !== button) container.append(button);
      updateCategoryButton(button, category);
    }

    function openDropdown(button: HTMLButtonElement): void {
      const row = adapter.getRowOf(button);
      const ref = row && adapter.getTaskRef(row);
      if (!ref) return;
      dropdown.toggle({
        anchor: button,
        currentId: service.getCategoryForTask(ref)?.id ?? null,
        onSelect: (categoryId) => {
          service.assign(ref, categoryId).catch((e) => console.error('[Google Tasks Categories]', e));
          button.focus();
        },
      });
    }

    function placeHeaderButton(): void {
      const button = manager.headerButton;
      if (placeBeforeHeaderAnchor(button)) {
        button.classList.remove('gtc-header-btn--floating');
      } else if (!button.isConnected) {
        button.classList.add('gtc-header-btn--floating');
        document.body.append(button);
      }
    }

    const unsubscribe = service.subscribe(() => {
      adapter.getAllRows().forEach(renderRow);
      manager.render();
      dropdown.refresh();
    });

    adapter.start();

    ctx.onInvalidated(() => {
      adapter.stop();
      unsubscribe();
      service.dispose();
      dropdown.close();
      manager.destroy();
      document.querySelectorAll(`.${CATEGORY_BUTTON_CLASS}`).forEach((el) => el.remove());
      adapter.clearAllColors();
      delete document.documentElement.dataset.gtcTheme;
    });
  },
});
