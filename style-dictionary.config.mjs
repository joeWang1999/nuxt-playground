// Figma Variables (DTCG) → CSS 變數 + Tailwind 對應表
// 用法：npm run tokens

// 去掉 Figma collection / mode 前綴：
// Primitive.Primitive.color.green.600 → color-green-600
// Semantic.color.text.primary        → color-text-primary
const stripPrefix = (path) => {
  if (path[0] === 'Primitive') return path.slice(2)
  if (path[0] === 'Semantic') return path.slice(1)
  return path
}

export default {
  source: ['tokens/tokens.json'],
  hooks: {
    transforms: {
      'name/figma-kebab': {
        type: 'name',
        transform: (token) => stripPrefix(token.path).join('-'),
      },
    },
    formats: {
      // 只輸出 Semantic token，值指向 CSS 變數，例如
      // { text: { primary: 'var(--color-text-primary)' } }
      'tailwind/semantic': ({ dictionary }) => {
        const result = {}
        for (const token of dictionary.allTokens) {
          if (token.path[0] !== 'Semantic') continue
          // Semantic.color.<category>.<...rest>
          const keys = token.path.slice(2)
          let node = result
          keys.slice(0, -1).forEach((key) => (node = node[key] ??= {}))
          node[keys.at(-1)] = `var(--${token.name})`
        }
        return JSON.stringify(result, null, 2) + '\n'
      },
    },
  },
  platforms: {
    css: {
      transforms: ['attribute/cti', 'name/figma-kebab', 'color/css'],
      buildPath: 'app/assets/css/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables',
          options: { outputReferences: true },
        },
      ],
    },
    tailwind: {
      transforms: ['name/figma-kebab'],
      buildPath: 'tokens/',
      files: [{ destination: 'tailwind.tokens.json', format: 'tailwind/semantic' }],
    },
  },
}
