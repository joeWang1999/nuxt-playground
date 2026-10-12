// 在 Style Dictionary 建置前檢核 tokens.json，避免 `npm run tokens` 中途出錯或默默產出錯誤的變數。
// 用法：node scripts/validate-tokens.mjs [--config style-dictionary.config.mjs] [--report tokens/tokens-validation-report.md]
//
// 錯誤（會讓建置失敗）→ 產出報告、exit 1，`npm run tokens` 中斷
// 警告（建置會過，但產出可能有問題）→ 產出報告、exit 0，繼續建置
// 沒有任何問題 → 刪除舊報告、exit 0

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const CONFIG = arg('--config', 'style-dictionary.config.mjs')
const REPORT = arg('--report', 'tokens/tokens-validation-report.md')

const errors = []
const warnings = []
// { file, path: ['a','b'], line, message }
const add = (list, file, tokenPath, message, line) => list.push({ file, path: tokenPath, line, message })

// ─── 讀取設定 ─────────────────────────────────────────────────

let config = {}
if (fs.existsSync(CONFIG)) {
  config = (await import(pathToFileURL(path.resolve(CONFIG)).href)).default ?? {}
} else {
  add(errors, CONFIG, [], `找不到 Style Dictionary 設定檔 ${CONFIG}`)
}
const nameTransform = config.hooks?.transforms?.['name/figma-kebab']?.transform ?? ((t) => t.path.join('-'))

const sources = (config.source ?? ['tokens/tokens.json']).flatMap((pattern) =>
  /[*?{[]/.test(pattern) && fs.globSync ? fs.globSync(pattern) : [pattern],
)
if (!sources.length) add(errors, CONFIG, [], '設定中的 source 沒有對應到任何檔案')

// ─── 解析 JSON，並記下每個 key 所在的行號 ─────────────────────

const lineAt = (text, index) => text.slice(0, index).split('\n').length

// JSON.parse 成功後才呼叫，所以不需要處理語法錯誤
const keyLines = (text) => {
  const lines = new Map()
  let i = 0
  const ws = () => { while (/\s/.test(text[i])) i++ }
  const str = () => {
    const start = i++
    while (text[i] !== '"') i += text[i] === '\\' ? 2 : 1
    i++
    return JSON.parse(text.slice(start, i))
  }
  const value = (p) => {
    ws()
    if (text[i] === '{') {
      i++; ws()
      while (text[i] !== '}') {
        ws()
        const at = i
        const key = str()
        lines.set([...p, key].join('\u0000'), lineAt(text, at))
        ws(); i++ // :
        value([...p, key]); ws()
        if (text[i] === ',') i++
        ws()
      }
      i++
    } else if (text[i] === '[') {
      i++; ws()
      let n = 0
      while (text[i] !== ']') { value([...p, String(n++)]); ws(); if (text[i] === ',') i++; ws() }
      i++
    } else if (text[i] === '"') str()
    else while (i < text.length && !/[\s,}\]]/.test(text[i])) i++
  }
  value([])
  return lines
}

const files = [] // { file, data, lines }
for (const file of sources) {
  if (!fs.existsSync(file)) {
    add(errors, file, [], '檔案不存在，請確認 Figma 匯出的 JSON 已放到這個位置')
    continue
  }
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '')
  try {
    const data = JSON.parse(text)
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      add(errors, file, [], '最外層必須是 JSON 物件 { ... }')
      continue
    }
    files.push({ file, data, lines: keyLines(text) })
  } catch (e) {
    // V8 的訊息會帶 "position N" 或 "(line L column C)"
    const pos = /position (\d+)/.exec(e.message)
    const lc = /line (\d+) column (\d+)/.exec(e.message)
    const where = lc ? `第 ${lc[1]} 行第 ${lc[2]} 欄` : pos ? `第 ${lineAt(text, +pos[1])} 行` : ''
    add(errors, file, [], `JSON 語法錯誤${where ? `（${where}）` : ''}：${e.message}。常見原因：多餘或缺少逗號、引號沒有成對、檔案沒有完整複製。`, lc ? +lc[1] : pos ? lineAt(text, +pos[1]) : undefined)
  }
}

// ─── 收集 token ───────────────────────────────────────────────

