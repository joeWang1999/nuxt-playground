<template>
  <div class="p-6 space-y-4">
    <div class="flex flex-row">
      <canvas
        ref="canvasEl"
        width="800"
        height="500"
        class="border border-gray-300 rounded"
      ></canvas>
      <div class="flex flex-col gap-8 mb-4">
        <div class="flex gap-4 mb-4">
          <button
            @click="createCanvas(800, 600)"
            class="px-4 py-2 bg-gray-700 text-white rounded"
          >
            建立 800 x 600
          </button>

          <button
            @click="createCanvas(800, 800)"
            class="px-4 py-2 bg-gray-700 text-white rounded"
          >
            建立 800 x 800
          </button>
        </div>

        <!-- Buttons -->
        <div class="flex flex-col gap-4" v-if="true">
          <input
            type="file"
            accept="image/*"
            @change="uploadImage"
            class="px-4 py-2 border rounded"
          />

          <button
            @click="addRect"
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            新增方塊
          </button>

          <button
            @click="addText('可編輯文字', 200, 200)"
            class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            新增文字
          </button>
          <button
            @click="add16Text(150, 50, 24, 24, '王小明', 4, 4)"
            class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            新增16文字
          </button>
          <button
            @click="updateAllTextboxes()"
            class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            更新所有文字框
          </button>
          <button
            @click="exportPDF"
            class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            匯出 PDF
          </button>

          <div class="flex gap-3">
            <button
              @click="undo"
              class="px-3 py-2 bg-gray-500 text-white rounded"
              :disabled="undoStack.length === 0"
            >
              上一步
            </button>
            <button
              @click="redo"
              class="px-3 py-2 bg-gray-500 text-white rounded"
              :disabled="redoStack.length === 0"
            >
              下一步
            </button>
          </div>
        </div>

        <div v-else class="text-gray-500">Fabric.js 載入中...</div>
      </div>
    </div>

    <!-- Canvas -->

    <!-- 文字編輯工具列 -->
    <div
      v-if="activeIsText"
      class="flex items-center gap-4 p-3 bg-gray-100 rounded"
    >
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
    </div>
    <!-- Z-index 按鈕 -->
    <div class="space-x-3" v-if="activeObject">
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
import { ref, onMounted } from 'vue'
import jsPDF from 'jspdf'
import * as fabric from 'fabric' // ✅ Fabric 6 正確用法

/* --------------------------------------------------
   Reactive State
-------------------------------------------------- */
const canvasEl = ref(null)
let canvas = null

const loaded = ref(false)
const activeIsText = ref(false)
const activeObject = ref(null)

const fontSize = ref(28)
const fontColor = ref('#222222')
const lastMoveDelta = ref({ dx: 0, dy: 0 })
let lastPosition = null

const undoStack = ref([])
const redoStack = ref([])
const isBatchMode = ref(false)

/* --------------------------------------------------
   Undo / Redo Logic
-------------------------------------------------- */

const saveState = () => {
  if (isBatchMode.value) return
  redoStack.value = []

  const json = canvas.toDatalessJSON()
  undoStack.value.push(json)
}

const loadState = async (json) => {
  await canvas.loadFromJSON(json)
  canvas.renderAll()
}

const undo = async () => {
  if (undoStack.value.length <= 1) return

  const current = undoStack.value.pop()
  redoStack.value.push(current)

  const prev = undoStack.value[undoStack.value.length - 1]
  await loadState(prev)
}

const redo = async () => {
  if (!redoStack.value.length) return

  const json = redoStack.value.pop()
  undoStack.value.push(json)

  await loadState(json)
}

/* --------------------------------------------------
   Selection
-------------------------------------------------- */
function handleSelection(e) {
  const obj = e.selected[0]
  activeObject.value = obj

  if (obj.type === 'textbox') {
    activeIsText.value = true
    fontSize.value = obj.fontSize
    fontColor.value = obj.fill
    lastPosition = { left: obj.left, top: obj.top }
  } else {
    activeIsText.value = false
  }
}

/* --------------------------------------------------
   Update Text Style
-------------------------------------------------- */
function updateTextStyle() {
  const obj = canvas.getActiveObject()
  if (!obj || obj.type !== 'textbox') return

  obj.set({
    fontSize: Number(fontSize.value),
    fill: fontColor.value,
  })
  canvas.renderAll()
}

/* --------------------------------------------------
   Add Shape / Text / Image
-------------------------------------------------- */
const addRect = () => {
  const rect = new fabric.Rect({
    width: 140,
    height: 140,
    fill: 'skyblue',
    left: 120,
    top: 120,
    rx: 12,
    ry: 12,
  })
  addObject(rect)
}

