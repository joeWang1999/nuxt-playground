---
name: figma-design-token
description: 在 Vue 3 / Nuxt 3 / Nuxt 4 專案中建置 Figma design token 流程：Figma Variables 匯出成 DTCG JSON，透過 Style Dictionary 轉成 CSS 變數，並接上 Tailwind（v3 或 v4）或一般 CSS / SCSS / Sass。當使用者提到 design token、設計 token、Figma Variables、Figma 色票轉 CSS 變數、Style Dictionary、tokens.json、把 Figma 顏色接到 Tailwind 或 SCSS、建立語意色（text-primary、bg-surface 等）時，都要使用這個 skill，就算他們沒有明說「design token」也一樣，例如「設計師給了 Figma 變數，幫我接進專案」。也涵蓋已建好流程後的更新：使用者說「design token 更新」、「token 更新了」、「Figma 改了顏色」、「設計師重新匯出了 tokens.json」、「套用新的 token」時也要使用。Use for Figma design tokens setup and updates in Vue/Nuxt with Tailwind or SCSS.
---

# Figma Design Token 建置

目標：在 Vue 3 或 Nuxt 專案中建立一條可重複執行的流程

```
Figma Variables ──(外掛匯出 DTCG JSON)──► tokens/tokens.json
     ──(npm run tokens：先格式檢核，通過才執行 Style Dictionary)──► tokens.css（CSS 變數）
                                           ├► Tailwind：v3 JSON 或 v4 @theme CSS
                                           └► SCSS：_tokens.scss
```

設計師之後只要重新匯出 `tokens.json`、開發者執行 `npm run tokens`，整個專案的顏色就會更新。這個流程的價值在於「只有一個來源檔」，所以所有產出檔都是自動產生的，不要手動修改。

## 附帶的檔案

- `assets/style-dictionary.config.mjs`：Style Dictionary 設定模板。頂端「專案設定」區塊是唯一需要調整的地方。已實測可產出 CSS 變數、Tailwind v3 JSON、Tailwind v4 `@theme`、SCSS 變數。
- `assets/validate-tokens.mjs`：建置前的 tokens.json 格式檢核腳本（不需安裝套件），見「格式檢核」。
- `assets/tokens.sample.json`：範例 token。設計師還沒給檔案時，先用它把流程打通。
- `assets/design-token-doc.md`：專案內說明文件的模板。
- `references/tailwind.md`：Tailwind v3 / v4 的接線方式與驗證。走 Tailwind 路線時閱讀。
- `references/css-scss.md`：一般 CSS、SCSS、Sass 的接線方式與驗證。走 CSS 路線時閱讀。

## 格式檢核（兩條流程共用）

兩條流程在執行 `npm run tokens` 之前都要先檢核 tokens.json。Figma 外掛的匯出結果常有漏選 collection、參照斷掉等問題，Style Dictionary 遇到時只會丟出一段難讀的錯誤，或者更糟：建置成功，但默默產出錯誤的變數。

### 安裝檢核腳本

專案的 `package.json` 還沒有 `tokens:check` script 時（首次建置，或是在加入檢核之前建好的專案），先安裝：

1. 複製 `assets/validate-tokens.mjs` 到專案的 `scripts/validate-tokens.mjs`。
2. `package.json` 的 scripts 改成這樣，讓 `npm run tokens` 本身就會先檢核，檢核失敗時 `&&` 後面的建置就不會執行：

   ```json
   "tokens:check": "node scripts/validate-tokens.mjs",
   "tokens": "node scripts/validate-tokens.mjs && style-dictionary build --config style-dictionary.config.mjs"
   ```

3. 在 `.gitignore` 加上 `tokens/tokens-validation-report.md`（報告是暫時的，不要 commit）。

腳本會讀取 `style-dictionary.config.mjs` 的 `source` 和命名規則，所以多 mode、多個來源檔也能一起檢核（跨檔參照會一併檢查）。

