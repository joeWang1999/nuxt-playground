
<template>
  <div class="flex h-full flex-col overflow-hidden bg-[#ECECEC] text-[#2C2C2C]" style="font-family: 'PingFang TC', sans-serif">
    <!-- 頂部工具列 -->
    <TopToolbar
      :canLoadPersisted="hasPersistedState"
      :canUndo="undoStack.length > 1"
      :canRedo="redoStack.length > 0"
      :canProceedNext="canvasInternalW > 0 && canvasInternalH > 0"
      :showNextStep="true"
      @load-persisted="loadPersistedState"
      @undo="undo"
      @redo="redo"
      @open-preview="openPreview"
      @export-pdf="exportPDF"
      @next-step="openReviewModal"
    />

    <!-- 主內容區：左側圖示欄＋浮動面板＋畫布 -->
    <div class="relative flex flex-1 overflow-hidden pb-20 md:pb-0">
      <SidebarLayout
        v-model="activePanel"
        :sidebarItems="sidebarItems"
        :title="activePanelTitle"
      >
        <!-- 畫框上傳 -->
        <div v-if="activePanel === 'background'" class="space-y-4">
          <p class="text-sm text-gray-500">上傳畫框（建立畫布）</p>
          <input
            type="file"
            accept="image/*"
            @change="uploadFrameImage"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition focus:border-[#0078C8] focus:outline-none"
          />
        </div>

        <!-- 圖片上傳 -->
        <div v-else-if="activePanel === 'image'" class="space-y-4">
          <p class="text-sm text-gray-500">上傳照片（置於畫框下方）</p>
          <input
            type="file"
            accept="image/*"
            multiple
            @change="uploadPhotoImage"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition focus:border-[#0078C8] focus:outline-none"
          />
        </div>

        <!-- 文字新增與編輯 -->
        <div v-else-if="activePanel === 'text'" class="flex h-full flex-col">
          <button
            @click="addText('可編輯文字', 80, 80, () => { activePanel = null })"
            class="flex w-full items-center justify-center rounded-[100px] border border-[#0078c9] bg-white py-2.5 text-[16px] font-bold text-[#0078c9] transition hover:bg-gray-50"
          >
            新增文字
          </button>
          <button
            @click="duplicateSelectedObject"
            :disabled="!activeObject"
            class="mt-3 flex w-full items-center justify-center rounded-[100px] border border-[#0078c9] bg-white py-2.5 text-sm font-bold text-[#0078c9] transition hover:bg-gray-50 disabled:opacity-40"
          >
            複製選取物件
          </button>

          <div class="mt-4">
            <CanvasObjectList
              :objects="textCanvasObjects"
              :activeIndex="activeTextObjectIndex"
              title="文字列表"
              :draggableItems="false"
              :editableTextLabel="true"
              @focus="focusObject"
              @duplicate="duplicateObjectFromList"
              @update-text="updateTextboxObjectText"
              @commit-text="commitTextboxObjectText"
              @remove="removeObjectFromCanvas"
              class="w-full"
            />
          </div>
        </div>

        <!-- 拼貼圖片 -->
        <div v-else-if="activePanel === 'collage'" class="space-y-3">
          <p class="text-sm text-gray-500">點選圖片加入畫布</p>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="img in collageImages"
              :key="img.url"
              class="group relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50 transition hover:border-[#0078C8] hover:shadow-md"
              @click="addCollageImageToCanvas(img.url)"
            >
              <img
                :src="img.url"
                :alt="img.label"
                class="h-24 w-full object-cover transition group-hover:scale-105"
              />
              <span class="block truncate px-1 pb-1 pt-0.5 text-center text-xs text-gray-500">{{ img.label }}</span>
            </button>
          </div>
        </div>

        <!-- 物件列表/圖層 -->
        <div v-else-if="activePanel === 'layers'" class="space-y-3">
          <div class="w-full">
            <div class="flex gap-2 mb-3">
              <button
                @click="bringForward"
                :disabled="!activeObject"
                class="flex-1 flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
              >
                ↑ 往上一層
              </button>
              <button
                @click="sendBackward"
                :disabled="!activeObject"
                class="flex-1 flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
              >
                ↓ 往下一層
              </button>
            </div>
            <CanvasObjectList
              :objects="canvasObjects"
              :activeIndex="activeObjectIndex"
              title="物件列表"
              :draggableItems="true"
              @focus="focusObject"
              @duplicate="duplicateObjectFromList"
              @remove="removeObjectFromCanvas"
              @reorder="reorderObjectLayer"
              class="w-full"
            />
          </div>
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

const activePanel = ref<string | null>(null)

const sidebarItems = [
  { id: 'background', icon: '🖼️', label: '畫框上傳' },
  { id: 'image', icon: '📷', label: '照片上傳' },
  { id: 'collage', icon: '🎨', label: '拼貼' },
  { id: 'text', icon: '✏️', label: '文字編輯' },
  { id: 'layers', icon: '📚', label: '圖層' },
]

const collageImages = [
  { label: '城市夜景', url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&q=80' },
  { label: '山嶽晨霧', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80' },
  { label: '海浪海岸', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80' },
  { label: '森林小徑', url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&q=80' },
  { label: '花朵特寫', url: 'https://images.unsplash.com/photo-1490750967868-88df5691240e?w=400&q=80' },
  { label: '星空銀河', url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&q=80' },
  { label: '沙漠日落', url: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=400&q=80' },
  { label: '秋葉林道', url: 'https://images.unsplash.com/photo-1477414348463-c0eb7f1359b6?w=400&q=80' },
]

const activePanelTitle = computed(() => {
  const item = sidebarItems.find((i) => i.id === activePanel.value)
  return item?.label ?? ''
})

const isPreviewOpen = ref(false)
const previewImageUrl = ref('')
const isReviewModalOpen = ref(false)
const reviewPreviewUrl = ref('')

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
  addText,
  uploadFrameImage,
  uploadPhotoImage,
  addCollageImageToCanvas,
  bringForward,
  sendBackward,
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
} = useFabricCanvas({ storageKey: 'fabric-canvas-state:general' })

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
