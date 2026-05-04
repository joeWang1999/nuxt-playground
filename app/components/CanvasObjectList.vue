<template>
  <div class="flex flex-col w-44 shrink-0 border-r border-gray-200 bg-gray-50">
    <p class="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
      {{ title }}
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
        :draggable="draggableItems"
        @click="$emit('focus', obj)"
        @dragstart="draggableItems ? onDragStart(index) : null"
        @dragenter.prevent="draggableItems ? onDragEnter(index) : null"
        @dragover.prevent="draggableItems"
        @drop.prevent="draggableItems ? onDrop(index) : null"
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
        <input
          v-if="editableTextLabel && obj.type === 'textbox' && editingIndex === index"
          ref="editInputEl"
          v-model="editingText"
          class="flex-1 min-w-0 rounded border border-blue-300 bg-white px-1.5 py-0.5 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
          @mousedown.stop
          @click.stop
          @input="onInlineInput(obj)"
          @keydown.enter.prevent="commitInlineEdit(obj)"
          @keydown.esc.prevent="cancelInlineEdit"
          @blur="commitInlineEdit(obj)"
        />
        <button
          v-else-if="editableTextLabel && obj.type === 'textbox'"
          class="flex-1 truncate text-left hover:underline"
          @click.stop="startInlineEdit(obj, index)"
          title="點擊編輯文字"
        >
          {{ getLabel(obj) }}
        </button>
        <span v-else class="flex-1 truncate">{{ getLabel(obj) }}</span>
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
import { nextTick, ref } from 'vue'

const props = defineProps({
  objects: { type: Array, required: true },
  activeIndex: { type: Number, default: -1 },
  title: { type: String, default: '物件列表' },
  draggableItems: { type: Boolean, default: true },
  editableTextLabel: { type: Boolean, default: false },
})

const emit = defineEmits(['focus', 'remove', 'reorder', 'update-text', 'commit-text'])

const draggedIndex = ref(-1)
const dragOverIndex = ref(-1)
const editingIndex = ref(-1)
const editingText = ref('')
const editInputEl = ref(null)

function resetDragState() {
  draggedIndex.value = -1
  dragOverIndex.value = -1
}

function onDragStart(index) {
  if (!props.draggableItems) return
  draggedIndex.value = index
  dragOverIndex.value = index
}

function onDragEnter(index) {
  if (!props.draggableItems) return
  if (draggedIndex.value === -1) return
  dragOverIndex.value = index
}

function onDrop(index) {
  if (!props.draggableItems) return
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

function startInlineEdit(obj, index) {
  if (!props.editableTextLabel || obj?.type !== 'textbox') return
  emit('focus', obj)
  editingIndex.value = index
  editingText.value = obj.text || ''
  nextTick(() => {
    editInputEl.value?.focus()
    editInputEl.value?.select()
  })
}

function onInlineInput(obj) {
  emit('update-text', obj, editingText.value)
}

function commitInlineEdit(obj) {
  emit('commit-text', obj, editingText.value)
  editingIndex.value = -1
}

function cancelInlineEdit() {
  editingIndex.value = -1
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

