<template>
  <div class="slotMachineWrapper">
    <div class="DemoSlotMachine" ref="rootEl">
      <img class="slot_cover_image" src="/images/slot-cover.svg" alt="" />
      <div class="slot_container">
        <Gift
          v-for="(config, index) in configs"
          @finished="isFinished"
          :trigger="trigger"
          :config="config"
          :key="index"
        >
        </Gift>
      </div>
    </div>
    <button
      class="handle"
      :class="{ pulling: isPulling }"
      @click="turn"
      :disabled="disabled"
    ></button>
  </div>
</template>

<script setup>
import Gift from './Gift.vue'

const props = defineProps({
  /** 單格音效檔；快轉時循環播放，尾段改成逐格觸發 */
  clickSound: {
    type: String,
    default: '/audio/slot_single2.mp3'
  },
  /** 音效音量 0 ~ 1 */
  clickVolume: {
    type: Number,
    default: 0.5
  },
  /** 滾輪定位時的音效檔 */
  lockSound: {
    type: String,
    default: '/audio/slot_single2.mp3'
  },
  /**
   * 音效模式：
   * - 'mono'：全程逐格觸發，單聲道接手（voice stealing）。
   *   節奏完全跟著實際轉速，快時緊密、慢時每聲完整響完，永不疊加。
   * - 'loop'：快轉時循環音，剩 finalSteps 格才改成逐格觸發。
   */
  soundMode: {
    type: String,
    default: 'mono',
    validator: value => ['mono', 'loop'].includes(value)
  },
  /**
   * mono 模式下撞聲時的處理：
   * - 'drop'：略過新觸發，每一聲都完整播完
   * - 'steal'：接手，前一聲被截短，節奏緊貼轉速
   */
  monoPolicy: {
    type: String,
    default: 'drop',
    validator: value => ['steal', 'drop'].includes(value)
  },
  /** soundMode 為 'loop' 時，距離終點剩下幾格才切換成逐格觸發 */
  finalSteps: {
    type: Number,
    default: 2
  }
})

const rootEl = ref(null)
const trigger = ref(null)
const disabled = ref(false)
const isPulling = ref(false)

const gifts = [
  { type: 'image', path: '/images/gift-0.svg', name: 'gift-0', value: '0' },
  { type: 'image', path: '/images/gift-1.svg', name: 'gift-1', value: '1' },
  { type: 'image', path: '/images/gift-2.svg', name: 'gift-2', value: '2' },
  { type: 'image', path: '/images/gift-3.svg', name: 'gift-3', value: '3' },
  { type: 'image', path: '/images/gift-4.svg', name: 'gift-4', value: '4' },
]
const configs = ref([
  { duration: 4000, rollback: 0.3, fontSize: 100, height: 120, width: 75, gifts },
  { duration: 5000, rollback: 0.3, fontSize: 100, height: 120, width: 75, gifts },
  { duration: 6000, rollback: 0.3, fontSize: 100, height: 120, width: 75, gifts },
])

let result = []
const resultHistory = ref([])

// ================================================================
// 轉動音效：快轉時循環，尾段改成逐格
// ================================================================

const isMono = props.soundMode === 'mono'

// mono：單聲道接手，密集觸發時每聲被下一聲截短，間隔拉長後才完整響完，
// 所以疏密完全跟著轉速走，且同時只有一個音源
const click = useSfx(props.clickSound, {
  volume: props.clickVolume,
  mono: isMono,
  monoPolicy: props.monoPolicy
})

// 定位聲：每個滾輪停穩時各響一次
const lock = useSfx(props.lockSound, { volume: props.clickVolume })

/** 已進入尾段的滾輪數，全部進入後才收掉循環音 */
let reelsInFinal = 0

const reelTicks = useReelTicks(
  () => rootEl.value?.querySelectorAll('.gift-container'),
  ({ delay }) => click.play(delay),
  {
    stepDeg: 360 / gifts.length,
    // mono 模式全程逐格觸發，所以不設尾段門檻
    finalSteps: isMono ? 0 : props.finalSteps,
    onEnterFinal: () => {
      reelsInFinal++
      // 最後一輪也進入尾段，代表沒有滾輪還在快轉，循環音可以收了
      if (reelsInFinal >= configs.value.length) click.stopLoop()
    },
    // transitionend 才是真正定位的瞬間；Gift 的 finished 事件慢了 200ms。
    // priority = true：即使疊音額滿也保證這一聲播出來
    onSettle: () => lock.play(0, true)
  }
)

// 先把音檔位元組抓下來，第一次轉動才不會漏掉前幾聲
onMounted(() => {
  click.preload()
  lock.preload()
})

function turn() {
  disabled.value = true
  trigger.value = new Date()
  isPulling.value = true
  setTimeout(() => {
    isPulling.value = false
  }, 1000)

  reelsInFinal = 0

  // unlock() 必須在這個 click handler 內同步呼叫，前面不能有 await，
  // 否則 AudioContext 會停在 suspended 狀態而沒有聲音
  click.unlock()
  lock.unlock()
  // loop 模式才需要底噪；mono 模式全程靠逐格觸發
  // 重複呼叫不會疊加；buffer 還沒解碼完也會在解碼後自動補開
  if (!isMono) click.startLoop()
  reelTicks.start()
}

function isFinished(val) {
  const autoTurnList = rootEl.value.querySelectorAll('.autoTurn')
  result.push(val)
  if (autoTurnList.length === 1) {
    disabled.value = false
    resultHistory.value.push(result)
    result = []
    // 最後一個滾輪停了才收工；循環音正常情況下已經停了，這裡是保險
    reelTicks.stop()
    click.stopLoop()
  }
}

onUnmounted(() => {
  click.stopLoop()
})
</script>

<style scoped>
.slotMachineWrapper {
  position: relative;
  width: 316px;
  height: 434px;
}
.DemoSlotMachine {
  gap: 16px;
  background-image: url(/images/slot-bg.svg);
  background-repeat: no-repeat;
  background-size: contain;
  width: 316px;
  height: 434px;
  position: relative;
}
.slot_cover_image {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 20;
}
.slot_container {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 8px;
  top: 39%;
  position: absolute;
  height: 120px;
  left: 11.5%;
  overflow: hidden;
}
.handle {
  background-image: url(/images/slot-handle.svg);
  background-repeat: no-repeat;
  background-size: contain;
  height: 70px;
  width: 28px;
  transform-origin: bottom center;
  position: absolute;
  bottom: 7.9%;
  right: 20%;
  z-index: 20;
}
.handle.pulling {
  animation: handlePull 1000ms ease-in-out;
}
@keyframes handlePull {
  0% {
    transform: rotateX(0deg);
  }
  60% {
    transform: rotateX(180deg);
  }
  100% {
    transform: rotateX(0deg);
  }
}
</style>
