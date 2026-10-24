import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  manifest: {
    name: 'Google Tasks Categories',
    description: 'Google Tasks にカテゴリ管理とタスクの色分けを追加します',
    permissions: ['storage'],
    // Pins the extension ID (ggaicpogiadoogiofgjccmbngigheknh) so storage.sync
    // is shared by unpacked installs on every device. Public key only.
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuEvMeMv3p/UuVfWrcCy8IbliFyqy1ECZqwZmnwb4yQSY13U6kao1nAgO/3LyZ9nGdDNHTXMfrV4UuB0UuXxrc0Zh6MU1yrCL2n6uEIm6wX7O+KbxgtHLd6DxVEhGr4Q3Jt5zf56JQc3IUcLZMLFG0rlcwD/ZVLI8OSxrcvZ2xZoSJDvisvdB2fCxz8og5yDrRqQ+EqyGVjXW9Co9iyLlwqXusvyEskZi1GEcLKfVApGRAJ5ChuTASTLa2G0EJqv4oLpQu3wHM44NZqabRmFYEj4azZvsoxBM4N8rOLwsTEOF3vjikiO2xEFaliDw3O7fpqMML97qgWEk5Yzf1BfM8QIDAQAB',
  },
});
