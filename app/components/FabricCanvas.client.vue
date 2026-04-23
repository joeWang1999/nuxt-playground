<template>
  <div class="p-6 space-y-4">
    <div class="flex w-full flex-row items-stretch gap-6">
      <!-- 畫布顯示區域：等比縮放置中 -->
      <div
        ref="canvasContainerEl"
        class="flex flex-1 items-center justify-center overflow-hidden"
      >
        <div
          :style="{
            width: canvasDisplayW + 'px',
            height: canvasDisplayH + 'px',
            flexShrink: 0,
            overflow: 'hidden',
          }"
        >
          <div
            :style="{
              transform: `scale(${canvasScale})`,
              transformOrigin: 'top left',
              width: canvasInternalW + 'px',
              height: canvasInternalH + 'px',
            }"
          >
            <canvas ref="canvasEl" class="border border-gray-300 rounded"></canvas>
          </div>
        </div>
      </div>

      <!-- 側邊工具列 -->
      <div class="mb-4 ml-auto flex w-56 shrink-0 flex-col gap-8">
        <!-- 物件操作 -->
        <div class="flex flex-col gap-4">
          <!-- 上傳底圖建立畫布 -->
          <p class="text-sm text-gray-600 font-medium">上傳畫框（建立畫布）</p>
          <input
            type="file"
            accept="image/*"
            @change="uploadFrameImage"
            class="px-4 py-2 border rounded text-sm"
          />
          <p class="text-sm text-gray-600 font-medium">上傳姓名貼底圖（匯出時橫向 4 連貼）</p>
          <input
            type="file"
            accept="image/*"
            @change="uploadNameStickerFrameImage"
            class="px-4 py-2 border rounded text-sm"
          />
          <!-- 上傳照片（放在畫框下方，可編輯） -->
          <p class="text-sm text-gray-600 font-medium">上傳照片（置於畫框下方）</p>
          <input
            type="file"
            accept="image/*"
            @change="uploadPhotoImage"
            class="px-4 py-2 border rounded text-sm"
          />
          <!-- 姓名貼設定 -->
          <p class="text-sm text-gray-600 font-medium">姓名貼設定</p>
          <div class="flex flex-col gap-1">
            <label class="text-sm text-gray-600" for="sticker-name-input">姓名</label>
            <input
              id="sticker-name-input"
              v-model="stickerName"
              type="text"
              placeholder="請輸入姓名"
              class="px-4 py-2 border rounded text-sm"
            />
          </div>
          <button
            @click="generateNameStickers"
            class="px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-800"
          >
            產生姓名文字框
          </button>
          <!-- 新增文字 -->
          <button
            @click="addText('可編輯文字', 80, 80)"
            class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            新增文字
          </button>
          <!-- 匯出 PDF -->
          <button
            @click="exportPDF"
            class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            匯出 PDF
          </button>
          <button
            @click="duplicateSelectedObject"
            :disabled="!activeObject"
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40"
          >
            複製選取物件
          </button>

          <!-- 上一步 / 下一步 -->
          <div class="flex gap-3">
            <button
              @click="undo"
              :disabled="undoStack.length <= 1"
              class="flex-1 px-3 py-2 bg-gray-500 text-white rounded disabled:opacity-40"
            >
              上一步
            </button>
            <button
              @click="redo"
              :disabled="redoStack.length === 0"
              class="flex-1 px-3 py-2 bg-gray-500 text-white rounded disabled:opacity-40"
            >
              下一步
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 文字編輯工具列（選取文字框時顯示） -->
    <div v-if="activeIsText" class="flex flex-wrap items-center gap-4 p-3 bg-gray-100 rounded">
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
      </div>
    </div>

    <!-- 圖層順序調整（選取物件時顯示） -->
    <div v-if="activeObject" class="space-x-3">
      <button
        @click="bringForward"
        class="px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-800"
      >
        ↑ 往上一層
      </button>
      <button
        @click="sendBackward"
        class="px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-800"
      >
        ↓ 往下一層
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import jsPDF from 'jspdf'
import * as fabric from 'fabric'

// ─── Canvas Instance ──────────────────────────────────────────────────────────
const canvasEl = ref(null)
const canvasContainerEl = ref(null)
let canvas = null
const frameObject = ref(null)

// ─── Selection State ──────────────────────────────────────────────────────────
const activeIsText = ref(false)   // 目前選取的物件是否為文字框
const activeObject = ref(null)    // 目前選取的物件