const uploadImage = (e) => {
  const file = e.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    fabric.Image.fromURL(reader.result, (img) => {
      img.set({
        left: 150,
        top: 100,
        scaleX: 0.5,
        scaleY: 0.5,
      })

      addObject(img)
    })
  }
  reader.readAsDataURL(file)
}

const addText = (val, x, y) => {
  const text = new fabric.Textbox(val || '可編輯文字', {
    left: x || 200,
    top: y || 200,
    fontSize: 28,
    fill: '#222222',
    originX: 'left',
    originY: 'top',
  })
  addObject(text)
}

const add16Text = (pw, ph, x, y, val, xa, ya) => {
  isBatchMode.value = true
  for (let i = 0; i < xa; i++) {
    for (let j = 0; j < ya; j++) {
      addText(val || '王小明', x + i * pw, y + j * ph)
    }
  }
  isBatchMode.value = false
  saveState()
}

/* --------------------------------------------------
   Update All Textboxes
-------------------------------------------------- */
const updateAllTextboxes = () => {
  isBatchMode.value = true
  const activeObj = canvas.getActiveObject()
  const textboxes = canvas.getObjects('textbox')
  const { dx, dy } = lastMoveDelta.value

  textboxes.forEach((tb) => {
    if (tb === activeObj) return
    tb.set({
      fontSize: fontSize.value,
      fill: fontColor.value,
      left: tb.left + dx,
      top: tb.top + dy,
    })
  })
  canvas.renderAll()

  isBatchMode.value = false
  saveState()
}

/* --------------------------------------------------
   Z-Index
-------------------------------------------------- */

const bringForward = () => {
  const obj = canvas.getActiveObject()
  if (!obj) return
  const objects = canvas.getObjects()
  const index = objects.indexOf(obj)

  canvas.moveObjectTo(obj, index + 1)
  canvas.renderAll()
  saveState()
}

const sendBackward = () => {
  const obj = canvas.getActiveObject()
  if (!obj) return
  const objects = canvas.getObjects()
  const index = objects.indexOf(obj)

  canvas.moveObjectTo(obj, index - 1)
  canvas.renderAll()
  saveState()
}

/* --------------------------------------------------
   Export PDF
-------------------------------------------------- */
const exportPDF = () => {
  const imgData = canvas.toDataURL({
    format: 'png',
    multiplier: 2,
  })

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: 'a4',
  })

  const w = pdf.internal.pageSize.getWidth()
  const h = pdf.internal.pageSize.getHeight()
  pdf.addImage(imgData, 'PNG', 0, 0, w, h)
  pdf.save('canvas-output.pdf')
}

/* --------------------------------------------------
   Add Object Helper
-------------------------------------------------- */
const addObject = (obj) => {
  


  applyCustomControls(obj)
  canvas.add(obj)
  canvas.setActiveObject(obj)
  canvas.renderAll()
  saveState()
}

/* --------------------------------------------------
   Create / Replace Canvas
-------------------------------------------------- */
function createCanvas(width, height) {
  if (canvas) {
    canvas.dispose()
  }

  canvas = new fabric.Canvas(canvasEl.value, {
    backgroundColor: '#fff',
    width,
    height,
    preserveObjectStacking: true,
  })

  bindCanvasEvents()

  saveState()
}

/* --------------------------------------------------
   Canvas Events
-------------------------------------------------- */
function bindCanvasEvents() {
  canvas.on('selection:created', handleSelection)
  canvas.on('selection:updated', handleSelection)
  canvas.on('selection:cleared', () => {
    activeObject.value = null
    activeIsText.value = false
  })

  canvas.on('object:modified', (e) => {
    const obj = e.target
    if (obj?.type === 'textbox') {
      const dx = obj.left - lastPosition.left
      const dy = obj.top - lastPosition.top
      lastMoveDelta.value = { dx, dy }
      lastPosition = { left: obj.left, top: obj.top }
    }
    saveState()
  })
}
/* --------------------------------------------------
   Custom Control Point
-------------------------------------------------- */

const iconEdit = new Image()
iconEdit.src = '/icons/edit.svg' // 你準備的編輯 icon

const iconDelete = new Image()
iconDelete.src = '/icons/delete.svg' // 你準備的刪除 icon

const iconScale = new Image()
iconScale.src = '/icons/scale.svg' // 你準備的縮放 icon

