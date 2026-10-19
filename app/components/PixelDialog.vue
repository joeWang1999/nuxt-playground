<template>
  <div class="pixel-dialog" @click="onClick">
    <div v-if="title" class="pixel-dialog__title">{{ title }}</div>

    <div class="pixel-dialog__frame">
      <div class="pixel-dialog__body">
        <div class="pixel-dialog__content">
          <!-- 佔位層：保留完整排版尺寸，打字時版面不會跳動，也作為逐字顯示的原始文字來源 -->
          <div v-if="animated" ref="ghostEl" class="pixel-dialog__ghost" aria-hidden="true">
            <slot />
          </div>
          <div ref="typingEl" :class="['pixel-dialog__text', { 'is-pending': animated && !isStarted }]">
            <slot />
          </div>
        </div>

        <span v-if="showArrow && isStarted && !isTyping" class="pixel-dialog__arrow" />
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  // 是否開啟逐字出現動畫
  animated: {
    type: Boolean,
    default: true
  },
  // 每個字的間隔（ms）
  speed: {
    type: Number,
    default: 60
  },
  // 開始打字前的延遲（ms）
  delay: {
    type: Number,
    default: 0
  },
  // 文字顯示完畢後是否顯示右下角閃爍箭頭
  showArrow: {
    type: Boolean,
    default: true
  },
  // 打字中點擊對話框可直接顯示全部文字
  skippable: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['finished'])

const ghostEl = ref(null)
const typingEl = ref(null)
const isStarted = ref(!props.animated)
const isTyping = ref(false)

let timer = null
let observer = null

function getTextNodes (root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  return nodes
}

// 兩層 DOM 結構相同，依序配對 [打字層節點, 原始文字]
function getPairs () {
  if (!ghostEl.value || !typingEl.value) return []
  const sources = getTextNodes(ghostEl.value)
  return getTextNodes(typingEl.value).map((node, i) => [node, sources[i]?.nodeValue ?? node.nodeValue])
}

function clearTimer () {
  clearTimeout(timer)
  timer = null
}

function finish () {
  clearTimer()
  getPairs().forEach(([node, text]) => { node.nodeValue = text })
  isStarted.value = true
  if (isTyping.value) {
    isTyping.value = false
    emit('finished')
  }
}

function start () {
  clearTimer()
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (!props.animated || reduceMotion) {
    isTyping.value = true
    finish()
    return
  }

  // 攤平成逐字佇列，Array.from 可正確切開 emoji 等字元
  const queue = []
  getPairs().forEach(([node, text]) => {
    node.nodeValue = ''
    Array.from(text).forEach(char => queue.push([node, char]))
  })
  isStarted.value = true
  isTyping.value = true

  const tick = () => {
    // 空白字元不佔用時間，一次補到下一個可見字為止
    while (queue.length) {
      const [node, char] = queue.shift()
      node.nodeValue += char
      if (char.trim()) break
    }
    if (queue.length) timer = setTimeout(tick, props.speed)
    else finish()
  }
  timer = setTimeout(tick, props.delay)
}

function onClick () {
  if (props.skippable && isTyping.value) finish()
}

watch(() => props.animated, async (val) => {
  if (val) {
    await nextTick()
    start()
  } else {
    finish()
  }
})

// slot 內容變動時重新打字
watch(ghostEl, (el) => {
  observer?.disconnect()
  if (!el) return
  observer = new MutationObserver(() => start())
  observer.observe(el, { childList: true, subtree: true, characterData: true })
})

onMounted(start)

onBeforeUnmount(() => {
  clearTimer()
  observer?.disconnect()
})

defineExpose({
  replay: start,
  skip: finish
})
</script>

<style scoped>
.pixel-dialog {
  /* 像素格大小，邊框粗細與轉角階梯皆以此為單位 */
  --pd-px: 6px;
  --pd-border-color: #000;
  --pd-bg: #fff;
  --pd-shade: #a9cbf5;
  --pd-title-bg: #000;
  --pd-title-color: #fff;
  --pd-arrow-color: #000;

  position: relative;
  padding-top: 1.25em;
  color: #111;
  font-size: 1.25rem;
  line-height: 1.6;
}

.pixel-dialog__title {
  position: absolute;
  top: 0;
  left: calc(var(--pd-px) * 6);
  z-index: 1;
  padding: 0.3em 0.8em;
  background: var(--pd-title-bg);
  color: var(--pd-title-color);
  font-size: 0.9em;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: 0.05em;
}

.pixel-dialog__frame {
  --p: var(--pd-px);
  --p2: calc(var(--pd-px) * 2);
  padding: var(--p);
  background: var(--pd-border-color);
  clip-path: polygon(
    var(--p2) 0, calc(100% - var(--p2)) 0,
    calc(100% - var(--p2)) var(--p), calc(100% - var(--p)) var(--p),
    calc(100% - var(--p)) var(--p2), 100% var(--p2),
    100% calc(100% - var(--p2)), calc(100% - var(--p)) calc(100% - var(--p2)),
    calc(100% - var(--p)) calc(100% - var(--p)), calc(100% - var(--p2)) calc(100% - var(--p)),
    calc(100% - var(--p2)) 100%, var(--p2) 100%,
    var(--p2) calc(100% - var(--p)), var(--p) calc(100% - var(--p)),
    var(--p) calc(100% - var(--p2)), 0 calc(100% - var(--p2)),
    0 var(--p2), var(--p) var(--p2),
    var(--p) var(--p), var(--p2) var(--p)
  );
}

.pixel-dialog__body {
  --p: var(--pd-px);
  position: relative;
  padding: calc(var(--pd-px) * 4 + 0.5em) calc(var(--pd-px) * 4 + 2.5em) calc(var(--pd-px) * 5) calc(var(--pd-px) * 4 + 0.5em);
  background: linear-gradient(to top, var(--pd-shade) var(--p), var(--pd-bg) var(--p));
  clip-path: polygon(
    var(--p) 0, calc(100% - var(--p)) 0,
    calc(100% - var(--p)) var(--p), 100% var(--p),
    100% calc(100% - var(--p)), calc(100% - var(--p)) calc(100% - var(--p)),
    calc(100% - var(--p)) 100%, var(--p) 100%,
    var(--p) calc(100% - var(--p)), 0 calc(100% - var(--p)),
    0 var(--p), var(--p) var(--p)
  );
}

.pixel-dialog__content {
  display: grid;
}

.pixel-dialog__ghost,
.pixel-dialog__text {
  grid-area: 1 / 1;
}

.pixel-dialog__ghost,
.pixel-dialog__text.is-pending {
  visibility: hidden;
}

.pixel-dialog__arrow {
  position: absolute;
  right: calc(var(--pd-px) * 4 + 0.5em);
  bottom: calc(var(--pd-px) * 5 + 0.6em);
  width: 1.1em;
  height: 0.75em;
  background: var(--pd-arrow-color);
  clip-path: polygon(0 0, 100% 0, 50% 100%);
  animation: pixel-dialog-blink 1s steps(1) infinite;
}

@keyframes pixel-dialog-blink {
  50% { opacity: 0; }
}
</style>
