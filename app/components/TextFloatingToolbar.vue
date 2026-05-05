<template>
  <div
    class="fixed left-1/2 md:left-[54%] z-50 flex w-[calc(100vw-24px)] max-w-[420px] flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-xl md:w-auto md:max-w-[90vw] md:flex-row md:flex-no-wrap md:gap-4"
    style="
      top: 128px;
      transform: translateX(-50%);
    "
  >
    <div class="flex w-full items-center justify-center gap-3 md:w-auto">
      <div class="relative">
        <select
          :value="fontFamily"
          @change="onFontFamilyChange"
          class="h-8 appearance-none rounded-2xl border p-1 pl-2 pr-8"
        >
          <option v-for="f in fontFamilies" :key="f" :value="f">{{ f }}</option>
        </select>
        <span
          class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs leading-none text-gray-500"
          aria-hidden="true"
        >
          ▼
        </span>
      </div>
      <div class="flex items-center overflow-hidden rounded-2xl border border-gray-300">
        <button
          type="button"
          class="h-8 w-8 bg-white text-xl text-gray-700 transition-colors"
          @click="adjustFontSize(-1)"
        >
          -
        </button>
        <input
          type="number"
          min="10"
          max="120"
          :value="fontSize"
          @input="onFontSizeInput"
          class="font-size-input w-12 p-1 text-center"
        />
        <button
          type="button"
          class="h-8 w-8 bg-white text-xl text-gray-700 transition-colors"
          @click="adjustFontSize(1)"
        >
          +
        </button>
      </div>
    </div>
    <div class="flex w-full items-center justify-center gap-3 md:w-auto md:gap-4">
      <input
        type="color"
        :value="fontColor"
        @input="onFontColorInput"
        class="w-8 h-8 p-0 border rounded-full"
      />
      <div class="flex gap-1">
        <button
          @click="$emit('toggle-bold')"
          :class="[
            'h-8 w-8 rounded border border-white font-bold text-sm transition-colors',
            fontBold
              ? 'border-gray-700 bg-gray-700 text-white'
              : 'text-gray-700 hover:bg-gray-100',
          ]"
        >
          B
        </button>
        <button
          @click="$emit('toggle-italic')"
          :class="[
            'h-8 w-8 rounded border border-white text-sm italic transition-colors',
            fontItalic
              ? 'border-gray-700 bg-gray-700 text-white'
              : 'text-gray-700 hover:bg-gray-100',
          ]"
        >
          I
        </button>
        <button
          @click="$emit('toggle-underline')"
          :class="[
            'h-8 w-8 rounded border border-white text-sm underline transition-colors',
            fontUnderline
              ? 'border-gray-700 bg-gray-700 text-white'
              : 'text-gray-700 hover:bg-gray-100',
          ]"
        >
          U
        </button>
        <button
          @click="$emit('toggle-linethrough')"
          :class="[
            'h-8 w-8 rounded border border-white text-sm line-through transition-colors',
            fontLinethrough
              ? 'border-gray-700 bg-gray-700 text-white'
              : 'text-gray-700 hover:bg-gray-100',
          ]"
        >
          S
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  fontFamilies: readonly string[]
  fontFamily: string
  fontSize: number
  fontColor: string
  fontBold: boolean
  fontItalic: boolean
  fontUnderline: boolean
  fontLinethrough: boolean
}>()

const emit = defineEmits<{
  (e: 'update:fontFamily', value: string): void
  (e: 'update:fontSize', value: number): void
  (e: 'update:fontColor', value: string): void
  (e: 'style-change'): void
  (e: 'toggle-bold'): void
  (e: 'toggle-italic'): void
  (e: 'toggle-underline'): void
  (e: 'toggle-linethrough'): void
}>()

function onFontFamilyChange(event: Event) {
  const target = event.target as HTMLSelectElement | null
  if (!target) return
  emit('update:fontFamily', target.value)
  emit('style-change')
}

function onFontSizeInput(event: Event) {
  const target = event.target as HTMLInputElement | null
  if (!target) return
  emit('update:fontSize', clampFontSize(Number(target.value)))
  emit('style-change')
}

function adjustFontSize(delta: number) {
  emit('update:fontSize', clampFontSize(props.fontSize + delta))
  emit('style-change')
}

function clampFontSize(value: number): number {
  if (!Number.isFinite(value)) return 10
  return Math.min(120, Math.max(10, Math.round(value)))
}

function onFontColorInput(event: Event) {
  const target = event.target as HTMLInputElement | null
  if (!target) return
  emit('update:fontColor', target.value)
  emit('style-change')
}
</script>

<style scoped>
.font-size-input {
  appearance: textfield;
  -moz-appearance: textfield;
}

.font-size-input::-webkit-outer-spin-button,
.font-size-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type='color'] {
  appearance: none;
  -webkit-appearance: none;
  border-radius: 9999px;
  overflow: hidden;
}

input[type='color']::-webkit-color-swatch-wrapper {
  padding: 0;
}

input[type='color']::-webkit-color-swatch {
  border: none;
  border-radius: 9999px;
}

input[type='color']::-moz-color-swatch {
  border: none;
  border-radius: 9999px;
}
</style>
