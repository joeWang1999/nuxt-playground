
<template>
  <div class="flex h-screen flex-col bg-[#ECECEC] text-[#2C2C2C]" style="font-family: 'PingFang TC', sans-serif">
    <!-- 頂部工具列 -->
    <TopToolbar
      :canLoadPersisted="hasPersistedState"
      :canUndo="undoStack.length > 1"
      :canRedo="redoStack.length > 0"
      @load-persisted="loadPersistedState"
      @undo="undo"
      @redo="redo"
      @open-preview="openPreview"
      @export-pdf="exportPDF"
    />

    <!-- 主內容區：左側圖示欄＋浮動面板＋畫布 -->
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
                @focus="focusObject"
                @remove="removeObjectFromCanvas"
                @reorder="reorderObjectLayer"
                class="w-full"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 畫布顯示區域：等比縮放置中 -->
      <div
        ref="canvasContainerEl"
        class="relative z-10 flex flex-1 items-center justify-center overflow-hidden"
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

    <!-- 文字編輯工具列（選取文字框時顯示，懸浮於畫布上方） -->
    <div
      v-if="activeIsText"
      class="fixed left-1/2 z-50 flex flex-wrap items-center gap-4 p-3 bg-gray-100 rounded-xl shadow-xl border border-gray-200"
      style="top: 90px; transform: translateX(-50%); min-width: 420px; max-width: 90vw;"
    >
      <div>
        <label class="text-sm text-gray-600">字型</label>
        <select v-model="fontFamily" @change="updateTextStyle" class="border rounded p-1">
          <option v-for="f in FONT_FAMILIES" :key="f" :value="f">{{ f }}</option>
        </select>
      </div>
      <div>
        <label class="text-sm text-gray-600">字體大小</label>
        <input
          type="number"
          min="10"
          max="120"
          v-model="fontSize"
          @input="updateTextStyle"
          class="border rounded p-1 w-20"
        />
      </div>
      <div>
        <label class="text-sm text-gray-600">顏色</label>
        <input
          type="color"
          v-model="fontColor"
          @input="updateTextStyle"
          class="w-10 h-8 p-0 border rounded"
        />
      </div>
      <div class="flex gap-1">
        <button
          @click="toggleBold"
          :class="['w-8 h-8 rounded border font-bold text-sm transition-colors', fontBold ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100']"
        >B</button>
        <button
          @click="toggleItalic"
          :class="['w-8 h-8 rounded border italic text-sm transition-colors', fontItalic ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100']"
        >I</button>
        <button
          @click="toggleUnderline"
          :class="['w-8 h-8 rounded border underline text-sm transition-colors', fontUnderline ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100']"
        >U</button>
        <button
          @click="toggleLinethrough"
          :class="['w-8 h-8 rounded border line-through text-sm transition-colors', fontLinethrough ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100']"
        >S</button>
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
import TopToolbar from './TopToolbar.vue'
import { computed, ref } from 'vue'
import { useFabricCanvas } from '~/composables/useFabricCanvas'

const activePanel = ref<string | null>(null)
const togglePanel = (panel: string) => {
  activePanel.value = activePanel.value === panel ? null : panel
}

const sidebarItems = [
  { id: 'background', icon: '🖼️', label: '畫框上傳' },
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
  focusObject,
  removeObjectFromCanvas,
  reorderObjectLayer,
  undo,
  redo,
  loadPersistedState,
  getCanvasPreviewDataUrl,
  exportPDF,
} = useFabricCanvas({ storageKey: 'fabric-canvas-state:general' })

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
