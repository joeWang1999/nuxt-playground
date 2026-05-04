<template>
  <div class="relative z-50 flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
    <div class="flex items-center space-x-4">
      <button
        @click="$emit('load-persisted')"
        :disabled="!canLoadPersisted"
        class="flex items-center space-x-2 text-gray-600 transition hover:text-[#2C2C2C] disabled:opacity-40"
      >
        <span class="text-sm font-semibold">載入儲存狀態</span>
      </button>
    </div>

    <div class="flex items-center space-x-4">
      <div class="flex space-x-3 text-gray-400">
        <button
          @click="$emit('undo')"
          :disabled="!canUndo"
          class="hover:text-[#2C2C2C] disabled:opacity-40"
          title="上一步"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
        </button>
        <button
          @click="$emit('redo')"
          :disabled="!canRedo"
          class="hover:text-[#2C2C2C] disabled:opacity-40"
          title="下一步"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>
        </button>
      </div>
      <button
        @click="$emit('open-preview')"
        class="flex items-center space-x-2 text-sm font-semibold text-gray-600 transition hover:text-[#2C2C2C]"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
        <span>預覽</span>
      </button>
      <button
        @click="$emit('export-pdf')"
        class="w-[120px] rounded-[100px] bg-[#0078C8] px-4 py-2 text-base font-medium text-white shadow-md transition hover:bg-[#0060a0]"
      >
        匯出 PDF
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  canLoadPersisted: boolean
  canUndo: boolean
  canRedo: boolean
}>()

defineEmits<{
  (e: 'load-persisted'): void
  (e: 'undo'): void
  (e: 'redo'): void
  (e: 'open-preview'): void
  (e: 'export-pdf'): void
}>()
</script>
