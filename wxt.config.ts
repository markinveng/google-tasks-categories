import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  manifest: {
    name: 'Google Tasks Categories',
    description: 'Google Tasks にカテゴリ管理とタスクの色分けを追加します',
    permissions: ['storage'],
  },
});