// ─── Text Style ───────────────────────────────────────────────────────────────
const fontSize = ref(24)
const DEFAULT_TEXT_COLOR = '#222222'
const fontColor = ref(DEFAULT_TEXT_COLOR)
const fontFamily = ref('Arial')
const fontBold = ref(false)
const fontItalic = ref(false)
const fontUnderline = ref(false)
const stickerName = ref('')
const TEXTBOX_PADDING_PX = 4

const FONT_FAMILIES = ['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Helvetica', 'Tahoma']

// ─── Undo / Redo Stack ────────────────────────────────────────────────────────
const undoStack = ref([])
const redoStack = ref([])
const isBatchMode = ref(false)  // 批次操作期間暫停快照儲存

// ─── Canvas Display Scale ─────────────────────────────────────────────────────
const canvasScale = ref(1)
const canvasInternalW = ref(800)
const canvasInternalH = ref(500)
const canvasDisplayW = ref(800)
const canvasDisplayH = ref(500)
const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024
const NAME_STICKER_EXPORT_COPIES = 4
const frameType = ref('general')

// ─── Custom Control Icons ─────────────────────────────────────────────────────
const iconDelete = new Image()
iconDelete.src = '/icons/delete.svg'

const iconScale = new Image()
iconScale.src = '/icons/scale.svg'

/* ============================================================
   計算並套用畫布顯示縮放比例
   依容器實際寬高等比縮放，確保畫布不超出左側顯示區域
   ============================================================ */
function updateCanvasScale(w, h) {
  canvasInternalW.value = w
  canvasInternalH.value = h
  const container = canvasContainerEl.value
  const maxW = container ? container.clientWidth : window.innerWidth * 0.65
  const maxH = container ? container.clientHeight || window.innerHeight * 0.85 : window.innerHeight * 0.85
  const scale = Math.min(1, maxW / w, maxH / h)
  canvasScale.value = scale
  canvasDisplayW.value = Math.round(w * scale)
  canvasDisplayH.value = Math.round(h * scale)
}

/* ============================================================
   Undo / Redo
   ============================================================ */

/**
 * 儲存目前畫布狀態至 undo stack
 * 批次模式（isBatchMode）期間不儲存，待批次結束後統一儲存
 */
const saveState = () => {
  if (isBatchMode.value) return
  redoStack.value = []
  undoStack.value.push(canvas.toDatalessJSON())
}

/**
 * 從 JSON 快照還原畫布內容
 */
const loadState = async (json) => {
  await canvas.loadFromJSON(json)
  canvas.renderAll()
}

/**
 * 復原上一步：彈出目前狀態至 redo stack，還原前一個快照
 */
const undo = async () => {
  if (undoStack.value.length <= 1) return
  const current = undoStack.value.pop()
  redoStack.value.push(current)
  await loadState(undoStack.value[undoStack.value.length - 1])
}

/**
 * 重做下一步：彈出 redo stack 最新快照並還原
 */
const redo = async () => {
  if (!redoStack.value.length) return
  const json = redoStack.value.pop()
  undoStack.value.push(json)
  await loadState(json)
}

/* ============================================================
   Selection Handlers
   ============================================================ */

/**
 * 選取物件時同步工具列狀態
 * 若為文字框則顯示文字編輯工具列並載入目前樣式
 */
function handleSelection(e) {
  const obj = e.selected[0]
  activeObject.value = obj

  if (obj.type === 'textbox') {
    activeIsText.value = true
    fontSize.value = obj.fontSize
    fontColor.value = obj.fill
    fontFamily.value = obj.fontFamily || 'Arial'
    fontBold.value = obj.fontWeight === 'bold'
    fontItalic.value = obj.fontStyle === 'italic'
    fontUnderline.value = !!obj.underline
  } else {
    activeIsText.value = false
  }
}

/* ============================================================
   Text Style
   ============================================================ */

/**
 * 將工具列目前的文字樣式套用至選取的文字框
 */
function updateTextStyle() {
  const obj = canvas.getActiveObject()
  if (!obj || obj.type !== 'textbox') return
  obj.set({
    fontSize: Number(fontSize.value),
    fill: fontColor.value,
    fontFamily: fontFamily.value,
    fontWeight: fontBold.value ? 'bold' : 'normal',
    fontStyle: fontItalic.value ? 'italic' : 'normal',
    underline: fontUnderline.value,
  })
  fitTextboxToText(obj)
  canvas.renderAll()
}

