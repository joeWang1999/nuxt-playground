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
      <SidebarLayout
        v-model="activePanel"
        :sidebarItems="sidebarItems"
        :title="activePanelTitle"
      >
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
      </SidebarLayout>

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

        <ObjectActionBar
          :visible="objectActionBar.visible"
          :left="objectActionBar.left"
          :top="objectActionBar.top"
          :moreMenuOpen="objectActionMoreMenuOpen"
          @duplicate="duplicateSelectedObject"
          @delete="deleteSelectedObject"
          @toggle-more-menu="toggleObjectActionMoreMenu"
          @align-left="alignLeft"
          @align-center="alignCenterToCanvas"
          @align-right="alignRightToCanvas"
          @align-top="alignTopToCanvas"
          @align-middle="alignMiddleToCanvas"
          @align-bottom="alignBottomToCanvas"
        />
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
