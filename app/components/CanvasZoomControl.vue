<template>
  <div class="fixed bottom-24 right-4 z-30 flex items-center space-x-2 rounded-xl bg-white/90 px-3 py-2 shadow-lg select-none md:bottom-4 md:z-50">
    <button
      class="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 text-xl font-bold"
      @click="zoomOut"
      :disabled="scale <= minScale"
      :class="{ 'opacity-50 cursor-not-allowed': scale <= minScale }"
      title="縮小"
    >
      -
    </button>
    <span class="w-16 text-center font-mono">{{ (scale * 100).toFixed(0) }}%</span>
    <button
      class="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 text-xl font-bold"
      @click="zoomIn"
      :disabled="scale >= maxScale"
      :class="{ 'opacity-50 cursor-not-allowed': scale >= maxScale }"
      title="放大"
    >
      +
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Number, required: true },
  min: { type: Number, default: 0.2 },
  max: { type: Number, default: 3 },
  step: { type: Number, default: 0.1 },
})
const emit = defineEmits(['update:modelValue'])

const scale = ref(props.modelValue)
const minScale = props.min
const maxScale = props.max
const step = props.step

watch(() => props.modelValue, (val) => {
  scale.value = val
})

function zoomIn() {
  if (scale.value < maxScale) {
    const newScale = Math.min(maxScale, +(scale.value + step).toFixed(2))
    scale.value = newScale
    emit('update:modelValue', newScale)
  }
}
function zoomOut() {
  if (scale.value > minScale) {
    const newScale = Math.max(minScale, +(scale.value - step).toFixed(2))
    scale.value = newScale
    emit('update:modelValue', newScale)
  }
}
</script>

<style scoped>
/* Optional: add custom styles if needed */
</style>
