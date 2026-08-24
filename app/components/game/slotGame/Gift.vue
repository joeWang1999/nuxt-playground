<template>
  <div ref="rootEl" :class="['gift-container', displayType, { 'autoTurn': isRunning }]">
    <div
      :class="['gift', config.style]"
      v-for="(gift, index) in config.gifts"
      :key="index"
      :style="`transform: rotateX(${(rotate) * index}deg) translateZ(${translateZ}px)`">
      <template v-if="gift.type === 'text'">{{ gift.name }}</template>
      <template v-if="gift.type === 'image'">
        <img :src="gift.path" :height="config.height">
      </template>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  trigger: {
    type: Date,
    default: false
  },
  config: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['finished'])

const rootEl = ref(null)
const isRunning = ref(false)
const currentDeg = ref(0)
const targetDeg = ref(0)
const giftsDeg = ref([])

const displayType = computed(() => (props.config.run3D ? 'three-dimension' : 'flat'))
const rotate = computed(() => 360 / props.config.gifts.length)
const translateZ = computed(() => (props.config.height / 2) / Math.tan((rotate.value / 2 / 180) * Math.PI))

function logGiftsDeg () {
  // 紀錄獎品角度
  props.config.gifts.forEach((gift, index) => {
    giftsDeg.value[index] = {
      from: index === 0 ? 0 : giftsDeg.value[index - 1].to,
      to: index === 0 ? rotate.value : giftsDeg.value[index - 1].to + rotate.value,
      name: gift.name
    }
  })
}

function setConfig () {
  // 將config的變數們寫入CSS變數中
  rootEl.value.style.setProperty('--rotateY', `${props.config.rotateY}deg`)
  rootEl.value.style.setProperty('--duration', `${props.config.duration}ms`)
  rootEl.value.style.setProperty('--fontSize', `${props.config.fontSize}px`)
  rootEl.value.style.setProperty('--height', `${props.config.height}px`)
  rootEl.value.style.setProperty('--width', `${props.config.width}px`)
  rootEl.value.style.setProperty('--currentDeg', `-${currentDeg.value}deg`)
}

function autoTurn () {
  // 取得隨機角度(預設至少跑5圈)
  let randomDeg = (Math.random() * 360) + (360 * 5)
  randomDeg -= randomDeg % rotate.value // 減去餘數，避免有高低不一的狀況
  targetDeg.value = randomDeg
  // 取得隨機回彈角度
  const randomRollBackDeg = props.config.rollback
    ? Math.random() * props.config.rollback + 1
    : 1
  // 設定轉動角度
  rootEl.value.style.setProperty('--targetDeg', `-${targetDeg.value}deg`)
  rootEl.value.style.setProperty('--rollBackDeg', `${randomRollBackDeg}`)
  // 執行轉動
  isRunning.value = true
}

function autoTurnStop () {
  // 把結束時的角度設定為當前角度
  currentDeg.value = targetDeg.value % 360
  rootEl.value.style.setProperty('--currentDeg', `-${currentDeg.value}deg`)
  // 顯示獎品資料(結束角度 + 單片角度/2)
  let giftName = null
  const endDeg = currentDeg.value + (rotate.value / 2)
  giftsDeg.value.forEach((gift) => {
    if (endDeg >= gift.from && endDeg <= gift.to) {
      giftName = gift.name
    }
  })
  // 宣告轉動結束
  isRunning.value = false
  emit('finished', giftName) // 告訴上層已經轉完
}

watch(() => props.config, () => {
  setConfig()
}, { deep: true })

watch(() => props.trigger, () => {
  autoTurn()
})

watch(isRunning, (value) => {
  if (value) {
    setTimeout(() => {
      autoTurnStop()
    }, props.config.duration + 200)
  }
})

onMounted(() => {
  setConfig()
  logGiftsDeg()
})
</script>

<style>
.gift-container * {
  box-sizing: border-box;
}
.gift-container {
  perspective: 999999px;
  user-select: none;
  position: relative;
  display: flex;
  align-items: center;
  margin-right: var(--width);
  transform-style: preserve-3d;
}
.gift-container .gift {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--width);
  height: var(--height);
  border: 1px solid #333;
  background-color: #fff;
  font-size: var(--fontSize);
}
.gift-container .gift img {
  padding: 1px;
}

.gift-container.flat {
  transform: rotateX(var(--currentDeg));
}
.gift-container.flat.autoTurn {
  transition: var(--duration) ease-in-out;
  transform: rotateX(var(--targetDeg));
}

.gift-container.three-dimension {
  transform: rotateY(var(--rotateY)) rotateX(var(--currentDeg));
}
.gift-container.three-dimension.autoTurn {
  transition: var(--duration) cubic-bezier(0.1, 0, 0, var(--rollBackDeg));
  transform: rotateY(var(--rotateY)) rotateX(var(--targetDeg));
}
</style>