### 執行與判斷

```bash
npm run tokens:check
```

| 結果 | 代表 | 處理方式 |
| --- | --- | --- |
| `✔ tokens 檢核通過`（exit 0） | 沒有問題 | 繼續執行 `npm run tokens` |
| 只有 `⚠` 警告（exit 0） | 建置會成功，但產出可能不正確 | 繼續流程，把警告列入最後的回報 |
| 有 `✖` 錯誤（exit 1） | 執行 `npm run tokens` 一定會失敗 | **中斷流程**，見下方 |

檢核項目：

- **錯誤**：檔案不存在、JSON 語法錯誤（會指出行號與欄位）、參照找不到 token（指向不存在的路徑，或是指向群組而不是 token）、循環參照、名稱含 `{` 或 `}`。
- **警告**：轉成 CSS 變數後名稱重複（通常是 `PREFIXES` 沒有涵蓋新的 collection / mode）、`$type: color` 但值不是有效的顏色、`$value` 是空的、token 底下又有子 token、名稱含 `.`、同一路徑重複定義、檔案裡沒有任何 token。

這些分類都已經用 Style Dictionary 5 實測過：錯誤類會讓建置失敗，警告類會建置成功，但產出錯誤的 CSS。

### 檢核失敗時（有錯誤）

1. 停止流程：不要執行 `npm run tokens`、不要修改任何程式碼或設定檔，也不要進行後續步驟。
2. 不要直接修改 `tokens.json` 來繞過錯誤。這個檔案下次從 Figma 匯出時就會被覆蓋，問題應該在 Figma 端修正。
3. 檢核報告已產生在 `tokens/tokens-validation-report.md`，內容包括每個問題的檔案行號、token 路徑、原因，以及對參照錯誤的提示（例如「`Primitive` 底下沒有 `Light`，現有的是 `Primitive`」）。把報告路徑和錯誤摘要告訴使用者，並說明可能的原因：
   - 參照的最上層名稱不存在 → 匯出時漏選了 collection，或 collection / mode 改了名稱。
   - 路徑大致正確，但最後幾層對不上 → Figma 刪除或改名了被參照的變數。
   - JSON 語法錯誤 → 檔案沒有完整複製，或被手動編輯過。
4. 例外：錯誤明顯是因為 Figma 的 collection / mode 改名，而且需要調整 `style-dictionary.config.mjs`（例如 `PREFIXES`）時，可以向使用者提議修改設定。修改前先徵得同意；tokens.json 本身的參照錯誤還是要由 Figma 修正。
5. 請使用者修正並重新匯出後，再呼叫一次這個 skill，從頭開始流程。

## 先判斷：首次建置還是更新

- 專案已有 `style-dictionary.config.mjs`、`tokens/tokens.json` 與 `tokens` npm script → 走下方「更新 token 流程」。
- 沒有 → 走「首次建置流程」。

## 更新 token 流程

### U1. 確認新檔案已放入專案（必要，不可跳過）

開始任何動作之前，先詢問使用者：

> 新的 token 檔案是否已加入專案（覆蓋 `tokens/tokens.json`）？

- 使用者明確回答「是」→ 繼續 U2。
- 其他任何回答（否、還沒、不確定、沒回答）→ 停止，不要執行任何指令或修改檔案。告訴使用者：把 Figma 匯出的 JSON 覆蓋 `tokens/tokens.json`（多 mode 時覆蓋對應的檔案），完成後再呼叫一次。

即使從檔案修改時間或內容看起來已經更新，也要先問；使用者可能還在整理檔案。

### U2. 保存舊的產出檔

執行 `npm run tokens` 之前，先保存目前的產出檔，供 U5 比對：

- 專案有 git 且產出檔已 commit → 不需另存，之後用 `git diff` 比對即可。
- 否則把 `tokens.css`（以及 `tailwind-theme.css` / `tailwind.tokens.json` / `_tokens.scss`，看專案有哪些）複製到暫存目錄。

