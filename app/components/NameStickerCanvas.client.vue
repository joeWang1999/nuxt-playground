<template>
  <div class="flex h-full flex-col overflow-hidden bg-[#ECECEC] text-[#2C2C2C]" style="font-family: 'PingFang TC', sans-serif">
    <!-- 頂部工具列 -->
    <TopToolbar
      :canLoadPersisted="hasPersistedState"
      :canUndo="undoStack.length > 1"
      :canRedo="redoStack.length > 0"
      :canProceedNext="canvasInternalW > 0 && canvasInternalH > 0"
      @load-persisted="loadPersistedState"
      @undo="undo"
      @redo="redo"
      @open-preview="openPreview"
      @export-pdf="exportPDF"
      @next-step="openReviewModal"
    />

    <!-- 主要內容區：左側選單 + 右側畫布 -->
    <div class="relative flex flex-1 overflow-hidden pb-20 md:pb-0">
      <!-- Sidebar Icons -->
      <div class="relative z-40 hidden w-[90px] shrink-0 flex-col items-center border-r border-gray-200 bg-white py-4 shadow-sm md:flex">
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

      <div
        v-if="activePanel"
        class="fixed inset-0 z-40 bg-black/30 md:hidden"
        @click="activePanel = null"
      ></div>

      <!-- Side Panel -->
      <div
        class="fixed inset-x-0 bottom-[69px] z-50 flex max-h-[calc(50vh-69px)] flex-col overflow-hidden rounded-t-[28px] border-t border-gray-200 bg-white transition-all duration-300 md:absolute md:bottom-4 md:left-[106px] md:right-auto md:top-4 md:z-30 md:max-h-none md:w-[340px] md:rounded-2xl md:border md:border-gray-100 md:shadow-xl"
        :class="!activePanel ? 'pointer-events-none translate-y-full opacity-0 md:-translate-x-[10px] md:translate-y-0' : 'translate-y-0 opacity-100 md:translate-x-0'"
      >
        <div class="mx-auto mt-2 h-1.5 w-12 rounded-full bg-gray-300 md:hidden"></div>
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
              <div class="mb-3">
                <select
                  v-model="selectedStickerSpec"
                  class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#2C2C2C] transition focus:border-[#0078C8] focus:outline-none"
                >
                  <option value="" disabled>請選擇姓名貼規格</option>
                  <option
                    v-for="spec in stickerSpecOptions"
                    :key="spec.value"
                    :value="spec.value"
                  >
                    {{ spec.label }}
                  </option>
                </select>
              </div>
              <button
                @click="handleGenerateNameStickers"
                :disabled="!canGenerateNameStickers"
                class="flex w-full items-center justify-center rounded-[100px] border border-[#0078c9] bg-white py-2.5 text-[16px] font-bold text-[#0078c9] transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                產生姓名文字框
              </button>
            </div>

            <div class="mb-6">
              <CanvasObjectList
                :objects="textCanvasObjects"
                :activeIndex="activeTextObjectIndex"
                title="文字列表"
                :draggableItems="true"
                :editableTextLabel="true"
                @focus="focusObject"
                @duplicate="duplicateObjectFromList"
                @update-text="updateTextboxObjectText"
                @commit-text="commitTextboxObjectText"
                @remove="removeObjectFromCanvas"
                @reorder="reorderObjectLayer"
                class="w-full"
              />
            </div>

            <button
              v-if="activeIsText"
              @click="applyStyleToAll"
              class="mt-2 flex w-full items-center justify-center rounded-[100px] bg-[#0078c9] py-2.5 text-[16px] font-bold text-white transition hover:bg-[#0060a0]"
            >
              套用編輯至全部
            </button>
          </div>

        </div>
      </div>

      <div class="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 border-t border-gray-200 bg-white px-2 py-2 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] md:hidden">
        <button
          v-for="item in sidebarItems"
          :key="item.id"
          class="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center transition-all"
          :class="activePanel === item.id ? 'bg-[#EAF7FF] text-[#2391DA]' : 'text-gray-600'"
          @click="togglePanel(item.id)"
        >
          <span class="text-xl leading-none">{{ item.icon }}</span>
          <span class="text-[10px] font-medium leading-tight">{{ item.label }}</span>
        </button>
      </div>

      <!-- 畫布顯示區域：等比縮放置中 -->
      <div
        ref="canvasContainerEl"
        class="relative z-10 flex flex-1 items-center justify-center overflow-hidden transition-[padding] duration-300 md:pr-4"
        :class="activePanel ? 'pb-[calc(50vh-72px)] md:pl-[380px] md:pb-0' : 'md:pl-4'"
        @click="closeObjectActionMoreMenu"
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
            class="transition-transform duration-200 ease-out will-change-transform"
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
            <canvas ref="canvasEl"></canvas>
          </div>
        </div>

        <div
          v-if="objectActionBar.visible"
          class="fixed z-[60]"
          :style="{
            left: objectActionBar.left + 'px',
            top: objectActionBar.top + 'px',
            transform: 'translate(-50%, -100%)',
          }"
          @click.stop
        >
          <div class="relative">
            <div class="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
              <button
                class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-700 transition hover:bg-gray-100"
                title="複製物件"
                @click="duplicateSelectedObject"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
              <button
                class="flex h-9 w-9 items-center justify-center rounded-lg text-[#D14343] transition hover:bg-red-50"
                title="刪除物件"
                @click="deleteSelectedObject"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
              </button>
              <button
                class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-700 transition hover:bg-gray-100"
                title="更多"
                @click="toggleObjectActionMoreMenu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
              </button>
            </div>

            <div
              v-if="objectActionMoreMenuOpen"
              class="absolute right-0 top-[calc(100%+8px)] w-56 rounded-xl border border-gray-200 bg-white p-1 shadow-xl"
            >
              <button class="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100" @click="alignLeft">靠左</button>
              <button class="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100" @click="alignCenterToCanvas">水平置中</button>
              <button class="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100" @click="alignRightToCanvas">靠右</button>
              <div class="my-1 h-px bg-gray-200"></div>
              <button class="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100" @click="alignTopToCanvas">靠上</button>
              <button class="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100" @click="alignMiddleToCanvas">垂直置中</button>
              <button class="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100" @click="alignBottomToCanvas">靠下</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <TextFloatingToolbar
      v-if="activeIsText"
      v-model:fontFamily="fontFamily"
      v-model:fontSize="fontSize"
      v-model:fontColor="fontColor"
      :fontFamilies="FONT_FAMILIES"
      :fontBold="fontBold"
      :fontItalic="fontItalic"
      :fontUnderline="fontUnderline"
      :fontLinethrough="fontLinethrough"
      @style-change="updateTextStyle"
      @toggle-bold="toggleBold"
      @toggle-italic="toggleItalic"
      @toggle-underline="toggleUnderline"
      @toggle-linethrough="toggleLinethrough"
    />

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

    <ReviewExportModal
      :visible="isReviewModalOpen"
      :previewUrl="reviewPreviewUrl"
      @close="closeReviewModal"
      @confirm="confirmExportPdf"
    />
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
import ReviewExportModal from './ReviewExportModal.vue'
import TextFloatingToolbar from './TextFloatingToolbar.vue'
import TopToolbar from './TopToolbar.vue'
import { computed, nextTick, ref } from 'vue'
import { useFabricCanvas } from '~/composables/useFabricCanvas'

