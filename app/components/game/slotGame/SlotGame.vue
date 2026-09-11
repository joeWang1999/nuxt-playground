<template>
  <div class="slotMachineWrapper" >
    <div
      class="DemoSlotMachine"
      ref="rootEl"
      @click.self="openResultHistory = false"
    >
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
      <!--  -->
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
  /** 轉動時的音效檔 */
  spinSound: {
    type: String,
    default: '/audio/slot-machine-spin.mp3'
  },
  /** 音效音量 0 ~ 1 */
  spinVolume: {
    type: Number,
    default: 0.6
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
  {
    duration: 4000,
    rollback: 0.3,
    fontSize: 100,
    height: 120,
    width: 75,
    gifts: gifts,
  },
  {
    duration: 5000,
    rollback: 0.3,
    fontSize: 100,
    height: 120,
    width: 75,
    gifts: gifts,
  },
  {
    duration: 6000,
    rollback: 0.3,
    fontSize: 100,
    height: 120,
    width: 75,
    gifts: gifts,
  },
])
const openResultHistory = ref(false)
let result = []
const resultHistory = ref([])

// ================================================================
// 轉動音效：播放速度跟著滾輪角速度變化
// ================================================================

/** 音效播放速率的對應區間（滾輪停下前不會低於 MIN_RATE） */
const MIN_RATE = 0.6
const MAX_RATE = 2

// preservesPitch: true → 只變快慢、音高不動
// 想要減速時音調一起往下掉（拉霸機的經典聽感），把它改成 false
const spinMusic = useMusic(() => props.spinSound, {
  loop: true,
  volume: props.spinVolume,
  preservesPitch: true,
  unlockOnInteraction: false
})

// 量測所有滾輪實際算繪出來的 rotateX 角速度
const reelSpeed = useReelSpeed(
  () => rootEl.value?.querySelectorAll('.gift-container')
)

// 角速度 0~1 → 播放速率
watch(reelSpeed.normalized, (n) => {
  spinMusic.setPlaybackRate(MIN_RATE + (MAX_RATE - MIN_RATE) * n)
})

function turn() {
  disabled.value = true
  trigger.value = new Date()
  isPulling.value = true
  setTimeout(() => {
    isPulling.value = false
  }, 1000)

  // 起步先給滿速，避免第一幀還沒量到速度時聽起來是慢的。
  // play() 必須在這個 click handler 內同步呼叫，前面不能有 await，
  // 否則 Safari / iOS 會因為失去手勢上下文而擋掉播放。
  spinMusic.setPlaybackRate(MAX_RATE)
  spinMusic.play()
  reelSpeed.start()
}

function isFinished(val) {
  const autoTurnList = rootEl.value.querySelectorAll('.autoTurn')
  result.push(val)
  if (autoTurnList.length === 1) {
    disabled.value = false
    resultHistory.value.push(result)
    result = []
    // 最後一個滾輪停了才收音效
    reelSpeed.stop()
    spinMusic.stop()
  }
}
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
