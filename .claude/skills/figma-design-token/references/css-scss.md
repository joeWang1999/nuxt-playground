# 一般 CSS / SCSS / Sass 接線方式

設定：`TAILWIND = false`。使用 SCSS 或 Sass（縮排語法）時另外設 `SCSS = true`。

## 產出

| 檔案 | 內容 | 何時產生 |
| --- | --- | --- |
| `<STYLE_OUT>/tokens.css` | `:root { --color-text-primary: var(--color-grey-800); ... }` | 一律 |
| `<STYLE_OUT>/_tokens.scss` | `$color-text-primary: var(--color-text-primary);` | `SCSS = true` |

SCSS 變數的值刻意指向 CSS 變數，而不是直接寫死色碼：這樣執行期切換主題（改寫 `--color-*`）時，用 SCSS 變數寫的樣式也會跟著變。代價是無法在 SCSS 編譯期對這些值做 `darken()`、`mix()` 之類的色彩運算——需要變色時請在 Figma 新增對應的 token，或使用 CSS 的 `color-mix()`。

## 載入 tokens.css（全域一次）

見 SKILL.md 的「載入 tokens.css」。

## 純 CSS 使用方式

```css
.card {
  background: var(--color-surface-default);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-subtle);
}
```

```vue
<style scoped>
.title { color: var(--color-text-brand); }
</style>
```

## SCSS / Sass 使用方式

先安裝編譯器（若尚未安裝）：

```bash
npm i -D sass-embedded
```

### 方式 A：每個檔案自行 `@use`（簡單、明確）

```scss
@use '@/assets/styles/tokens' as *;   // Vue 3 + Vite（@ 指向 src）
// Nuxt：@use '~/assets/css/tokens' as *;

.card {
  color: $color-text-primary;
}
```

### 方式 B：全域注入（每個元件都能直接用 `$color-*`）

`_tokens.scss` 只有變數、不輸出任何 CSS，所以全域注入不會造成重複樣式。

Vue 3 + Vite（`vite.config.ts`）：

```ts
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: { additionalData: `@use "@/assets/styles/tokens" as *;\n` },
    },
  },
})
```

Nuxt（`nuxt.config.ts`），路徑依 `STYLE_OUT` 調整：

```ts
export default defineNuxtConfig({
  css: ['~/assets/css/tokens.css'],
  vite: {
    css: {
      preprocessorOptions: {
        scss: { additionalData: `@use "~/assets/css/tokens" as *;\n` },
      },
    },
  },
})
```

注入的檔案本身不能再 `@use` 自己，所以若專案已有全域 SCSS 入口檔（例如 `main.scss` 已手動 `@use 'tokens'`），擇一即可。

Sass 縮排語法（`.sass`）：`@use` 寫法相同，只是不加分號；`additionalData` 需改設 `sass` 這個 key（`preprocessorOptions.sass`），內容結尾不加 `;`：

```ts
sass: { additionalData: `@use "@/assets/styles/tokens" as *\n` },
```

## 驗證

```bash
npm run build
```

- 建置成功（SCSS 變數都有解析到）。
- 在輸出的 CSS 中能找到 `--color-text-primary` 的定義（`:root`）與使用處（`var(--color-text-primary)`）。
