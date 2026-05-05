<template>
  <div class="flex flex-col w-44 shrink-0 border-r border-gray-200 bg-transparent">
    <p class="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
      {{ title }}
    </p>
    <div class="flex-1 overflow-y-auto px-3">
      <div
        v-if="!objects.length"
        class="px-3 py-4 text-xs text-gray-400 text-center"
      >
        尚無物件
      </div>
      <div
        class="flex flex-col gap-2"
      >
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
          'flex items-center gap-2 px-0 py-2 cursor-pointer select-none border-b text-sm transition-colors',
          activeIndex === index
            ? 'border-blue-500 border-b-2 text-blue-700 font-medium'
            : 'border-gray-200 text-gray-700 hover:text-gray-900',
          dragOverIndex === index && draggedIndex !== index
            ? 'ring-1 ring-inset ring-blue-300'
            : '',
          draggedIndex === index ? 'opacity-60' : '',
        ]"
      >
        <input
          v-if="editableTextLabel && obj.type === 'textbox' && editingIndex === index"
          ref="editInputEl"
          v-model="editingText"
          class="flex-1 min-w-0 rounded border border-blue-300 bg-white px-1.5 py-0.5 text-sm text-gray-800 "
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
        <div v-if="obj.selectable !== false" class="shrink-0 flex items-center gap-1">
          <button
            @click.stop="$emit('duplicate', obj)"
            class="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-blue-600 transition-colors text-xs leading-none"
            title="複製"
          >⧉</button>
          <button
            @click.stop="$emit('remove', obj)"
            class="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-600 transition-colors text-xs leading-none"
            title="移除"
          >✕</button>
        </div>
      </div>
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

const emit = defineEmits(['focus', 'duplicate', 'remove', 'reorder', 'update-text', 'commit-text'])

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

