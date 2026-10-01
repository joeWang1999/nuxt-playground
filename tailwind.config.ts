import type { Config } from 'tailwindcss'
// 由 `npm run tokens` 從 tokens/tokens.json 產生，勿手動修改
import tokens from './tokens/tailwind.tokens.json'

// 設計可能增減分類，缺少的分類視為空物件
const { background = {}, surface = {}, tag = {}, text = {}, icon = {}, border = {} } =
  tokens as Record<string, Record<string, unknown>>

export default {
  theme: {
    extend: {
      // text-primary / text-brand / text-icon-primary / text-tag-secondary-strong
      textColor: { ...text, icon, tag },
      // bg-background-default / bg-surface-subtle / bg-tag-primary-subtle
      backgroundColor: { background, surface, tag },
      // border-default / border-subtle / border-brand
      borderColor: border,
      // fill-icon-primary / stroke-icon-brand（SVG 用）
      fill: { icon },
      stroke: { icon },
    },
  },
} satisfies Partial<Config>
