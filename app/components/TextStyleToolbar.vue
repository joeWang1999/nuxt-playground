<template>
  <div class="flex flex-wrap items-center gap-4 p-3 bg-gray-100 rounded">
    <div>
      <label class="text-sm text-gray-600">字型</label>
      <select
        :value="fontFamily"
        @change="e => { $emit('update:fontFamily', e.target.value); $emit('style-change') }"
        class="border rounded p-1"
      >
        <option v-for="f in fontFamilies" :key="f" :value="f">{{ f }}</option>
      </select>
    </div>
    <div>
      <label class="text-sm text-gray-600">字體大小</label>
      <input
        type="number"
        min="10"
        max="120"
        :value="fontSize"
        @input="e => { $emit('update:fontSize', Number(e.target.value)); $emit('style-change') }"
        class="border rounded p-1 w-20"
      />
    </div>
    <div>
      <label class="text-sm text-gray-600">顏色</label>
      <input
        type="color"
        :value="fontColor"
        @input="e => { $emit('update:fontColor', e.target.value); $emit('style-change') }"
        class="w-10 h-8 p-0 border rounded"
      />
    </div>
    <div class="flex gap-1">
      <button
        @click="$emit('toggle-bold')"
        :class="['w-8 h-8 rounded border font-bold text-sm transition-colors', fontBold ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100']"
      >B</button>
      <button
        @click="$emit('toggle-italic')"
        :class="['w-8 h-8 rounded border italic text-sm transition-colors', fontItalic ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100']"
      >I</button>
      <button
        @click="$emit('toggle-underline')"
        :class="['w-8 h-8 rounded border underline text-sm transition-colors', fontUnderline ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100']"
      >U</button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  fontFamily: { type: String, required: true },
  fontSize: { type: Number, required: true },
  fontColor: { type: String, required: true },
  fontBold: { type: Boolean, required: true },
  fontItalic: { type: Boolean, required: true },
  fontUnderline: { type: Boolean, required: true },
  fontFamilies: { type: Array, required: true },
})

defineEmits([
  'update:fontFamily',
  'update:fontSize',
  'update:fontColor',
  'toggle-bold',
  'toggle-italic',
  'toggle-underline',
  'style-change',
])
</script>
