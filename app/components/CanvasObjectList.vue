<template>
  <div class="flex flex-col w-44 shrink-0 border-r border-gray-200 bg-gray-50">
    <p class="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
      物件列表
    </p>
    <div class="flex-1 overflow-y-auto">
      <div
        v-if="!objects.length"
        class="px-3 py-4 text-xs text-gray-400 text-center"
      >
        尚無物件
      </div>
      <div
        v-for="(obj, index) in objects"
        :key="index"
        draggable="true"
        @click="$emit('focus', obj)"
        @dragstart="onDragStart(index)"
        @dragenter.prevent="onDragEnter(index)"
        @dragover.prevent
        @drop.prevent="onDrop(index)"
        @dragend="onDragEnd"
        :class="[
          'flex items-center gap-1 px-3 py-2 cursor-pointer select-none border-b border-gray-100 text-sm transition-colors',
          activeIndex === index
            ? 'bg-blue-100 text-blue-800 font-medium'
            : 'hover:bg-gray-100 text-gray-700',
          dragOverIndex === index && draggedIndex !== index
            ? 'ring-2 ring-inset ring-blue-300 bg-blue-50'
            : '',
          draggedIndex === index ? 'opacity-60' : '',
        ]"
      >
        <span class="flex-1 truncate">{{ getLabel(obj) }}</span>
        <button
          v-if="obj.selectable !== false"
          @click.stop="$emit('remove', obj)"
          class="shrink-0 w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors text-xs leading-none"
          title="移除"
        >✕</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  objects: { type: Array, required: true },
  activeIndex: { type: Number, default: -1 },
})

const emit = defineEmits(['focus', 'remove', 'reorder'])

const draggedIndex = ref(-1)
const dragOverIndex = ref(-1)

function resetDragState() {
  draggedIndex.value = -1
  dragOverIndex.value = -1
}

function onDragStart(index) {
  draggedIndex.value = index
  dragOverIndex.value = index
}

function onDragEnter(index) {
  if (draggedIndex.value === -1) return
  dragOverIndex.value = index
}

function onDrop(index) {
  if (draggedIndex.value === -1 || draggedIndex.value === index) {
    resetDragState()
    return
  }

  emit('reorder', draggedIndex.value, index)
  resetDragState()
}

function onDragEnd() {
  resetDragState()
}

function getLabel(obj) {
  if (obj.type === 'textbox') {
    const text = (obj.text || '').trim()
    return text.length > 14 ? text.slice(0, 14) + '…' : (text || '文字框')
  }
  if (obj.type === 'image') {
    if (!obj.selectable) return '底圖'
    if (obj.objectRole === 'photo') return '照片'
    return '圖片'
  }
  return obj.type || '物件'
}
</script>