/**
 * 讓文字框尺寸貼合目前文字內容，並保留固定內距
 */
function fitTextboxToText(textbox) {
  if (!textbox || textbox.type !== 'textbox') return

  const text = textbox.text?.length ? textbox.text : ' '
  const probe = new fabric.Text(text, {
    fontSize: Number(textbox.fontSize) || 24,
    fontFamily: textbox.fontFamily || 'Arial',
    fontWeight: textbox.fontWeight || 'normal',
    fontStyle: textbox.fontStyle || 'normal',
    underline: !!textbox.underline,
  })

  const fittedWidth = Math.max((probe.width || 0) + TEXTBOX_PADDING_PX * 2, TEXTBOX_PADDING_PX * 2 + 1)

  textbox.set({
    width: fittedWidth,
    padding: TEXTBOX_PADDING_PX,
  })
}

/** 切換粗體 */
function toggleBold() {
  fontBold.value = !fontBold.value
  updateTextStyle()
}

/** 切換斜體 */
function toggleItalic() {
  fontItalic.value = !fontItalic.value
  updateTextStyle()
}

/** 切換底線 */
function toggleUnderline() {
  fontUnderline.value = !fontUnderline.value
  updateTextStyle()
}

/* ============================================================
   Add Objects
   ============================================================ */

/**
 * 在指定座標新增可編輯文字框
 */
const addText = (val, x, y) => {
  addObject(new fabric.Textbox(val || '可編輯文字', {
    left: x ?? 80,
    top: y ?? 80,
    fontSize: 24,
    fill: DEFAULT_TEXT_COLOR,
    originX: 'left',
    originY: 'top',
  }))
}

/**
 * 依姓名建立一個可編輯姓名文字框
 */
const generateNameStickers = () => {
  if (!canvas || !frameObject.value) {
    alert('請先上傳姓名貼底圖')
    return
  }

  const name = stickerName.value.trim()

  if (!name) {
    alert('請先輸入姓名')
    return
  }

  const textbox = new fabric.Textbox(name, {
    left: canvas.getWidth() / 2,
    top: canvas.getHeight() / 2,
    width: 1,
    fontSize: Number(fontSize.value),
    fill: DEFAULT_TEXT_COLOR,
    fontFamily: fontFamily.value,
    fontWeight: fontBold.value ? 'bold' : 'normal',
    fontStyle: fontItalic.value ? 'italic' : 'normal',
    underline: fontUnderline.value,
    textAlign: 'center',
    originX: 'center',
    originY: 'center',
    splitByGrapheme: true,
    padding: TEXTBOX_PADDING_PX,
  })

  fitTextboxToText(textbox)
  addObject(textbox)
}

/**
 * 讀取圖片原始寬高，供建立畫布尺寸使用
 */
const getImageSize = (imageUrl) => {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.width, height: image.height })
    image.onerror = reject
    image.src = imageUrl
  })
}

/**
 * 將照片物件固定放在畫框下方，避免蓋過畫框
 */
const placePhotoBelowFrame = (photo) => {
  if (!canvas || !frameObject.value || !photo) return
  const frameIndex = canvas.getObjects().indexOf(frameObject.value)
  canvas.moveObjectTo(photo, Math.max(frameIndex - 1, 0))
}

/**
 * 以上傳圖片建立畫布，並將圖片放在底層作為底圖
 */
const createCanvasFromBackground = async (imageUrl, nextFrameType = 'general') => {
  if (!imageUrl) return

  const frame = await fabric.Image.fromURL(imageUrl, { crossOrigin: 'anonymous' })
  const width = frame.width || 800
  const height = frame.height || 500

  createCanvas(width, height)

  frame.set({
    left: 0,
    top: 0,
    scaleX: 1,
    scaleY: 1,
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false,
  })

  frameObject.value = frame
  frameType.value = nextFrameType
  canvas.add(frame)
  canvas.discardActiveObject()
  canvas.renderAll()
  saveState()
}

/**
 * 新增可編輯照片並放在畫框下方
 */