// 與 Style Dictionary 相同：檔案內有任何 $value 就視為 DTCG 格式，否則用舊格式的 value
const usesDtcg = files.some(({ data }) => JSON.stringify(data).includes('"$value"'))
const VALUE = usesDtcg ? '$value' : 'value'
const TYPE = usesDtcg ? '$type' : 'type'
const isToken = (node) => node !== null && typeof node === 'object' && !Array.isArray(node) && VALUE in node

const tokens = new Map() // 'a.b.c' → { file, path, value, type, line }
const groups = new Set()

const walk = (node, p, inheritedType, file, lines) => {
  const lineOf = (pp) => lines.get(pp.join('\u0000'))
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) continue // $type、$description、$extensions 等中繼資料
    const cp = [...p, key]
    if (/[{}]/.test(key)) {
      add(errors, file, cp, `名稱「${key}」含有 { 或 }，Style Dictionary 會把它當成參照而建置失敗。請在 Figma 修改變數名稱。`, lineOf(cp))
    } else if (key.includes('.')) {
      add(warnings, file, cp, `名稱「${key}」含有「.」，會和路徑分隔符號混淆，其他 token 無法正確參照它。`, lineOf(cp))
    }
    if (child === null || typeof child !== 'object' || Array.isArray(child)) {
      add(warnings, file, cp, `這裡是 ${JSON.stringify(child)}，不是 token（需要 { "${VALUE}": ... }），建置時會被忽略。`, lineOf(cp))
      continue
    }
    const type = child[TYPE] ?? inheritedType
    if (isToken(child)) {
      const id = cp.join('.')
      if (tokens.has(id)) {
        add(warnings, file, cp, `與 ${tokens.get(id).file} 中的同一路徑重複，後讀入的值會覆蓋前者。`, lineOf(cp))
      }
      tokens.set(id, { file, path: cp, value: child[VALUE], type, line: lineOf(cp) })
      const nested = Object.keys(child).filter((k) => !k.startsWith('$') && k !== VALUE && isToken(child[k]))
      if (nested.length) {
        add(warnings, file, cp, `token 底下又有子 token（${nested.join(', ')}），子 token 不會被輸出。`, lineOf(cp))
      }
    } else {
      groups.add(cp.join('.'))
      walk(child, cp, type, file, lines)
    }
  }
}
for (const { file, data, lines } of files) walk(data, [], undefined, file, lines)

if (files.length && !tokens.size) {
  add(warnings, files[0].file, [], `沒有找到任何 token（含 "${VALUE}" 的物件），產出的 CSS 會是空的。請確認匯出時有選取 collection。`)
}

// ─── 檢查值與參照 ─────────────────────────────────────────────

const REF = /\{([^{}]+)\}/g
const refsIn = (value) => {
  if (typeof value === 'string') return [...value.matchAll(REF)].map((m) => m[1])
  if (value && typeof value === 'object') return Object.values(value).flatMap(refsIn)
  return []
}

const COLOR = /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(.+\))$/i
const NAMED_COLORS = new Set(
  ('transparent currentcolor aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood ' +
    'cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey ' +
    'darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey ' +
    'darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite ' +
    'gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon ' +
    'lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue ' +
    'lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid ' +
    'mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin ' +
    'navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff ' +
    'peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver ' +
    'skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen').split(' '),
)
const isColor = (v) => COLOR.test(v.trim()) || NAMED_COLORS.has(v.trim().toLowerCase())

for (const [id, t] of tokens) {
  if (t.value === null || t.value === undefined || t.value === '') {
    add(warnings, t.file, t.path, `${VALUE} 是空的，會輸出空的 CSS 變數。`, t.line)
    continue
  }
  for (const ref of refsIn(t.value)) {
    if (tokens.has(ref)) continue
    const hint = groups.has(ref)
      ? '這是一個群組，不是 token，參照需要指到最末端的 token。'
      : nearest(ref)
    add(errors, t.file, t.path, `參照 {${ref}} 找不到對應的 token。${hint}`, t.line)
  }
  if (t.type === 'color' && !refsIn(t.value).length) {
    const v = t.value
    const ok = typeof v === 'string' ? isColor(v) : v && typeof v === 'object' && Array.isArray(v.components)
    if (!ok) add(warnings, t.file, t.path, `$type 是 color，但值 ${JSON.stringify(v)} 不是有效的顏色，會被原樣輸出到 CSS。`, t.line)
  }
}

