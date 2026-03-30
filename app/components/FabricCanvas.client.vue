<template>
  <div class="p-6 space-y-4">
    <!-- Canvas -->
    <canvas
      ref="canvasEl"
      width="800"
      height="500"
      class="border border-gray-300 rounded"
    ></canvas>

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

    <!-- Buttons -->
    <div class="space-x-3" v-if="loaded">
      <button
        @click="addRect"
        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        新增方塊
      </button>

      <button
        @click="addText"
        class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        新增文字
      </button>

      <button
        @click="exportPDF"
        class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        匯出 PDF
      </button>

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

    <div v-else class="text-gray-500">Fabric.js 載入中...</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import jsPDF from 'jspdf'
import { Canvas, Rect, Textbox } from 'fabric'

const canvasEl = ref(null)
let canvas = null

const loaded = ref(false)
const activeIsText = ref(false)
const activeObject = ref(null)

const fontSize = ref(28)
const fontColor = ref('#222222')

onMounted(() => {
  canvas = new Canvas(canvasEl.value, {
    backgroundColor: '#ffffff',
    selection: true,
    preserveObjectStacking: true,
  })

  // ✅ 當選取變化時更新 activeObject
  canvas.on('selection:created', handleSelection)
  canvas.on('selection:updated', handleSelection)
  canvas.on('selection:cleared', () => {
    activeObject.value = null
    activeIsText.value = false
  })

  loaded.value = true
})

function handleSelection(e) {
  const obj = e.selected[0]
  activeObject.value = obj

  if (obj.type === 'textbox') {
    activeIsText.value = true
    fontSize.value = obj.fontSize
    fontColor.value = obj.fill
  } else {
    activeIsText.value = false
  }
}

// ✅ 更新文字樣式
function updateTextStyle() {
  const obj = canvas.getActiveObject()
  if (!obj || obj.type !== 'textbox') return

  obj.set({
    fontSize: Number(fontSize.value),
    fill: fontColor.value,
  })

  canvas.renderAll()
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

  canvas.add(rect)
  canvas.setActiveObject(rect)
  activeObject.value = rect
  canvas.renderAll()
}

// ✅ 新增文字
const addText = () => {
  const text = new Textbox('可編輯文字', {
    left: 200,
    top: 200,
    fontSize: 28,
    fill: '#222',
    width: 300,
  })

  canvas.add(text)
  canvas.setActiveObject(text)
  activeObject.value = text
  canvas.renderAll()
}

// ✅ Z-INDEX：往上
const bringForward = () => {
  
const obj = canvas.getActiveObject()
  if (!obj) return

  const objects = canvas._objects
  const index = objects.indexOf(obj)

  if (index < objects.length - 1) {
    // 交換位置
    objects[index] = objects[index + 1]
    objects[index + 1] = obj
    canvas.renderAll()
  }

}

// ✅ Z-INDEX：往下

const sendBackward = () => {
  const obj = canvas.getActiveObject()
  if (!obj) return

  const objects = canvas._objects
  const index = objects.indexOf(obj)

  if (index > 0) {
    // 交換位置
    objects[index] = objects[index - 1]
    objects[index - 1] = obj
    canvas.renderAll()
  }
}


// ✅ 匯出 PDF（保持原本邏輯）
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

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight)
  pdf.save('canvas-output.pdf')
}
</script>
