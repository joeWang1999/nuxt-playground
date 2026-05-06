<template>
  <div
    v-if="visible"
    class="fixed z-[60]"
    :style="{
      left: left + 'px',
      top: top + 'px',
      transform: 'translate(-50%, -100%)',
    }"
    @click.stop
  >
    <div class="relative">
      <div class="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
        <button
          class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-700 transition hover:bg-gray-100"
          title="複製物件"
          @click="emit('duplicate')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button
          class="flex h-9 w-9 items-center justify-center rounded-lg text-[#D14343] transition hover:bg-red-50"
          title="刪除物件"
          @click="emit('delete')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </button>
        <button
          class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-700 transition hover:bg-gray-100"
          title="更多"
          @click="emit('toggle-more-menu')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
        </button>
      </div>

      <div
        v-if="moreMenuOpen"
        class="absolute right-0 top-[calc(100%+8px)] w-56 rounded-xl border border-gray-200 bg-white p-1 shadow-xl"
      >
        <button class="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100" @click="emit('align-left')">靠左</button>
        <button class="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100" @click="emit('align-center')">水平置中</button>
        <button class="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100" @click="emit('align-right')">靠右</button>
        <div class="my-1 h-px bg-gray-200"></div>
        <button class="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100" @click="emit('align-top')">靠上</button>
        <button class="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100" @click="emit('align-middle')">垂直置中</button>
        <button class="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100" @click="emit('align-bottom')">靠下</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  left: number
  top: number
  moreMenuOpen: boolean
}>()

const emit = defineEmits<{
  duplicate: []
  delete: []
  'toggle-more-menu': []
  'align-left': []
  'align-center': []
  'align-right': []
  'align-top': []
  'align-middle': []
  'align-bottom': []
}>()
</script>