### U3. 檢查新 token 結構

打開新的 `tokens.json`，對照 `style-dictionary.config.mjs` 的「專案設定」：

- 頂層 collection / mode 名稱有沒有改變（例如 `Primitive.Primitive` 變成 `Primitive.Light`）→ 需要調整 `PREFIXES` / `SEMANTIC_COLOR_ROOT`。
- 有沒有新增 Semantic 分類（Tailwind 路線要在 `UTILITIES` 加上對應）。
- 是否多了 mode 或非顏色 token（見「進階情況」）。

結構有變時先調整設定，再進行下一步。

### U4. 格式檢核（必要，不可跳過）

依「格式檢核」執行 `npm run tokens:check`（專案還沒有這個 script 時先安裝）。

- 有錯誤 → 依「檢核失敗時」中斷流程並回報，不要繼續 U5 之後的步驟。
- 通過或只有警告 → 繼續 U5，警告列入 U9 的回報。

### U5. 重新產生並比對差異

```bash
npm run tokens
```

確認沒有 reference 錯誤或「沒有對應到 Tailwind utility」的警告，然後比對新舊產出檔，列出：

- **刪除**的 token（CSS 變數名稱，Tailwind 路線再換算成 class，例如 `--border-color-subtle` → `border-subtle`）。
- **新增**的 token。
- **值改變**的 token（例如參照的 Primitive 換了）。

### U6. 找出程式碼中失效的用法

在原始碼中（`src/`、`app/`、`components/`、`pages/` 等，看專案結構）搜尋每個被刪除的 token：Tailwind class、`var(--color-...)`、SCSS `$color-...`。被刪除的 class 不會讓建置失敗，只會讓樣式默默失效，所以這一步不能省。

對每個仍在使用的失效 token：

- 新 token 中有明顯的替代（例如只是改名，或同用途的新 token）→ 直接替換，並在回報中列出。
- 沒有明確替代 → 詢問使用者要怎麼處理（例如改用某個現有 token、先拿掉該樣式、請設計師補 token）。不要自己改用 Primitive 變數或寫死色碼。

### U7. 檢查新 token 的設計問題

快速檢查並在回報時提出（不需要自己修）：

- 不同用途的 Semantic token 指向同一個 Primitive，導致元件中狀態無法區分（例如 hover 色與 active 色相同）。
- Primitive 色階明顯錯誤（例如 `50` 比 `100` 深）。
- 元件需要但新 token 中缺少的類型（例如沒有中性邊框色）。

### U8. 更新文件並驗證

- 更新 `docs/design-token.md` 中的 class / 變數範例與分類對應表，移除已刪除的 token。
- `npm run build` 成功，並在輸出 CSS 中確認新 token 的 class / 變數存在、已刪除的不再被引用。

### U9. 回報

告訴使用者：

- Figma 這次的變更摘要（刪除 / 新增 / 值改變的 token）。
- 程式碼中替換了哪些用法，哪些依使用者決定處理。
- U7 發現的設計問題，以及 U4 的檢核警告，可以回報給設計師。
- 提醒把 `tokens.json` 與產出檔一起 commit。

## 首次建置流程

### 1. 了解專案

先看專案再發問，能從檔案判斷的就不要問使用者：

- **框架**：`package.json` 有 `nuxt` → Nuxt（major 4 或有 `app/` 目錄就是 Nuxt 4 結構）；有 `vue` + `vite` → Vue 3 + Vite。
- **樣式方案**：有 `tailwindcss` / `@nuxtjs/tailwindcss` / `@tailwindcss/vite` → Tailwind（版本判斷見 `references/tailwind.md`）；有 `sass` / `sass-embedded` 或 `.scss` / `.sass` 檔 → SCSS。
- **token 來源**：使用者有沒有提供 Figma 匯出的 JSON。