type StickerSpecOption = {
  label: string
  value: '4x6-landscape' | '4x6-portrait' | '4x5-landscape' | '4x5-portrait'
}

const activePanel = ref<string | null>(null)
const togglePanel = (panel: string) => {
  activePanel.value = activePanel.value === panel ? null : panel
}

const sidebarItems = [
  { id: 'background', icon: '🖼️', label: '底圖上傳' },
  { id: 'text', icon: '✏️', label: '文字編輯' },
]

const activePanelTitle = computed(() => {
  const item = sidebarItems.find((i) => i.id === activePanel.value)
  return item?.label ?? ''
})

const isPreviewOpen = ref(false)
const previewImageUrl = ref('')
const isReviewModalOpen = ref(false)
const reviewPreviewUrl = ref('')
const stickerSpecOptions: StickerSpecOption[] = [
  { label: '4X6橫式', value: '4x6-landscape' },
  { label: '4X6直式', value: '4x6-portrait' },
  { label: '4X5橫式', value: '4x5-landscape' },
  { label: '4X5直式', value: '4x5-portrait' },
]
const selectedStickerSpec = ref<'' | StickerSpecOption['value']>('')

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
  fontLinethrough,
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
  toggleLinethrough,
  generateNameStickers,
  uploadNameStickerFrameImage,
  duplicateSelectedObject,
  deleteSelectedObject,
  objectActionBar,
  objectActionMoreMenuOpen,
  toggleObjectActionMoreMenu,
  closeObjectActionMoreMenu,
  alignCenterToCanvas,
  alignRightToCanvas,
  alignTopToCanvas,
  alignMiddleToCanvas,
  alignBottomToCanvas,
  alignLeft,
  applyStyleToAll,
  canvasObjects,
  activeObjectIndex,
  reorderObjectLayer,
  focusObject,
  updateTextboxObjectText,
  commitTextboxObjectText,
  removeObjectFromCanvas,
  undo,
  redo,
  loadPersistedState,
  getCanvasPreviewDataUrl,
  exportPDF,
} = useFabricCanvas({ storageKey: 'fabric-canvas-state:name-sticker' })

const textCanvasObjects = computed(() => {
  return canvasObjects.value.filter((obj) => obj.type === 'textbox')
})

const activeTextObjectIndex = computed(() => {
  const active = canvasObjects.value[activeObjectIndex.value]
  if (!active || active.type !== 'textbox') return -1
  return textCanvasObjects.value.findIndex((obj) => obj === active)
})

const duplicateObjectFromList = async (obj: unknown) => {
  focusObject(obj as any)
  await nextTick()
  await duplicateSelectedObject()
}

const canGenerateNameStickers = computed(() => {
  return stickerName.value.trim().length > 0 && selectedStickerSpec.value !== ''
})

const handleGenerateNameStickers = () => {
  if (!selectedStickerSpec.value) return
  generateNameStickers(selectedStickerSpec.value)
}

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

const openReviewModal = () => {
  const url = getCanvasPreviewDataUrl()
  if (!url) {
    alert('目前沒有可預覽的畫布')
    return
  }
  reviewPreviewUrl.value = url
  isReviewModalOpen.value = true
}

const closeReviewModal = () => {
  isReviewModalOpen.value = false
  reviewPreviewUrl.value = ''
}

const confirmExportPdf = async () => {
  await exportPDF()
  closeReviewModal()
}
</script>
