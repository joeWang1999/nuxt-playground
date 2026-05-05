<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-[80] bg-white"
  >
    <div class="grid h-full w-full grid-cols-1 md:grid-cols-12">
      <div class="col-span-1 flex items-center justify-center bg-[#f4f4f4] p-6 md:col-span-9">
        <img
          :src="previewUrl"
          alt="design preview"
          class="h-full max-h-[90vh] w-full object-contain"
        />
      </div>
      <div class="relative col-span-1 flex flex-col border-l border-gray-200 bg-white p-8 md:col-span-3">
        <button
          class="absolute right-5 top-5 rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
          @click="$emit('close')"
          aria-label="關閉"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>

        <div class="mt-10">
          <h2 class="text-2xl font-bold text-[#2C2C2C]">請檢閱您的設計!</h2>
          <ul class="mt-5 space-y-3 text-sm leading-6 text-gray-600">
            <li>• 請確認設計與文字無誤</li>
            <li>• 產生列印碼後將無法修改。</li>
            <li>• 登入會員即可將設計儲存至「我的設計」。</li>
          </ul>
        </div>

        <div class="mt-auto space-y-3 pt-8">
          <button
            class="flex w-full items-center justify-center rounded-[100px] bg-[#0078C8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0060a0]"
            @click="$emit('confirm')"
          >
            確認：匯出PDF
          </button>
          <button
            class="flex w-full items-center justify-center rounded-[100px] border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            @click="$emit('close')"
          >
            回去繼續編輯
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  previewUrl: string
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
}>()
</script>
