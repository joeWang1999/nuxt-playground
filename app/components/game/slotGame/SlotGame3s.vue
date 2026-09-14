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

    <!-- 結果彈窗 -->
    <div v-if="showResult" class="result_mask" @click.self="closeResult">
      <div class="result_dialog" role="dialog" aria-modal="true">
        <p class="result_title">{{ isWin ? '恭喜中獎！' : '銘謝惠顧' }}</p>

        <div class="result_gifts">
          <img
            v-for="(gift, index) in resultGifts"
            :key="index"
            :src="gift.path"
            :alt="gift.name"
          />
        </div>

        <button class="result_button" @click="closeResult">再玩一次</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import Gift from './Gift.vue'

const props = defineProps({
  /** 轉動時播放的音效檔，正常播放不做任何處理 */
  spinSound: {
    type: String,
    default: '/audio/slot_machine_3s.mp3'
  },
  /** 音效音量 0 ~ 1 */
  spinVolume: {
    type: Number,
    default: 0.6
  },
  /**
   * 各滾輪的轉動毫秒數，陣列長度就是滾輪數量。
   * 注意每輪實際回報結果的時間是「時長 + REEL_REPORT_DELAY」。
   */
  reelDurations: {
    type: Array,
    default: () => [1800, 2200, 2600],
    validator: (value) => Array.isArray(value)
      && value.length > 0
      && value.every(ms => typeof ms === 'number' && ms > 0)
  },
  /**
   * 從開始轉動到彈出結果的毫秒數。
   * 彈窗會等「這個時間」與「所有滾輪回報完畢」兩者都到齊才開，
   * 所以設得比滾輪結束還早不會提前彈出，只會以滾輪為準。
   */
  resultDelay: {
    type: Number,
    default: 2950
  }
})

const emit = defineEmits(['result'])

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

/** Gift 在 transition 結束後還會等這麼久才回報結果（見 Gift.vue 的 autoTurnStop） */
const REEL_REPORT_DELAY = 200

const configs = computed(() =>
  props.reelDurations.map(duration => ({
    duration,
    rollback: 0.3,
    fontSize: 100,
    height: 120,
    width: 75,
    gifts,
  }))
)

/** 最後一個滾輪回報結果的時間點，彈窗不可能早於此 */
const lastReelReportAt = computed(() =>
  Math.max(...props.reelDurations) + REEL_REPORT_DELAY
)

let result = []
const resultHistory = ref([])

// ================================================================
// 轉動音效：單純播放，不做任何速率或逐格處理
// ================================================================

const spinAudio = useMusic(() => props.spinSound, {
  volume: props.spinVolume,
  unlockOnInteraction: false
})

// ================================================================
// 結果彈窗
// ================================================================

const showResult = ref(false)
/** 這一輪的結果（獎品名稱陣列），彈窗顯示用 */
const finalResult = ref([])

/** 名稱 → 獎品資料，彈窗要用圖片 */
const giftByName = new Map(gifts.map(gift => [gift.name, gift]))

const resultGifts = computed(() =>
  finalResult.value.map(name => giftByName.get(name)).filter(Boolean)
)

/** 三輪相同才算中獎 */
const isWin = computed(() =>
  finalResult.value.length === configs.value.length
  && finalResult.value.every(name => name === finalResult.value[0])
)

let resultTimer = null
/** 計時是否已到（與「所有滾輪回報完畢」兩個條件都成立才開彈窗） */
let timerDone = false
/** 這一輪的結果是否已收齊 */
let resultReady = false

function openResultIfReady() {
  // 兩個條件都到齊才開，避免顯示到還沒收完的結果
  if (!timerDone || !resultReady) return

  showResult.value = true
  emit('result', { gifts: [...finalResult.value], isWin: isWin.value })
}

function closeResult() {
  showResult.value = false
}

function turn() {
  disabled.value = true
  trigger.value = new Date()
  isPulling.value = true
  setTimeout(() => {
    isPulling.value = false
  }, 1000)

  // 重置這一輪的狀態
  showResult.value = false
  timerDone = false
  resultReady = false
  result = []

  // 從頭播放；stop 後再 play 才不會接續上一次的播放位置。
  // play() 必須在這個 click handler 內同步呼叫，前面不能有 await，
  // 否則 Safari / iOS 會因為失去手勢上下文而擋掉播放。
  spinAudio.stop()
  spinAudio.play()

  if (resultTimer !== null) clearTimeout(resultTimer)
  resultTimer = setTimeout(() => {
    resultTimer = null
    timerDone = true
    openResultIfReady()
  }, props.resultDelay)
}

function isFinished(val) {
  const autoTurnList = rootEl.value.querySelectorAll('.autoTurn')
  result.push(val)
  if (autoTurnList.length === 1) {
    disabled.value = false
    resultHistory.value.push(result)
    finalResult.value = [...result]
    resultReady = true
    openResultIfReady()
  }
}

// 設定不一致時在開發階段提醒：resultDelay 比滾輪還早，彈窗會被滾輪拖到更晚
if (import.meta.dev) {
  watchEffect(() => {
    if (props.resultDelay < lastReelReportAt.value) {
      console.warn(
        `[SlotGame3s] resultDelay (${props.resultDelay}ms) 早於最後一輪回報時間 `
        + `(${lastReelReportAt.value}ms)，彈窗會等到 ${lastReelReportAt.value}ms 才出現。`
        + ' 要讓彈窗準時，請把 reelDurations 調短。'
      )
    }
  })
}

onUnmounted(() => {
  if (resultTimer !== null) clearTimeout(resultTimer)
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

/* 結果彈窗 */
.result_mask {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgb(0 0 0 / 55%);
}
.result_dialog {
  width: 100%;
  max-width: 320px;
  padding: 24px 20px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 12px 32px rgb(0 0 0 / 25%);
  text-align: center;
}
.result_title {
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 700;
}
.result_gifts {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 20px;
}
.result_gifts img {
  width: 64px;
  height: auto;
}
.result_button {
  width: 100%;
  padding: 10px 0;
  border-radius: 9999px;
  background: #1f2937;
  color: #fff;
  font-size: 15px;
}
.result_button:hover {
  background: #374151;
}
</style>