const addPhotoToCanvas = async (imageUrl) => {
  if (!canvas || !imageUrl) return

  const photo = await fabric.Image.fromURL(imageUrl, { crossOrigin: 'anonymous' })
  const maxWidth = canvas.getWidth() * 0.9
  const maxHeight = canvas.getHeight() * 0.9
  const scale = Math.min(maxWidth / (photo.width || 1), maxHeight / (photo.height || 1), 1)

  photo.set({
    left: Math.max((canvas.getWidth() - (photo.width || 1) * scale) / 2, 0),
    top: Math.max((canvas.getHeight() - (photo.height || 1) * scale) / 2, 0),
    scaleX: scale,
    scaleY: scale,
    objectRole: 'photo',
  })

  addObject(photo)

  if (frameObject.value) {
    placePhotoBelowFrame(photo)
    canvas.renderAll()
  }

  saveState()
}

/**
 * 處理本機圖片上傳，驗證最小尺寸後加入畫布
 */
const uploadFrameImage = (e) => {
  const file = e.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const imageUrl = String(reader.result || '')
      // 驗證最小解析度
      const size = await getImageSize(imageUrl)
      if (size.width < 200 || size.height < 200) {
        alert('檔案解析度差，請上傳至少 200x200px 的圖片')
        e.target.value = ''
        return
      }
      await createCanvasFromBackground(imageUrl, 'general')
      e.target.value = ''
    } catch (err) {
      console.error('Upload frame failed:', err)
      alert('圖片載入失敗，請確認檔案格式')
    }
  }
  reader.readAsDataURL(file)
}

/**
 * 處理姓名貼底圖上傳，匯出 PDF 時會啟用橫向 4 連貼
 */
const uploadNameStickerFrameImage = (e) => {
  const file = e.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const imageUrl = String(reader.result || '')
      const size = await getImageSize(imageUrl)
      if (size.width < 200 || size.height < 200) {
        alert('檔案解析度差，請上傳至少 200x200px 的圖片')
        e.target.value = ''
        return
      }
      await createCanvasFromBackground(imageUrl, 'name-sticker')
      e.target.value = ''
    } catch (err) {
      console.error('Upload name sticker frame failed:', err)
      alert('圖片載入失敗，請確認檔案格式')
    }
  }
  reader.readAsDataURL(file)
}

/**
 * 上傳照片並插入在畫框下方（可移動、縮放、旋轉）
 */
const uploadPhotoImage = (e) => {
  const file = e.target.files[0]
  if (!file) return

  if (!frameObject.value) {
    alert('請先上傳畫框底圖，再上傳照片')
    e.target.value = ''
    return
  }

  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const imageUrl = String(reader.result || '')
      await addPhotoToCanvas(imageUrl)
      e.target.value = ''
    } catch (err) {
      console.error('Upload photo failed:', err)
      alert('照片載入失敗，請確認檔案格式')
    }
  }
  reader.readAsDataURL(file)
}

/* ============================================================
   Z-Index
   ============================================================ */

/** 將選取物件往上移一層 */
const bringForward = () => {
  const obj = canvas.getActiveObject()
  if (!obj) return

  if (frameObject.value && obj === frameObject.value) return

  canvas.moveObjectTo(obj, canvas.getObjects().indexOf(obj) + 1)
  canvas.renderAll()
  saveState()
}

/** 將選取物件往下移一層 */
const sendBackward = () => {
  const obj = canvas.getActiveObject()
  if (!obj) return

  if (frameObject.value && obj === frameObject.value) return

  canvas.moveObjectTo(obj, canvas.getObjects().indexOf(obj) - 1)
  if (obj.objectRole === 'photo') {
    placePhotoBelowFrame(obj)
  }
  canvas.renderAll()
  saveState()
}

/** 複製目前選取物件（支援單一與多選） */
const duplicateSelectedObject = async () => {
  const selectedObjects = canvas?.getActiveObjects?.() || []
  if (!selectedObjects.length) return

  const duplicated = []
  canvas.discardActiveObject()

  for (const source of selectedObjects) {
    const cloned = await source.clone()
    cloned.set({
      left: (cloned.left || 0) + 20,
      top: (cloned.top || 0) + 20,
    })
    applyCustomControls(cloned)
    canvas.add(cloned)
    if (cloned.objectRole === 'photo') {
      placePhotoBelowFrame(cloned)
    }
    duplicated.push(cloned)
  }

  if (duplicated.length === 1) {
    canvas.setActiveObject(duplicated[0])
  } else if (duplicated.length > 1) {
    canvas.setActiveObject(new fabric.ActiveSelection(duplicated, { canvas }))
  }

  canvas.renderAll()
  saveState()
}

/* ============================================================
   Export PDF（自動壓縮 <= 20MB）
   ============================================================ */

