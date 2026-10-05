# Design Token 說明

<!-- 模板說明：將 <STYLE_OUT> 等佔位替換成專案實際路徑，刪除不適用的段落（Tailwind / SCSS 擇一），並刪除本註解。 -->

本專案把 Figma Variables 匯出成 JSON，透過 [Style Dictionary](https://styledictionary.com/) 轉成 CSS 變數<!-- 依路線：「與 Tailwind 設定」或「與 SCSS 變數」-->。元件中一律使用語意化 token（例如 `text-primary`、`var(--color-surface-default)`），不要寫死色碼。

## 1. 流程

```
Figma Variables
   │  Figma 外掛匯出 DTCG JSON
   ▼
tokens/tokens.json                 ← 唯一需要更新的來源檔
   │  npm run tokens
   ▼
<STYLE_OUT>tokens.css               CSS 變數（自動產生）
<!-- 依路線保留其一 -->
tokens/tailwind.tokens.json         Tailwind v3 對應表（自動產生）
<STYLE_OUT>tailwind-theme.css       Tailwind v4 @theme（自動產生）
<STYLE_OUT>_tokens.scss             SCSS 變數（自動產生）
```

| 檔案 | 角色 | 可否手動修改 |
| --- | --- | --- |
| `tokens/tokens.json` | Figma 匯出的原始 token | 由 Figma 匯出後覆蓋 |
| `style-dictionary.config.mjs` | 轉換規則與分類對應 | 需要調整規則時 |
| 上方標示「自動產生」的檔案 | 產出 | ❌ 不可，會被覆蓋 |

## 2. Token 結構

- **Primitive**：色票本身，例如 `--color-grey-800: #2b2b2b`。只描述「是什麼顏色」，元件中不直接使用。
- **Semantic**：描述用途，參照 Primitive，例如 `--color-text-primary: var(--color-grey-800)`。元件中只使用這一層。

命名規則：去掉 Figma 的 collection / mode 名稱後，以 `-` 串接路徑。

| Figma 路徑 | CSS 變數 |
| --- | --- |
| <!-- 填入專案實際例子 --> | |

## 3. 使用方式

<!-- Tailwind 路線：填入 UTILITIES 對應表 -->
| Token 分類 | Class 範例 |
| --- | --- |
| `text` | `text-primary` |
| `background` / `surface` | `bg-surface-default` |
| `border` | `border-default` |
| `icon` | `text-icon-primary`、`fill-icon-primary` |

<!-- CSS / SCSS 路線 -->
```css
.card { color: var(--color-text-primary); }
```

```scss
.card { color: $color-text-primary; }
```

## 4. Figma 更新後要做什麼

1. 在 Figma 重新匯出 Variables（Primitive 與 Semantic collection 都要選），覆蓋 `tokens/tokens.json`。
2. 執行 `npm run tokens`。
3. 用 `git diff` 檢查產出檔的變化是否符合預期。
4. 將 `tokens.json` 與產出檔一起 commit。

| 變更類型 | 需要額外處理 |
| --- | --- |
| 修改色碼 | 無 |
| 既有分類新增 token | 無，直接使用新的 class / 變數 |
| 新增分類 | <!-- Tailwind：在 style-dictionary.config.mjs 的 UTILITIES 加上對應；CSS：無 --> |
| 刪除或改名 | 先全域搜尋舊名稱並替換——舊 class 不會報錯，只會讓樣式失效 |

## 5. 常見問題

- **`npm run tokens` 出現 reference 錯誤**：Semantic 參照的 Primitive 不在 `tokens.json` 中，通常是匯出時漏選 collection。
- **出現「沒有對應到 Tailwind utility」的警告**：Figma 新增了分類，請在 `UTILITIES` 加上對應。
- **變數名稱多了 collection 名稱**：Figma collection / mode 改名或換了匯出外掛，請調整設定中的 `PREFIXES`。
