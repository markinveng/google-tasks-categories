import { OWN_CLASS } from '@/adapters/GoogleTasksDOMAdapter';
import type { CategoryService } from '@/services/CategoryService';
import type { Category } from '@/types/category';
import { createTagIcon, isolateEvents } from './CategoryButton';

const DEFAULT_COLOR = '#A855F7';

export class CategoryManager {
  readonly headerButton: HTMLButtonElement;
  private dialog: HTMLDialogElement;
  private list: HTMLUListElement;
  private error: HTMLParagraphElement;
  private pendingDeleteId: string | null = null;

  constructor(private service: CategoryService) {
    this.headerButton = document.createElement('button');
    this.headerButton.type = 'button';
    this.headerButton.id = 'gtc-header-btn';
    this.headerButton.className = `${OWN_CLASS} gtc-header-btn`;
    const label = document.createElement('span');
    label.textContent = 'カテゴリ管理';
    this.headerButton.append(createTagIcon(), label);
    this.headerButton.addEventListener('click', () => this.open());

    this.dialog = document.createElement('dialog');
    this.dialog.className = `${OWN_CLASS} gtc-dialog`;
    this.dialog.setAttribute('aria-labelledby', 'gtc-dialog-title');
    // Keep Google Tasks keyboard shortcuts from firing while typing in the dialog.
    isolateEvents(this.dialog, ['keydown', 'keyup', 'keypress', 'pointerdown', 'mousedown', 'click']);
    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog) this.dialog.close();
    });

    const header = document.createElement('div');
    header.className = 'gtc-dialog-header';
    const title = document.createElement('h2');
    title.id = 'gtc-dialog-title';
    title.textContent = 'カテゴリ管理';
    const close = this.createTextButton('閉じる', 'gtc-btn', () => this.dialog.close());
    header.append(title, close);

    this.list = document.createElement('ul');
    this.list.className = 'gtc-category-list';

    this.error = document.createElement('p');
    this.error.className = 'gtc-error';
    this.error.setAttribute('role', 'alert');

    this.dialog.append(header, this.list, this.createAddForm(), this.error);
    this.dialog.addEventListener('close', () => {
      this.pendingDeleteId = null;
      this.setError('');
    });
  }

  open(): void {
    if (!this.dialog.isConnected) document.body.append(this.dialog);
    if (!this.dialog.open) this.dialog.showModal();
    this.render();
  }

  destroy(): void {
    this.dialog.close();
    this.dialog.remove();
    this.headerButton.remove();
  }

  render(): void {
    if (!this.dialog.open) return;
    const categories = this.service.getCategories();
    if (!categories.length) {
      const empty = document.createElement('li');
      empty.className = 'gtc-empty';
      empty.textContent = 'カテゴリはまだありません';
      this.list.replaceChildren(empty);
      return;
    }
    this.list.replaceChildren(...categories.map((c) => this.createRow(c)));
  }

  private createRow(category: Category): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'gtc-category-row';

    if (this.pendingDeleteId === category.id) {
      const message = document.createElement('span');
      message.className = 'gtc-confirm-text';
      message.textContent = `「${category.name}」を削除しますか？関連タスクは未分類に戻ります。`;
      li.append(
        message,
        this.createTextButton('キャンセル', 'gtc-btn', () => {
          this.pendingDeleteId = null;
          this.render();
        }),
        this.createTextButton('削除', 'gtc-btn gtc-btn--danger', () => {
          this.pendingDeleteId = null;
          void this.run(() => this.service.deleteCategory(category.id));
        }),
      );
      return li;
    }

    const color = this.createColorInput(category.color, `${category.name}の色`);
    color.addEventListener('change', () => void this.run(() => this.service.updateCategory(category.id, { color: color.value })));

    const name = document.createElement('input');
    name.type = 'text';
    name.className = 'gtc-input';
    name.value = category.name;
    name.setAttribute('aria-label', 'カテゴリ名');
    name.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') name.blur();
    });
    name.addEventListener('change', () => {
      if (name.value.trim() === category.name) return;
      void this.run(() => this.service.updateCategory(category.id, { name: name.value })).then((ok) => {
        if (!ok) name.value = category.name;
      });
    });

    const remove = this.createTextButton('削除', 'gtc-btn', () => {
      this.pendingDeleteId = category.id;
      this.render();
    });
    li.append(color, name, remove);
    return li;
  }

  private createAddForm(): HTMLFormElement {
    const form = document.createElement('form');
    form.className = 'gtc-add-form';
    const color = this.createColorInput(DEFAULT_COLOR, '新しいカテゴリの色');
    const name = document.createElement('input');
    name.type = 'text';
    name.className = 'gtc-input';
    name.placeholder = '新しいカテゴリ名';
    name.setAttribute('aria-label', '新しいカテゴリ名');
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'gtc-btn gtc-btn--primary';
    submit.textContent = '追加';
    form.append(color, name, submit);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.run(() => this.service.createCategory(name.value, color.value)).then((ok) => {
        if (ok) name.value = '';
        name.focus();
      });
    });
    return form;
  }

  private createColorInput(value: string, label: string): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'gtc-circle gtc-color-input';
    input.value = value.toLowerCase();
    input.title = '色を変更';
    input.setAttribute('aria-label', label);
    return input;
  }

  private createTextButton(text: string, className: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    button.addEventListener('click', onClick);
    return button;
  }

  private async run(action: () => Promise<void>): Promise<boolean> {
    try {
      await action();
      this.setError('');
      return true;
    } catch (e) {
      this.setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }

  private setError(message: string): void {
    this.error.textContent = message;
  }
}