/**
 * 依指定 DPI 與 JPEG 品質建立 PDF Blob，供大小判斷與最終下載使用
 */
const buildPdfBlob = async (pageSpec, dpi, imageQuality, exportCopies = 1) => {
  const MM_PER_INCH = 25.4
  const { pageWmm, pageHmm, pdfOrientation, pdfFormat } = pageSpec
  const exportWidth = canvas.getWidth() * exportCopies
  const exportHeight = canvas.getHeight()

  const multiplier = Math.min(
    Math.round((pageWmm / MM_PER_INCH) * dpi) / exportWidth,
    Math.round((pageHmm / MM_PER_INCH) * dpi) / exportHeight,
  )

  const baseImgData = canvas.toDataURL({
    format: 'jpeg',
    quality: imageQuality,
    multiplier,
  })

  const imgData = exportCopies > 1
    ? await buildRepeatedImageData(baseImgData, exportCopies, imageQuality)
    : baseImgData

  const pdf = new jsPDF({
    orientation: pdfOrientation,
    unit: 'mm',
    format: pdfFormat,
  })

  const canvasRatio = exportWidth / exportHeight
  const pageRatio = pageWmm / pageHmm
  let imgW, imgH, offsetX, offsetY

  if (canvasRatio > pageRatio) {
    imgW = pageWmm
    imgH = pageWmm / canvasRatio
    offsetX = 0
    offsetY = (pageHmm - imgH) / 2
  } else {
    imgH = pageHmm
    imgW = pageHmm * canvasRatio
    offsetX = (pageWmm - imgW) / 2
    offsetY = 0
  }

  pdf.addImage(imgData, 'JPEG', offsetX, offsetY, imgW, imgH, undefined, 'MEDIUM')
  return pdf.output('blob')
}

/**
 * 將單一畫布影像橫向重複指定次數，回傳合併後 JPEG data URL
 */
const buildRepeatedImageData = (baseImgData, copies, imageQuality) => {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const composedCanvas = document.createElement('canvas')
      composedCanvas.width = image.width * copies
      composedCanvas.height = image.height
      const ctx = composedCanvas.getContext('2d')

      if (!ctx) {
        reject(new Error('無法建立合成畫布'))
        return
      }

      for (let i = 0; i < copies; i += 1) {
        ctx.drawImage(image, image.width * i, 0)
      }

      resolve(composedCanvas.toDataURL('image/jpeg', imageQuality))
    }
    image.onerror = () => reject(new Error('合成影像失敗'))
    image.src = baseImgData
  })
}

/**
 * 依目前畫布尺寸推算 PDF 頁面尺寸（72 DPI 對應 pt）
 */
const getPageSpecFromCanvas = (widthMultiplier = 1) => {
  const MM_PER_INCH = 25.4
  const PT_PER_INCH = 72
  const pageWmm = ((canvas.getWidth() * widthMultiplier) / PT_PER_INCH) * MM_PER_INCH
  const pageHmm = (canvas.getHeight() / PT_PER_INCH) * MM_PER_INCH

  return {
    pageWmm,
    pageHmm,
    pdfOrientation: pageWmm >= pageHmm ? 'landscape' : 'portrait',
    pdfFormat: [pageWmm, pageHmm],
  }
}

/**
 * 將畫布內容匯出為 PDF，若超過 20MB 會自動降低 DPI 與品質直到符合上限
 */
const exportPDF = async () => {
  if (!canvas) {
    alert('目前沒有可匯出的畫布')
    return
  }

  const exportCopies = frameType.value === 'name-sticker' ? NAME_STICKER_EXPORT_COPIES : 1
  const pageSpec = getPageSpecFromCanvas(exportCopies)

  // 由高到低嘗試參數，優先保留畫質，必要時才進一步壓縮
  const candidates = [
    { dpi: 300, quality: 0.92 },
    { dpi: 260, quality: 0.88 },
    { dpi: 220, quality: 0.84 },
    { dpi: 200, quality: 0.8 },
    { dpi: 180, quality: 0.76 },
    { dpi: 160, quality: 0.72 },
    { dpi: 140, quality: 0.68 },
  ]

  let selectedBlob = null
  for (const candidate of candidates) {
    const blob = await buildPdfBlob(pageSpec, candidate.dpi, candidate.quality, exportCopies)
    selectedBlob = blob
    if (blob.size <= MAX_PDF_SIZE_BYTES) {
      break
    }
  }

  if (!selectedBlob) {
    alert('匯出失敗，請稍後再試')
    return
  }

  const filename = `canvas-${canvas.getWidth()}x${canvas.getHeight()}.pdf`
  const file = new File([selectedBlob], filename, { type: 'application/pdf' })
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)

  if (selectedBlob.size > MAX_PDF_SIZE_BYTES) {
    alert('內容過於複雜，已壓縮到最低品質但仍可能超過 20MB')
  }
}