只有判斷不出來的事情才問，通常是「要用 Tailwind 還是一般 CSS/SCSS」（全新專案時）以及「是否已有 Figma 匯出的 JSON」。

依專案決定 `STYLE_OUT`（產出的 CSS 放置位置）：

| 專案 | STYLE_OUT | 全域樣式的載入方式 |
| --- | --- | --- |
| Nuxt 4（有 `app/`） | `app/assets/css/` | `nuxt.config.ts` 的 `css` |
| Nuxt 3 | `assets/css/` | `nuxt.config.ts` 的 `css` |
| Vue 3 + Vite | `src/assets/styles/` | `src/main.ts` 匯入 |

如果專案已經有慣用的樣式目錄，沿用它。

### 2. 安裝 Style Dictionary

```bash
npm i -D style-dictionary
```

模板使用 v4 以上的 ESM 設定與 `hooks` API（v4、v5 皆可）。專案使用 pnpm / yarn / bun 時，改用對應指令（看 lock 檔判斷）。

### 3. 放置 token 檔

- 使用者有提供 JSON：放到 `tokens/tokens.json`。
- 沒有：複製 `assets/tokens.sample.json` 到 `tokens/tokens.json`，並告訴使用者這是範例，之後要以 Figma 匯出的檔案覆蓋。

### 4. 讀懂 token 結構並調整設定

複製 `assets/style-dictionary.config.mjs` 到專案根目錄，然後**實際打開 `tokens.json` 看結構**再調整「專案設定」區塊——Figma 外掛不同、collection / mode 命名不同，頂層結構就會不同，這是最容易出錯的地方：

- `PREFIXES`：要從路徑去掉的 collection / mode 名稱。目標是讓產出的 CSS 變數乾淨，例如 `--color-grey-800`、`--color-text-primary`，而不是 `--primitive-primitive-color-grey-800`。
  - 常見結構：`Primitive.Primitive.color...`（collection + mode）→ `['Primitive', 'Primitive']`；`Semantic.color...`（只有 collection）→ `['Semantic']`。
  - 若 mode 名稱是 `Mode 1`、`Value` 之類的預設名，也要放進前綴。
- `SEMANTIC_COLOR_ROOT`：Semantic 顏色 token 的路徑開頭，下一層要是分類（`text`、`background`、`border`...）。
- `UTILITIES`（Tailwind 才需要）：把 tokens.json 裡實際存在的 Semantic 分類對應到 Tailwind utility。分類名稱和範本不同時（例如 Figma 叫 `fg` 而不是 `text`），在這裡改。沒有對應到的分類，建置時會出現警告。
- `STYLE_OUT`、`TAILWIND`（`'v3'` / `'v4'` / `false`）、`SCSS`（`true` / `false`）。

另外檢查：

- Semantic 的參照（`{Primitive.Primitive.color.grey.800}`）都能在檔案裡找到對應的 Primitive。外掛匯出時漏選 collection 是常見問題，會讓建置時出現 reference 錯誤。
- 有沒有多個 mode（例如 Light / Dark 各一份）或非顏色 token（Figma 的 number 變數）。見下方「進階情況」。

### 5. 加入 npm script、格式檢核，再產生檔案

依「格式檢核」安裝檢核腳本，`package.json` 會有：

```json
"scripts": {
  "tokens:check": "node scripts/validate-tokens.mjs",
  "tokens": "node scripts/validate-tokens.mjs && style-dictionary build --config style-dictionary.config.mjs"
}
```

先執行 `npm run tokens:check`：

- 有錯誤 → 依「檢核失敗時」中斷流程並回報。使用者提供的 Figma JSON 有錯時，不要改用範例 token 繼續建置。
- 通過或只有警告 → 執行：

```bash
npm run tokens
```

