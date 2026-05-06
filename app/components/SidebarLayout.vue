<template>
  <!-- Sidebar Icons (desktop) -->
  <div class="relative z-40 hidden w-[90px] shrink-0 flex-col items-center border-r border-gray-200 bg-white py-4 shadow-sm md:flex">
    <button
      v-for="item in sidebarItems"
      :key="item.id"
      class="mb-2 flex h-20 w-20 flex-col items-center justify-center rounded-xl transition-all"
      :class="modelValue === item.id ? 'bg-[#EAF7FF] text-[#2391DA]' : 'text-gray-600 hover:bg-gray-100'"
      @click="togglePanel(item.id)"
    >
      <span class="mb-1 text-2xl">{{ item.icon }}</span>
      <span class="text-[11px]" :class="modelValue === item.id ? 'font-bold' : 'font-medium'">{{ item.label }}</span>
    </button>
  </div>

  <!-- Mobile overlay backdrop -->
  <div
    v-if="modelValue"
    class="fixed inset-0 z-40 bg-black/30 md:hidden"
    @click="emit('update:modelValue', null)"
  ></div>

  <!-- Side Panel -->
  <div
    class="fixed inset-x-0 bottom-[69px] z-50 flex max-h-[calc(50vh-69px)] flex-col overflow-hidden rounded-t-[28px] border-t border-gray-200 bg-white transition-all duration-300 md:absolute md:bottom-4 md:left-[106px] md:right-auto md:top-4 md:z-30 md:max-h-none md:w-[340px] md:rounded-2xl md:border md:border-gray-100 md:shadow-xl"
    :class="!modelValue ? 'pointer-events-none translate-y-full opacity-0 md:-translate-x-[10px] md:translate-y-0' : 'translate-y-0 opacity-100 md:translate-x-0'"
  >
    <div class="mx-auto mt-2 h-1.5 w-12 rounded-full bg-gray-300 md:hidden"></div>
    <div class="flex items-center justify-between border-b border-gray-50 px-6 py-5">
      <h2 class="text-lg font-bold">{{ title }}</h2>
      <button class="rounded-full bg-white p-1 text-gray-500 hover:text-[#2C2C2C]" @click="emit('update:modelValue', null)">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
    <div class="flex-1 overflow-y-auto p-6">
      <slot />
    </div>
  </div>

  <!-- Mobile bottom nav -->
  <div
    class="fixed inset-x-0 bottom-0 z-40 grid border-t border-gray-200 bg-white px-2 py-2 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] md:hidden"
    :style="{ gridTemplateColumns: `repeat(${sidebarItems.length}, minmax(0, 1fr))` }"
  >
    <button
      v-for="item in sidebarItems"
      :key="item.id"
      class="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center transition-all"
      :class="modelValue === item.id ? 'bg-[#EAF7FF] text-[#2391DA]' : 'text-gray-600'"
      @click="togglePanel(item.id)"
    >
      <span class="text-xl leading-none">{{ item.icon }}</span>
      <span class="text-[10px] font-medium leading-tight">{{ item.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
type SidebarItem = {
  id: string
  icon: string
  label: string
}

const props = defineProps<{
  sidebarItems: SidebarItem[]
  modelValue: string | null
  title: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const togglePanel = (id: string) => {
  emit('update:modelValue', props.modelValue === id ? null : id)
}
</script>