/* ============================================================
   Add Object Helper
   ============================================================ */

/**
 * 套用自訂控制項後將物件加入畫布，並儲存 undo 快照
 */
const addObject = (obj) => {
  applyCustomControls(obj)
  canvas.add(obj)
  if (obj.objectRole === 'photo') {
    placePhotoBelowFrame(obj)
  }
  canvas.setActiveObject(obj)
  canvas.renderAll()
  saveState()
}

/* ============================================================
  Create Canvas
  ============================================================ */

/**
 * 初始化 Fabric Canvas
 * dispose 舊實例後以新尺寸建立，並重新綁定事件
 */
function createCanvas(width, height) {
  canvas?.dispose()
  frameObject.value = null
  updateCanvasScale(width, height)

  canvas = new fabric.Canvas(canvasEl.value, {
    backgroundColor: '#fff',
    width,
    height,
    preserveObjectStacking: true,
  })

  bindCanvasEvents()
  saveState()
}

/* ============================================================
   Canvas Events
   ============================================================ */

/**
 * 綁定畫布事件：選取、取消選取、物件修改
 */
function bindCanvasEvents() {
  canvas.on('selection:created', handleSelection)
  canvas.on('selection:updated', handleSelection)
  canvas.on('selection:cleared', () => {
    activeObject.value = null
    activeIsText.value = false
  })
  canvas.on('object:modified', () => saveState())
  canvas.on('text:changed', (event) => {
    const target = event?.target
    if (!target || target.type !== 'textbox') return
    fitTextboxToText(target)
    canvas.requestRenderAll()
  })
}

/* ============================================================
   Custom Controls
   ============================================================ */

/**
 * 為物件套用自訂樣式與操作控制點
 * - 右上：刪除按鈕
 * - 左下：旋轉控制點
 * - 右下：縮放控制點（Fabric 預設保留）
 */
function applyCustomControls(obj) {
  const ICON_SIZE = 32

  obj.set({
    cornerColor: '#fff',
    cornerStrokeColor: '#24303b',
    borderColor: '#24303b',
    borderDashArray: [6, 6],
    transparentCorners: false,
    padding: 14,
    centeredScaling: true,
  })

  obj.setControlsVisibility({
    mt: false, mb: false, ml: false, mr: false,
    tl: false, tr: false, bl: false,
    br: true,   // 縮放
    mtr: false, // 隱藏預設旋轉點
  })

  // 右上：刪除
  obj.controls.deleteControl = new fabric.Control({
    x: 0.5, y: -0.5,
    cursorStyle: 'pointer',
    cornerSize: 28,
    mouseUpHandler: (_, transform) => {
      const target = transform?.target
      if (target) {
        canvas.remove(target)
        canvas.requestRenderAll()
        saveState()
      }
    },
    render: (ctx, left, top) =>
      ctx.drawImage(iconDelete, left - ICON_SIZE / 2, top - ICON_SIZE / 2, ICON_SIZE, ICON_SIZE),
  })

  // 左下：旋轉
  obj.controls.scaleRotate = new fabric.Control({
    x: -0.5, y: 0.5,
    cornerSize: 28,
    actionHandler: fabric.controlsUtils.rotationWithSnapping,
    cursorStyleHandler: fabric.controlsUtils.rotationStyleHandler,
    actionName: 'rotate',
    render: (ctx, left, top) =>
      ctx.drawImage(iconScale, left - ICON_SIZE / 2, top - ICON_SIZE / 2, ICON_SIZE, ICON_SIZE),
  })
}

/* ============================================================
   Lifecycle
   ============================================================ */
onMounted(() => {
  // 先建立預設空白畫布，後續可由上傳底圖重建為圖片尺寸
  createCanvas(800, 500)

  // 視窗 resize 時重新計算顯示縮放
  const onResize = () => {
    if (canvas) updateCanvasScale(canvas.getWidth(), canvas.getHeight())
  }
  window.addEventListener('resize', onResize)
  onUnmounted(() => window.removeEventListener('resize', onResize))
})
</script>