// 參照指到不存在的 token 時，指出從哪一層開始對不上，並列出該層實際有的名稱
function nearest(ref) {
  const parts = ref.split('.')
  const all = [...tokens.keys(), ...groups]
  for (let n = parts.length - 1; n >= 0; n--) {
    const prefix = parts.slice(0, n).join('.')
    if (n && !tokens.has(prefix) && !groups.has(prefix)) continue
    const children = [...new Set(all.filter((k) => !n || k.startsWith(prefix + '.')).map((k) => k.split('.')[n]))]
    const shown = children.slice(0, 8).map((c) => `「${c}」`).join('、')
    const where = n ? `「${prefix}」底下` : '最上層'
    return `${where}沒有「${parts[n]}」${shown ? `，現有的是：${shown}${children.length > 8 ? ' …' : ''}` : ''}。${n ? '' : '常見原因是匯出時漏選了該 collection，或 collection / mode 改名。'}`
  }
  return ''
}

// 循環參照（a → b → a）
const state = new Map() // 1 = 走訪中、2 = 完成
const visit = (id, stack) => {
  if (state.get(id) === 2) return
  if (state.get(id) === 1) {
    const cycle = [...stack.slice(stack.indexOf(id)), id]
    const t = tokens.get(id)
    add(errors, t.file, t.path, `循環參照：${cycle.map((c) => `{${c}}`).join(' → ')}`, t.line)
    return
  }
  state.set(id, 1)
  for (const ref of refsIn(tokens.get(id).value)) if (tokens.has(ref)) visit(ref, [...stack, id])
  state.set(id, 2)
}
for (const id of tokens.keys()) visit(id, [])

// 去掉 collection / mode 前綴後同名（例如 Semantic.color.x 與 color.x 都變成 --color-x）
const names = new Map()
for (const [id, t] of tokens) {
  const name = nameTransform({ path: t.path, name: t.path.join('-') })
  if (names.has(name)) {
    add(warnings, t.file, t.path, `轉成 CSS 變數後與 \`${names.get(name)}\` 同名（--${name}），變數會被重複定義，只有後者生效。請檢查設定中的 PREFIXES。`, t.line)
  } else names.set(name, id)
}

// ─── 輸出 ─────────────────────────────────────────────────────

const fmt = ({ file, path: p, line, message }) =>
  `| ${file}${line ? `:${line}` : ''} | ${p.length ? `\`${p.join('.')}\`` : '—'} | ${message.replace(/\|/g, '\\|')} |`

const table = (list) => ['| 位置 | Token 路徑 | 問題 |', '| --- | --- | --- |', ...list.map(fmt)].join('\n')

if (!errors.length && !warnings.length) {
  if (fs.existsSync(REPORT)) fs.rmSync(REPORT)
  console.log(`✔ tokens 檢核通過（${tokens.size} 個 token，來源：${sources.join(', ')}）`)
  process.exit(0)
}

const report = [
  '# Design Token 檢核報告',
  '',
  `- 產生時間：${new Date().toLocaleString('zh-TW', { hour12: false })}`,
  `- 來源檔：${sources.join(', ')}`,
  `- Token 數：${tokens.size}`,
  `- 結果：${errors.length ? `❌ ${errors.length} 個錯誤，已中斷 \`npm run tokens\`` : '⚠ 只有警告，已繼續建置'}${warnings.length ? `；${warnings.length} 個警告` : ''}`,
  '',
  ...(errors.length
    ? ['## 錯誤（必須修正，否則建置會失敗）', '', table(errors), '']
    : []),
  ...(warnings.length
    ? ['## 警告（建置會成功，但產出可能不正確）', '', table(warnings), '']
    : []),
  '修正方式：在 Figma 修改變數後重新匯出覆蓋 tokens.json，或調整 style-dictionary.config.mjs，再執行一次 `npm run tokens`。',
  '',
].join('\n')

fs.mkdirSync(path.dirname(REPORT), { recursive: true })
fs.writeFileSync(REPORT, report)

const print = (label, list) => list.forEach((i) => console.log(`${label} ${i.file}${i.line ? `:${i.line}` : ''} ${i.path.join('.')}\n    ${i.message}`))
print('✖', errors)
print('⚠', warnings)
console.log(`\n${errors.length ? `✖ ${errors.length} 個錯誤，已中斷建置` : '⚠ 只有警告，繼續建置'}。完整報告：${REPORT}`)
process.exit(errors.length ? 1 : 0)
