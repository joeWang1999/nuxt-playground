# Figma Design Token 建置與調整說明

本專案把 Figma Variables 匯出成 JSON，透過 [Style Dictionary](https://styledictionary.com/) 轉成 CSS 變數與 Tailwind 設定，讓元件可以直接用 `bg-surface-default`、`text-brand` 這類語意化 class。

## 1. 整體流程

```
Figma Variables
   │  (Figma 外掛匯出 DTCG 格式 JSON)
   ▼
tokens/tokens.json                ← 唯一需要手動更新的來源檔
   │  npm run tokens  (style-dictionary.config.mjs)
   ├──► app/assets/css/tokens.css      CSS 變數 (:root)，自動產生
   └──► tokens/tailwind.tokens.json    Semantic token → var(--xxx)，自動產生
                │
                ▼
          tailwind.config.ts        把各分類對應到 Tailwind 的 textColor / backgroundColor ...
                │
                ▼
          元件中使用 class：bg-surface-default、text-primary、border-brand ...
```

| 檔案 | 角色 | 可否手動修改 |
| --- | --- | --- |
| `tokens/tokens.json` | Figma 匯出的原始 token | ✅ 由 Figma 匯出後覆蓋 |
| `style-dictionary.config.mjs` | 轉換規則（命名、輸出格式） | ✅ 需要調整規則時 |
| `app/assets/css/tokens.css` | 產出的 CSS 變數 | ❌ 自動產生 |
| `tokens/tailwind.tokens.json` | 產出的 Tailwind 對應表 | ❌ 自動產生 |
| `tailwind.config.ts` | 將 token 分類掛到 Tailwind utility | ✅ 新增分類時 |
| `nuxt.config.ts` | 透過 `css: ['~/assets/css/tokens.css']` 全域載入變數 | 通常不需要 |

## 2. Token 結構

Token 分成兩層：

### Primitive（原始色票）

實際的色碼，只描述「是什麼顏色」，不描述用途。

```json
"Primitive": {
  "Primitive": {            // 第一層是 collection 名稱，第二層是 mode 名稱
    "color": {
      "grey": {
        "800": { "$value": "#2b2b2b", "$type": "color" }
      }
    }
  }
}
```

產出：`--color-grey-800: #2b2b2b;`

> Primitive **不會**輸出到 Tailwind，元件中請勿直接使用色票，一律透過 Semantic token。

### Semantic（語意 token）

描述「用在哪裡」，值以 `{...}` 參照 Primitive。

```json
"Semantic": {
  "color": {
    "text": {
      "primary": { "$value": "{Primitive.Primitive.color.grey.800}", "$type": "color" }
    }
  }
}
```

產出：

- CSS：`--color-text-primary: var(--color-grey-800);`（保留參照，`outputReferences: true`）
- Tailwind：`text.primary = "var(--color-text-primary)"`

### 命名規則

`style-dictionary.config.mjs` 中的 `name/figma-kebab` transform 會去掉 Figma 的 collection / mode 前綴，再以 `-` 串接：

| Token 路徑 | CSS 變數 |
| --- | --- |
| `Primitive.Primitive.color.green.600` | `--color-green-600` |
| `Semantic.color.text.primary` | `--color-text-primary` |
| `Semantic.color.tag.primary.strong` | `--color-tag-primary-strong` |

## 3. 初次建置

1. 安裝相依套件（`style-dictionary` 已列在 devDependencies）：

   ```bash
   npm install
   ```

2. 在 Figma 中整理 Variables：
   - 建立 `Primitive` collection 放色票（例如 `color/grey/800`）。
   - 建立 `Semantic` collection，變數以 alias 方式指向 Primitive（例如 `color/text/primary → grey/800`）。
   - Semantic 的第二層名稱即為分類（`background`、`surface`、`tag`、`text`、`icon`、`border`），請與第 5 節的 Tailwind 對應保持一致。

3. 使用 Figma 外掛將 Variables 匯出為 **DTCG（W3C Design Tokens）格式** 的 JSON（`$value` / `$type`，參照使用 `{a.b.c}`），存成 `tokens/tokens.json`。

4. 產生 CSS 與 Tailwind 對應表：

   ```bash
   npm run tokens
   ```

5. 啟動專案確認：

   ```bash
   npm run dev
   ```

## 4. 調整 Token（日常流程）

### 4.1 修改既有顏色

1. 在 Figma 修改 Variable 的值。
2. 重新匯出並覆蓋 `tokens/tokens.json`。
3. 執行 `npm run tokens`。
4. 用 `git diff app/assets/css/tokens.css tokens/tailwind.tokens.json` 確認變更符合預期。
5. 將 `tokens.json` 與兩個產出檔一起 commit。

只改色碼時 class 名稱不變，元件不用動。

### 4.2 新增 Semantic token（既有分類）

例如在 `text` 下新增 `success`：

1. 在 Figma 的 Semantic collection 新增 `color/text/success`，指向某個 Primitive。
2. 匯出 → `npm run tokens`。
3. 直接在元件使用 `text-success`，不需修改 `tailwind.config.ts`。

### 4.3 新增分類

例如新增 `Semantic.color.overlay.*`：

1. Figma 新增並匯出 → `npm run tokens`，`tailwind.tokens.json` 會多出 `overlay` 區塊。
2. 修改 `tailwind.config.ts`：在解構中加入新分類，並掛到適合的 utility：

   ```ts
   const { background = {}, surface = {}, tag = {}, text = {}, icon = {}, border = {}, overlay = {} } =
     tokens as Record<string, Record<string, unknown>>

   // ...
   backgroundColor: { background, surface, tag, overlay },
   ```

### 4.4 刪除或改名 token

改名或刪除後，原本使用舊 class 的地方**不會報錯**，只是樣式失效。請先全域搜尋舊名稱再調整：

```bash
# 例：要移除 text-highlight
grep -rn "text-highlight" app/
```

## 5. 在元件中使用

`tailwind.config.ts` 目前的對應：

| Token 分類 | Tailwind utility | 範例 |
| --- | --- | --- |
| `text` | `textColor` | `text-primary`、`text-brand`、`text-inverse` |
| `icon` | `textColor`、`fill`、`stroke` | `text-icon-primary`、`fill-icon-brand`、`stroke-icon-primary` |
| `tag` | `textColor`、`backgroundColor` | `text-tag-secondary-strong`、`bg-tag-primary-subtle` |
| `background` | `backgroundColor` | `bg-background-default` |
| `surface` | `backgroundColor` | `bg-surface-default`、`bg-surface-brand-subtle` |
| `border` | `borderColor` | `border-default`、`border-brand` |

```vue
<div class="bg-surface-brand-subtle text-brand border border-brand">test</div>
```

不在 Tailwind 時（例如 `<style>`、canvas、inline style）可直接用 CSS 變數：

```css
.custom {
  color: var(--color-text-primary);
}
```

## 6. 常見問題

**`npm run tokens` 出現 reference 錯誤**
Semantic 參照到的 Primitive 不存在於 `tokens.json`（例如 Figma 匯出時漏選了 Primitive collection，或該色票已被刪除）。請確認匯出時兩個 collection 都有包含，或修正 Semantic 的 alias。

**新增的 class 沒有效果**
- 確認已執行 `npm run tokens`，且 `tailwind.tokens.json` 有該 token。
- 確認該分類有在 `tailwind.config.ts` 掛到對應 utility（第 4.3 節）。
- 修改 `tailwind.config.ts` 後如未生效，重啟 `npm run dev`。

**Figma 匯出的路徑前綴不同**
若換了匯出外掛，或 collection / mode 名稱改變，`tokens.json` 的頂層結構可能不同（例如沒有 `Primitive.Primitive` 這層 mode）。請調整 `style-dictionary.config.mjs` 中的 `stripPrefix` 與 `tailwind/semantic` format 裡的 `token.path` 判斷。

**多個 mode（例如 Light / Dark）**
目前設定只處理單一 mode。若要支援多 mode，需要在 Style Dictionary 中針對各 mode 分別輸出（例如 `:root` 與 `[data-theme="dark"]`），屆時再擴充設定檔。
