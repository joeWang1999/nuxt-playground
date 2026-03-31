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
        <div class="flex flex-col gap-4" v-if="canvas">
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
import { Canvas, Rect, Textbox, FabricImage } from 'fabric'

const canvasEl = ref(null)
let canvas = ref(null)

const loaded = ref(false)
const activeIsText = ref(false)
const activeObject = ref(null)

const fontSize = ref(28)
const fontColor = ref('#222222')
const lastMoveDelta = ref({ dx: 0, dy: 0 })
let lastPosition = null

const undoStack = ref([])
const redoStack = ref([])
const isBatchMode = ref(false) // 用於批次操作的旗標

const saveState = (where) => {
  console.log(isBatchMode.value, where)
  if (isBatchMode.value) return
  redoStack.value.length = 0 // 清空 redo（因為產生新的操作）
  const json = canvas.value.toJSON()
  undoStack.value.push(json)
  console.log(undoStack.value)
}

const undo = async () => {
  if (undoStack.value.length <= 1) return //保留初始化步驟
  redoStack.value.push(undoStack.value.pop()) // 取出目前狀態放到 redo
  const prev = undoStack.value[undoStack.value.length - 1] // 上一個狀態
  await canvas.value.loadFromJSON(prev)
  await canvas.value.renderAll()
}

const redo = async () => {
  if (redoStack.value.length === 0) return
  await canvas.value.loadFromJSON(redoStack.value[redoStack.value.length - 1]) //canvas設定成ref
  undoStack.value.push(redoStack.value.pop())
  canvas.value.renderAll()
  console.log(undoStack.value)
  console.log(redoStack.value)
}

function handleSelection(e) {
  const obj = e.selected[0]
  activeObject.value = obj
console.log(obj)
  if (obj.type === 'textbox') {
    console.log(123)
    activeIsText.value = true
    fontSize.value = obj.fontSize
    fontColor.value = obj.fill
    lastPosition = { left: obj.left, top: obj.top }
  } else {
    activeIsText.value = false
  }
}

// ✅ 更新文字樣式
function updateTextStyle() {
  const obj = canvas.value.getActiveObject()
  if (!obj || obj.type !== 'textbox') return

  obj.set({
    fontSize: Number(fontSize.value),
    fill: fontColor.value,
  })

  canvas.value.renderAll()
}

// ✅ 新增方塊
const addRect = () => {
  const rect = new Rect({
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
    const imgEl = new Image()
    imgEl.src = reader.result
    imgEl.onload = () => {
      const img = new FabricImage(imgEl, {
        left: 150,
        top: 100,
        scaleX: 0.5,
        scaleY: 0.5,
      })

      img.setControlsVisibility({
        mt: true,
        mb: true,
        ml: true,
        mr: true,
        bl: true,
        br: true,
        tl: true,
        tr: true,
        mtr: true,
      })

      addObject(img)
    }
  }

  reader.readAsDataURL(file)
}

// ✅ 新增文字
const addText = (textValue, xValue, yValue) => {
  const text = new Textbox(textValue || '可編輯文字', {
    left: xValue || 200,
    top: yValue || 200,
    fontSize: 28,
    fill: '#222222',
    originX: 'left',
    originY: 'top',
  })
  addObject(text)
}
const add16Text = (
  pictureWidth,
  pictureHeight,
  textX,
  textY,
  textValue,
  xAmount,
  yAmount,
) => {
  isBatchMode.value = true
  for (let i = 0; i < xAmount; i++) {
    for (let j = 0; j < yAmount; j++) {
      addText(
        textValue || '王小明',
        textX + i * pictureWidth,
        textY + j * pictureHeight,
      )
    }
  }
  isBatchMode.value = false
  saveState('add16Text')
}

const updateAllTextboxes = () => {
  isBatchMode.value = true
  const textboxes = canvas.value
    .getObjects()
    .filter((obj) => obj.type === 'textbox')
  const { dx, dy } = lastMoveDelta.value

  const activeObj = canvas.value.getActiveObject()

  textboxes.forEach((tb) => {
    if (tb === activeObj) return
    tb.set({
      fontSize: fontSize.value,
      fill: fontColor.value,
      left: tb.left + dx,
      top: tb.top + dy,
    })
  })
  canvas.value.renderAll()
  isBatchMode.value = false
  saveState('updateAllTextboxes')
}

// ✅ Z-INDEX：往上
const bringForward = () => {
  const obj = canvas.value.getActiveObject()
  if (!obj) return

  const objects = canvas.value._objects
  const index = objects.indexOf(obj)

  if (index < objects.length - 1) {
    // 交換位置
    objects[index] = objects[index + 1]
    objects[index + 1] = obj
    canvas.value.renderAll()
  }
}

// ✅ Z-INDEX：往下

const sendBackward = () => {
  const obj = canvas.value.getActiveObject()
  if (!obj) return

  const objects = canvas.value._objects
  const index = objects.indexOf(obj)

  if (index > 0) {
    // 交換位置
    objects[index] = objects[index - 1]
    objects[index - 1] = obj
    canvas.value.renderAll()
  }
}

// ✅ 匯出 PDF（保持原本邏輯）
const exportPDF = () => {
  const imgData = canvas.value.toDataURL({
    format: 'png',
    multiplier: 2,
  })

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: 'a4',
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight)
  pdf.save('canvas-output.pdf')
}

const addObject = (obj) => {
  canvas.value.add(obj)
  canvas.value.setActiveObject(obj)
  activeObject.value = obj
  canvas.value.renderAll()

  saveState() // ✅ 在這裡安全地紀錄一次
}

// ✅ 建立或重建 Canvas
function createCanvas(width, height) {
  // 如果有舊 canvas → 先安全銷毀
  if (canvas.value) {
    canvas.value.dispose()
    canvas.value = null
  }

  // ✅ 建立新 canvas
  canvas.value = new Canvas(canvasEl.value, {
    backgroundColor: '#ffffff',
    width,
    height,
    preserveObjectStacking: true,
  })

  // ✅ 如果你有 resizeCanvas，可在這裡呼叫
  // resizeCanvas()

  console.log('✅ Canvas 建立成功：', width, height)
}

onMounted(() => {
    canvas.value = new Canvas(canvasEl.value, {
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true,
    })
  
  // ✅ 當選取變化時更新 activeObject
  canvas.value.on('selection:created', handleSelection)
  canvas.value.on('selection:updated', handleSelection)
  canvas.value.on('selection:cleared', () => {
    activeObject.value = null
    activeIsText.value = false
  })
  canvas.value.on('object:added', saveState('object:added'))
  canvas.value.on('object:modified', (e) => {
    console.log('modified')
    const obj = e.target
    if (obj?.type === 'textbox') {
      const dx = obj.left - lastPosition.left
      const dy = obj.top - lastPosition.top

      // ✅ 記錄移動量
      lastMoveDelta.value = { dx, dy }

      console.log('移動量：', dx, dy)

      // 更新最新位置
      lastPosition = { left: obj.left, top: obj.top }
    }
    saveState('object:modified')
  })
  loaded.value = true
})
</script>