function applyCustomControls(obj) {
  const size = 32 // icon 顯示大小
  obj.set({
  borderColor: '#0078C8',         // 控制框外框線顏色
  borderDashArray: [4, 4],     // 虛線
  cornerStrokeColor: '#0078C8',   // 控制點框線顏色（可選）
  cornerColor:'#0078c8',
  cornerSize:8
});
  /* ------------ 左上角：編輯 ------------ */
  obj.controls.editControl = new fabric.Control({
    x: -0.5,
    y: -0.5,
    offsetX: 0,
    offsetY: 0,
    cursorStyle: 'pointer',
    mouseUpHandler: () => {
      console.log('Edit clicked!')
      alert('✅ 你點了編輯按鈕')
    },
    render: (ctx, left, top) => {
      ctx.drawImage(iconEdit, left - size / 2, top - size / 2, size, size)
    },
  })

  /* ------------ 右上角：刪除 ------------ */
  obj.controls.deleteControl = new fabric.Control({
    x: 0.5,
    y: -0.5,
    offsetX: 0,
    offsetY: 0,
    cursorStyle: 'pointer',

    mouseUpHandler: (eventData, transform) => {
      const target = transform?.target // ✅ 正確抓到物件
      if (target) {
        canvas.remove(target)
        canvas.requestRenderAll()
      }
    },
    render: (ctx, left, top) => {
      ctx.drawImage(iconDelete, left - size / 2, top - size / 2, size, size)
    },
  })

  /* ------------ 右下角：縮放+旋轉 ------------ */

// obj.controls.scaleRotate = new fabric.Control({
//   x: 0.5,
//   y: 0.5,
//   offsetX: 20,
//   offsetY: 20,
//   cursorStyle: "grab",

//   mouseDownHandler: (eventData, transform) => {
//     const canvas = transform.target.canvas
//     const obj = transform.target

//     const pointer = canvas.getPointer(eventData)

//     // 物件中心
//     const cx = obj.left + obj.getScaledWidth() / 2
//     const cy = obj.top + obj.getScaledHeight() / 2

//     const dx = pointer.x - cx
//     const dy = pointer.y - cy

//     // 記錄初始角度
//     transform.initialPointerAngle = Math.atan2(dy, dx) * 180 / Math.PI
//     transform.initialObjectAngle = obj.angle

//     // 記錄初始半徑（滑鼠距離）
//     transform.initialRadius = Math.sqrt(dx * dx + dy * dy)

//     // 記錄原始寬高（未縮放）
//     transform.originalWidth = obj.width
//     transform.originalHeight = obj.height

//     return true
//   },

//   actionHandler: (eventData, transform, x, y) => {
//     const obj = transform.target
//     const canvas = obj.canvas

//     const pointer = canvas.getPointer(eventData)

//     // ✅ 物件中心（旋轉 + 尺寸調整都用它）
//     const cx = obj.left + obj.getScaledWidth() / 2
//     const cy = obj.top + obj.getScaledHeight() / 2

//     const dx = pointer.x - cx
//     const dy = pointer.y - cy

//     const currentAngle = Math.atan2(dy, dx) * 180 / Math.PI

//     // ✅ 旋轉角度 = 起始角度 + 角度差
//     const deltaAngle = currentAngle - transform.initialPointerAngle
//     obj.rotate(transform.initialObjectAngle + deltaAngle)

//     // ✅ 縮放（完全跟著滑鼠）
//     // 現在滑鼠到中心的距離
//     const currentRadius = Math.sqrt(dx * dx + dy * dy)

//     // 距離比例 = 新半徑 / 舊半徑
//     const ratio = currentRadius / transform.initialRadius

//     // ✅ 新尺寸（不使用 scaleX/scaleY，直接計算寬高 → 控制點完全貼著滑鼠）
//     const newWidth = transform.originalWidth * ratio
//     const newHeight = transform.originalHeight * ratio

//     obj.set({
//       scaleX: newWidth / obj.width,
//       scaleY: newHeight / obj.height
//     })

//     obj.setCoords()
//     canvas.requestRenderAll()

//     return true
//   },

//   actionName: "scaleRotate",

//   render: (ctx, left, top) => {
//     ctx.drawImage(iconScale, left - 16, top - 16, 32, 32)
//   }
// })

}

/* --------------------------------------------------
   Initialize Canvas
-------------------------------------------------- */
onMounted(() => {

  // ✅ 外框線改成藍色虛線
  fabric.Object.prototype.borderColor = "#1e90ff"
  fabric.Object.prototype.borderDashArray = [6, 4]

  // ✅ 預設控制點（corner）外觀先設定透明，後面我們要改成空心圓
  fabric.Object.prototype.cornerColor = "transparent"
  fabric.Object.prototype.cornerStyle = "circle"
  fabric.Object.prototype.cornerSize = 14  // 控制點半徑
  fabric.Object.prototype.transparentCorners = false


  canvas = new fabric.Canvas(canvasEl.value, {
    backgroundColor: '#ffffff',
    selection: true,
    preserveObjectStacking: true,
  })

  bindCanvasEvents()
  saveState()

  loaded.value = true
})
</script>
