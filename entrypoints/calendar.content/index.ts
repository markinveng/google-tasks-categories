import '../tasks.content/style.css';
import { CategoryManager } from '@/components/CategoryManager';
import { CategoryService } from '@/services/CategoryService';
import { applyTheme, placeBeforeHeaderAnchor } from '@/utils/page';

/**
 * Google Calendar's Tasks view renders the task list in a tasks.google.com iframe
 * (handled by the tasks content script); this script only adds the
 * "カテゴリ管理" button next to the support menu in Calendar's own header.
 */
export default defineContentScript({
  matches: ['https://calendar.google.com/*'],
  async main(ctx) {
    const service = new CategoryService();
    await service.init();
    if (ctx.isInvalid) return;

    const manager = new CategoryManager(service);
    const button = manager.headerButton;
    const unsubscribe = service.subscribe(() => manager.render());

    let frame = 0;
    function update(): void {
      frame = 0;
      // Calendar is a single-page app: only show the button while the Tasks view is open.
      if (location.pathname.includes('/r/tasks')) {
        applyTheme();
        if (!placeBeforeHeaderAnchor(button)) button.remove();
      } else {
        button.remove();
      }
    }
    function schedule(): void {
      if (!frame) frame = requestAnimationFrame(update);
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    ctx.addEventListener(window, 'wxt:locationchange', schedule);
    update();

    ctx.onInvalidated(() => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      unsubscribe();
      service.dispose();
      manager.destroy();
      delete document.documentElement.dataset.gtcTheme;
    });
  },
});
