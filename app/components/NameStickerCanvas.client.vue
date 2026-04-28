<template>
  <div class="flex h-screen flex-col bg-[#ECECEC] text-[#2C2C2C]" style="font-family: 'PingFang TC', sans-serif">
    <!-- 頂部工具列 -->
    <div class="relative z-50 flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
      <div class="flex items-center space-x-4">
        <button
          @click="loadPersistedState"
          :disabled="!hasPersistedState"
          class="flex items-center space-x-2 text-gray-600 transition hover:text-[#2C2C2C] disabled:opacity-40"
        >
          <span class="text-sm font-semibold">載入儲存狀態</span>
        </button>
      </div>

      <div class="flex items-center space-x-4">
        <div class="flex space-x-3 text-gray-400">
          <button
            @click="undo"
            :disabled="undoStack.length <= 1"
            class="hover:text-[#2C2C2C] disabled:opacity-40"
            title="上一步"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
          </button>
          <button
            @click="redo"
            :disabled="redoStack.length === 0"
            class="hover:text-[#2C2C2C] disabled:opacity-40"
            title="下一步"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>
          </button>
        </div>
        <button
          @click="openPreview"
          class="flex items-center space-x-2 text-sm font-semibold text-gray-600 transition hover:text-[#2C2C2C]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
          <span>預覽</span>
        </button>
        <button
          @click="exportPDF"
          class="w-[120px] rounded-[100px] bg-[#0078C8] px-4 py-2 text-base font-medium text-white shadow-md transition hover:bg-[#0060a0]"
        >
          匯出 PDF
        </button>
      </div>
    </div>

    <!-- 主要內容區：左側選單 + 右側畫布 -->
    <div class="relative flex flex-1 overflow-hidden">
      <!-- Sidebar Icons -->
      <div class="relative z-40 flex w-[90px] shrink-0 flex-col items-center border-r border-gray-200 bg-white py-4 shadow-sm">
        <button
          v-for="item in sidebarItems"
          :key="item.id"
          class="mb-2 flex h-20 w-20 flex-col items-center justify-center rounded-xl transition-all"
          :class="activePanel === item.id ? 'bg-[#EAF7FF] text-[#2391DA]' : 'text-gray-600 hover:bg-gray-100'"
          @click="togglePanel(item.id)"
        >
          <span class="mb-1 text-2xl">{{ item.icon }}</span>
          <span class="text-[11px]" :class="activePanel === item.id ? 'font-bold' : 'font-medium'">{{ item.label }}</span>
        </button>
      </div>

      <!-- Side Panel -->
      <div
        class="absolute bottom-4 left-[106px] top-4 z-30 flex w-[340px] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl transition-all duration-300"
        :class="!activePanel ? 'pointer-events-none -translate-x-[10px] opacity-0' : 'translate-x-0 opacity-100'"
      >
        <div class="flex items-center justify-between border-b border-gray-50 px-6 py-5">
          <h2 class="text-lg font-bold">{{ activePanelTitle }}</h2>
          <button class="rounded-full bg-white p-1 text-gray-500 hover:text-[#2C2C2C]" @click="activePanel = null">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-6">
          <!-- 底圖上傳 -->
          <div v-if="activePanel === 'background'" class="space-y-4">
            <p class="text-sm text-gray-500">上傳姓名貼底圖以建立畫布</p>
            <input
              type="file"
              accept="image/*"
              @change="uploadNameStickerFrameImage"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition focus:border-[#0078C8] focus:outline-none"
            />
          </div>

          <!-- 圖片上傳 -->
          <div v-else-if="activePanel === 'image'" class="space-y-4">
            <p class="text-sm text-gray-500">上傳照片（置於畫框下方）</p>
            <input
              type="file"
              accept="image/*"
              @change="uploadPhotoImage"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition focus:border-[#0078C8] focus:outline-none"
            />
          </div>

          <!-- 文字新增與編輯 -->
          <div v-else-if="activePanel === 'text'" class="flex h-full flex-col">
            <!-- 姓名貼設定 -->
            <div class="mb-6 shrink-0 border-b border-gray-200 pb-6">
              <h3 class="mb-3 text-sm font-bold text-[#2C2C2C]">姓名貼設定</h3>
              <div class="mb-3 flex items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 transition-colors focus-within:border-[#0078C8]">
                <input
                  id="sticker-name-input"
                  v-model="stickerName"
                  type="text"
                  placeholder="請輸入姓名"
                  class="w-full border-none bg-transparent text-sm text-[#2C2C2C] focus:outline-none"
                />
              </div>
              <button
                @click="generateNameStickers"
                class="flex w-full items-center justify-center rounded-[100px] border border-[#0078c9] bg-white py-2.5 text-[16px] font-bold text-[#0078c9] transition hover:bg-gray-50"
              >
                產生姓名文字框
              </button>
            </div>

            <!-- 文字樣式編輯（選取文字框時顯示） -->
            <template v-if="activeIsText">
              <h3 class="mb-3 text-sm font-bold text-[#2C2C2C]">文字樣式</h3>
              <TextStyleToolbar
                v-model:fontFamily="fontFamily"
                v-model:fontSize="fontSize"
                v-model:fontColor="fontColor"
                :fontBold="fontBold"
                :fontItalic="fontItalic"
                :fontUnderline="fontUnderline"
                :fontFamilies="FONT_FAMILIES"
                @style-change="updateTextStyle"
                @toggle-bold="toggleBold"
                @toggle-italic="toggleItalic"
                @toggle-underline="toggleUnderline"
              />
              <button
                @click="applyStyleToAll"
                class="mt-4 flex w-full items-center justify-center rounded-[100px] bg-[#0078c9] py-2.5 text-[16px] font-bold text-white transition hover:bg-[#0060a0]"
              >
                套用編輯至全部
              </button>
            </template>
          </div>

          <!-- 圖層 -->
          <div v-else-if="activePanel === 'layers'" class="space-y-3">
            <div class="flex flex-col gap-2">
              <button
                @click="bringForward"
                :disabled="!activeObject"
                class="flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
              >
                ↑ 往上一層
              </button>
              <button
                @click="sendBackward"
                :disabled="!activeObject"
                class="flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
              >
                ↓ 往下一層
              </button>
            </div>
            <div class="my-2 h-px w-full bg-gray-200" />
            <button
              @click="duplicateSelectedObject"
              :disabled="!activeObject"
              class="flex w-full items-center justify-center rounded-[100px] border border-[#0078c9] bg-white py-2.5 text-sm font-bold text-[#0078c9] transition hover:bg-gray-50 disabled:opacity-40"
            >
              複製選取物件
            </button>
            <button
              @click="alignLeft"
              :disabled="!activeObject"
              class="flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
            >
              靠左對齊
            </button>
            <button
              @click="alignTop"
              :disabled="!activeObject"
              class="flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
            >
              靠上對齊
            </button>
          </div>
        </div>
      </div>

      <!-- 畫布顯示區域：等比縮放置中 -->
      <div
        ref="canvasContainerEl"
        class="relative z-10 flex flex-1 items-center justify-center overflow-hidden"
      >
        <div
          class="flex items-center justify-center w-full h-full"
          :style="{
            minWidth: canvasDisplayW + 'px',
            minHeight: canvasDisplayH + 'px',
            overflow: 'hidden',
          }"
        >
          <div
            :style="{
              transform: `scale(${canvasScale})`,
              transformOrigin: 'center',
              width: canvasInternalW + 'px',
              height: canvasInternalH + 'px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }"
          >
            <canvas ref="canvasEl" class="border border-gray-300 rounded"></canvas>
          </div>
        </div>
      </div>
    </div>

    <!-- 預覽彈窗 -->
    <div
      v-if="isPreviewOpen"
      class="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-6"
      @click.self="closePreview"
    >
      <div class="relative w-full h-full max-w-6xl max-h-[90vh] flex items-center justify-center">
        <button
          @click="closePreview"
          class="absolute top-0 right-0 -mt-4 -mr-4 w-10 h-10 rounded-full bg-white text-gray-700 shadow hover:bg-gray-100"
        >
          X
        </button>
        <img
          :src="previewImageUrl"
          alt="canvas preview"
          class="max-w-full max-h-full object-contain rounded bg-white"
        />
      </div>
    </div>
  </div>
  <CanvasZoomControl
    v-model="canvasScale"
    :min="0.2"
    :max="3"
    :step="0.05"
  />
</template>

<script setup lang="ts">
import CanvasZoomControl from './CanvasZoomControl.vue'
import { computed, ref } from 'vue'
import { useFabricCanvas } from '~/composables/useFabricCanvas'

const activePanel = ref<string | null>(null)
const togglePanel = (panel: string) => {
  activePanel.value = activePanel.value === panel ? null : panel
}

const sidebarItems = [
  { id: 'background', icon: '🖼️', label: '底圖上傳' },
  { id: 'image', icon: '📷', label: '照片上傳' },
  { id: 'text', icon: '✏️', label: '文字編輯' },
  { id: 'layers', icon: '📚', label: '圖層' },
]

const activePanelTitle = computed(() => {
  const item = sidebarItems.find((i) => i.id === activePanel.value)
  return item?.label ?? ''
})

const isPreviewOpen = ref(false)
const previewImageUrl = ref('')

const {
  canvasEl,
  canvasContainerEl,
  activeIsText,
  activeObject,
  fontSize,
  fontColor,
  fontFamily,
  fontBold,
  fontItalic,
  fontUnderline,
  stickerName,
  FONT_FAMILIES,
  undoStack,
  redoStack,
  hasPersistedState,
  canvasScale,
  canvasInternalW,
  canvasInternalH,
  canvasDisplayW,
  canvasDisplayH,
  updateTextStyle,
  toggleBold,
  toggleItalic,
  toggleUnderline,
  addText,
  generateNameStickers,
  uploadNameStickerFrameImage,
  uploadPhotoImage,
  bringForward,
  sendBackward,
  duplicateSelectedObject,
  alignLeft,
  alignTop,
  applyStyleToAll,
  undo,
  redo,
  loadPersistedState,
  getCanvasPreviewDataUrl,
  exportPDF,
} = useFabricCanvas({ storageKey: 'fabric-canvas-state:name-sticker' })

const openPreview = () => {
  const url = getCanvasPreviewDataUrl()
  if (!url) {
    alert('目前沒有可預覽的畫布')
    return
  }
  previewImageUrl.value = url
  isPreviewOpen.value = true
}

const closePreview = () => {
  isPreviewOpen.value = false
  previewImageUrl.value = ''
}
</script>