確認產出的 `tokens.css` 中變數名稱正確、參照有保留成 `var(--...)`。若名稱怪怪的（還留有 collection 名稱），回到步驟 4 調整 `PREFIXES`。

### 6. 接到專案

**載入 tokens.css**（CSS 變數必須全域載入一次）：

- Nuxt：`nuxt.config.ts` 加上 `css: ['~/assets/css/tokens.css']`（路徑依 `STYLE_OUT`，Nuxt 4 的 `~` 指向 `app/`）。
- Vue 3 + Vite：在 `src/main.ts` 加上 `import './assets/styles/tokens.css'`。
- Tailwind v4 例外：改在主 CSS 檔中 `@import`，見 `references/tailwind.md`。

然後依路線閱讀並照著做：

- Tailwind → `references/tailwind.md`
- 一般 CSS / SCSS / Sass → `references/css-scss.md`

### 7. 驗證

不要只看產出檔就宣告完成，實際建置一次：

1. `npm run tokens:check` 通過，`npm run tokens` 沒有錯誤或未對應分類的警告。
2. 在一個元件中使用幾個 token（Tailwind：`text-primary bg-surface-default border-brand`；CSS：`var(--color-text-primary)` 或 `$color-text-primary`）。若專案沒有適合的地方，可以暫時加在首頁，驗證後詢問使用者是否保留。
3. `npm run build` 成功，並在輸出的 CSS 中找到對應的 class 或變數（細節見各 reference 的「驗證」）。

### 8. 撰寫專案文件

依 `assets/design-token-doc.md` 模板在專案中建立 `docs/design-token.md`（若專案已有其他文件目錄就放那裡），把模板中的路徑、Tailwind 版本、分類對應表替換成這個專案的實際內容，並刪除不適用的段落（例如走 SCSS 路線時刪除 Tailwind 段落）。文件是寫給之後維護這個專案的開發者與設計師看的，重點放在「Figma 改了之後要做什麼」。

### 9. 回報

告訴使用者：

- 新增 / 修改了哪些檔案，哪些是自動產生、不可手動修改的。
- `npm run tokens` 會先自動檢核格式，失敗時報告在 `tokens/tokens-validation-report.md`。
- 可以使用的 class 或變數範例。
- 若使用範例 token：提醒之後要用 Figma 匯出檔覆蓋 `tokens/tokens.json` 後再執行 `npm run tokens`。
- 驗證時發現但未處理的問題（例如格式檢核的警告、未對應的分類）。

產出檔（`tokens.css`、`tailwind.tokens.json` / `tailwind-theme.css`、`_tokens.scss`）建議連同 `tokens.json` 一起 commit，這樣其他人不用先執行 `npm run tokens` 也能啟動專案。

## 進階情況

**多個 mode（Light / Dark、品牌 A / B）**：每個 mode 匯出成獨立檔案（例如 `tokens/semantic.light.json`、`tokens/semantic.dark.json`），在 Style Dictionary 設定中對每個 mode 各建一個 css platform，`source` 分別包含 Primitive 與該 mode 的 Semantic，並在 `css/variables` 的 `options.selector` 指定 `:root` 或 `[data-theme="dark"]`。Tailwind / SCSS 只需要用其中一個 mode 產生一次，因為它們都指向同名的 CSS 變數。

**非顏色 token**（Figma 的 number 變數，例如間距、圓角）：Figma 匯出的數值通常沒有單位。若 `$type` 是 `dimension` / `number`，在 css platform 的 transforms 加上 `size/pxToRem` 或 `size/px`，並確認輸出是否符合預期；要接 Tailwind 時，在 format 中為它們建立對應的 namespace（v4 例如 `--spacing-*`、`--radius-*`）。只有在 tokens.json 真的有這類 token 時才處理。

**舊格式（`value` / `type`，沒有 `$`）**：Tokens Studio 等工具的舊格式，Style Dictionary v4+ 也能讀，設定不需要改。
