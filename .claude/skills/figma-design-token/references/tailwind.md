# Tailwind 接線方式

先判斷 Tailwind 版本，兩者接法完全不同：

| 判斷依據 | 版本 |
| --- | --- |
| `tailwindcss` 為 `^3`，或 Nuxt 使用 `@nuxtjs/tailwindcss`（v6 以下內建 TW3） | v3 → `TAILWIND = 'v3'` |
| `tailwindcss` 為 `^4`，有 `@tailwindcss/vite` 或 CSS 內有 `@import "tailwindcss"` | v4 → `TAILWIND = 'v4'` |
| 新專案、尚未安裝 | 預設建議 v4（Vue 3 + Vite、Nuxt 皆可用 `@tailwindcss/vite`） |

## Tailwind v3

產出：`tokens/tailwind.tokens.json`，結構就是 `theme.extend` 的形狀（`{ textColor: {...}, backgroundColor: {...} }`），所以設定檔只要展開即可，新增分類不需要改 tailwind 設定，只要改 Style Dictionary 設定中的 `UTILITIES`。

`tailwind.config.ts`：

```ts
import type { Config } from 'tailwindcss'
// 由 `npm run tokens` 從 tokens/tokens.json 產生，勿手動修改
import tokens from './tokens/tailwind.tokens.json'

export default {
  content: [/* 依專案：Vue 3 + Vite 需要列出 ./index.html、./src/**/*.{vue,ts}；Nuxt 模組會自動處理 */],
  theme: {
    extend: tokens,
  },
} satisfies Partial<Config>
```

若專案原本已有 `tailwind.config`，只在 `theme.extend` 合併 tokens，不要覆蓋其他設定：`extend: { ...tokens, /* 原本的 */ }`。若原本 extend 也有 `textColor` 等同名 key，要逐一合併（`textColor: { ...原本, ...tokens.textColor }`）。

`import ... .json` 需要 `tsconfig` 的 `resolveJsonModule`（Nuxt 與 Vite 範本預設已開）。若設定檔是 `.js`/`.cjs`，改用 `require('./tokens/tailwind.tokens.json')` 或 `import tokens from './tokens/tailwind.tokens.json' with { type: 'json' }`。

CSS 變數仍需全域載入 `tokens.css`（見 SKILL.md 的「載入 tokens.css」）。

## Tailwind v4

產出：`<STYLE_OUT>/tailwind-theme.css`，內容是

```css
@theme inline {
  --text-color-primary: var(--color-text-primary);
  --background-color-surface-default: var(--color-surface-default);
  --border-color-brand: var(--color-border-brand);
  --fill-icon-brand: var(--color-icon-brand);
}
```

為什麼用 `--text-color-*` / `--background-color-*` 而不是 `--color-*`：放在 `--color-*` 的值會同時長出 `text-`、`bg-`、`border-`、`fill-`... 全部 utility，於是出現 `bg-text-primary`、`text-border-brand` 這種沒有意義的 class。分 namespace 後，`text-primary` 只存在於文字顏色，`bg-surface-default` 只存在於背景（已實測 Tailwind 4 會產生這些 class，且不會產生 `bg-primary`）。

為什麼用 `inline`：讓 utility 直接輸出 `color: var(--color-text-primary)`，執行期換主題（例如 dark mode 改寫 `--color-*`）時立刻生效。

在主要 CSS 檔（例如 `src/style.css`、`app/assets/css/main.css`）中，接在 `@import "tailwindcss";` 之後：

```css
@import "tailwindcss";
@import "./tokens.css";
@import "./tailwind-theme.css";
```

路徑依實際檔案位置調整。這樣 `tokens.css` 也一併載入了，不需要再另外在 `nuxt.config` / `main.ts` 匯入。

### 安裝 Tailwind v4（若專案尚未安裝）

Vue 3 + Vite：

```bash
npm i -D tailwindcss @tailwindcss/vite
```

```ts
// vite.config.ts
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({ plugins: [vue(), tailwindcss()] })
```

Nuxt：

```bash
npm i -D tailwindcss @tailwindcss/vite
```

```ts
// nuxt.config.ts
import tailwindcss from '@tailwindcss/vite'
export default defineNuxtConfig({
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },
})
```

## 驗證

建置後在輸出的 CSS 中確認 class 存在，例如：

```bash
npm run build
grep -rho "\.text-primary{[^}]*}" .output dist 2>/dev/null | head
```

Tailwind 只會產生原始碼中有用到的 class，驗證前先在某個元件（或暫時的 demo）放上 `text-primary bg-surface-default border-brand` 等 class。
