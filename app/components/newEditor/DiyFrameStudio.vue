<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  Bold,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  Image as ImageIcon,
  Italic,
  Layers,
  LayoutTemplate,
  Lock,
  Minus,
  MoreHorizontal,
  Move,
  Plus,
  Redo,
  RotateCw,
  Search,
  Strikethrough,
  Trash2,
  Type,
  Underline,
  Undo,
  Upload,
  X,
} from 'lucide-vue-next'

const activeTab = ref('icons')
const showPreviewModal = ref(false)
const showMoreMenu = ref(false)
const moreMenuMode = ref('main') // 'main' or 'align'

// Multi-selection state
const selectedIds = ref([])

// Name sticker input state
const nameStickerText = ref('王小明')
const frameSearch = ref('')
const iconSearch = ref('')

const interactionMode = ref(null) // 'move', 'rotate', 'resize', 'marquee'
const dragOffset = ref({
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  rotation: 0,
  fontSize: 0,
  startPositions: {},
})
const selectionBox = ref(null)
const snapLines = ref([])
const dragOverId = ref(null)
const zoom = ref(1)

const workspaceRef = ref(null)
const fileInputRef = ref(null)
const selectedInputRef = ref(null)

const mockFrames = [
  { id: 1, name: '卡娜赫拉-蜂蜜', src: '20250117_151653_00771.png', aspect: '3/2' },
  { id: 2, name: '卡娜赫拉-衝浪(橫)', src: '20250311_085322_52292.png', aspect: '3/2' },
  { id: 3, name: '卡娜赫拉-衝浪(直)', src: '20250311_090414_47521.png', aspect: '2/3' },
]

const selectedFrame = ref(mockFrames[0])
const bgImage = ref('https://images.unsplash.com/photo-1531642765602-5cae8bbbf285?auto=format&fit=crop&w=800&q=80')
const uploads = ref([
  'https://images.unsplash.com/photo-1531642765602-5cae8bbbf285?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1506869640319-fea1a2753852?auto=format&fit=crop&w=300&q=80',
])

const elements = ref([
  { id: 't3', type: 'text', content: 'ONLY', x: 260, y: 260, fontSize: 44, color: '#f97316', fontWeight: 'bold', rotation: 0 },
  { id: 't2', type: 'text', content: 'VIBES', x: 240, y: 210, fontSize: 44, color: '#f59e0b', fontWeight: 'bold', rotation: 0 },
  { id: 't1', type: 'text', content: 'GOOD', x: 245, y: 160, fontSize: 44, color: '#ec4899', fontWeight: 'bold', rotation: 0 },
])

const mockGalleryImages = [
  { id: 'g1', name: '橘貓日常', src: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=150&q=80' },
  { id: 'g2', name: '黃金獵犬', src: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=150&q=80' },
  { id: 'g3', name: '派驚喜氣球', src: 'https://images.unsplash.com/photo-1530103862676-de8892bc952f?auto=format&fit=crop&w=150&q=80' },
  { id: 'g4', name: '生日蛋糕', src: 'https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec?auto=format&fit=crop&w=150&q=80' },
  { id: 'g5', name: '閃亮星星', src: 'https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?auto=format&fit=crop&w=150&q=80' },
  { id: 'g6', name: '驚喜禮物', src: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=150&q=80' },
]

const localUploadUrls = []

const sidebarItems = [
  { id: 'frames', icon: LayoutTemplate, label: '圖框樣式' },
  { id: 'uploads', icon: Upload, label: '照片上傳' },
  { id: 'text', icon: Type, label: '新增文字' },
  { divider: true },
  { id: 'icons', icon: ImageIcon, label: '圖像庫' },
  { id: 'layers', icon: Layers, label: '圖層' },
]

const activePanelTitle = computed(() => {
  if (activeTab.value === 'layers') return '圖層'
  if (activeTab.value === 'icons') return '圖像庫'
  if (activeTab.value === 'text') return '新增文字'
  if (activeTab.value === 'frames') return '圖框樣式'
  return '照片上傳'
})

const textElements = computed(() => elements.value.filter((el) => el.type === 'text'))
const reversedElements = computed(() => [...elements.value].reverse())
const filteredFrames = computed(() => mockFrames.filter((f) => f.name.includes(frameSearch.value)))
const filteredGalleryImages = computed(() => mockGalleryImages.filter((i) => i.name.includes(iconSearch.value)))

const workspaceClass = computed(() =>
  selectedFrame.value.aspect === '2/3'
    ? 'aspect-[2/3] max-w-[450px]'
    : 'aspect-[3/2] max-w-[800px]',
)
const previewWorkspaceClass = computed(() =>
  selectedFrame.value.aspect === '2/3'
    ? 'aspect-[2/3] w-full max-w-[400px]'
    : 'aspect-[3/2] w-full max-w-[650px]',
)

// Group bounding box
const groupBBox = computed(() => {
  if (selectedIds.value.length === 0) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  selectedIds.value.forEach((id) => {
    const el = elements.value.find((e) => e.id === id)
    if (!el) return
    const domNode = document.getElementById(`element-${id}`)
    const w = domNode ? domNode.offsetWidth : (el.width || 100)
    const h = domNode ? domNode.offsetHeight : (el.height || 100)
    if (el.x < minX) minX = el.x
    if (el.y < minY) minY = el.y
    if (el.x + w > maxX) maxX = el.x + w
    if (el.y + h > maxY) maxY = el.y + h
  })
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
})

const firstSelectedText = computed(() =>
  elements.value.find((el) => selectedIds.value.includes(el.id) && el.type === 'text') ?? null,
)

const showTextToolbar = computed(() => selectedIds.value.length > 0 && !!firstSelectedText.value)

watch([selectedIds, activeTab], async ([currentSelectedIds, currentActiveTab]) => {
  if (currentActiveTab === 'text' && currentSelectedIds.length === 1 && selectedInputRef.value) {
    await nextTick()
    selectedInputRef.value?.focus()
  }
}, { deep: true })

onBeforeUnmount(() => {
  localUploadUrls.forEach((url) => URL.revokeObjectURL(url))
})

function setSidebarTab(id) {
  activeTab.value = id
}

function updateElement(id, newProps) {
  elements.value = elements.value.map((el) => (el.id === id ? { ...el, ...newProps } : el))
}

function handleFileUpload(event) {
  const [file] = event.target.files ?? []
  if (!file) return
  const url = URL.createObjectURL(file)
  localUploadUrls.push(url)
  bgImage.value = url
  uploads.value = [url, ...uploads.value]
  event.target.value = ''
}

// Canvas click (marquee start or deselect)
function handleCanvasMouseDown(event) {
  if (event.target === workspaceRef.value || event.target.tagName === 'IMG') {
    const rect = workspaceRef.value.getBoundingClientRect()
    const startX = (event.clientX - rect.left) / zoom.value
    const startY = (event.clientY - rect.top) / zoom.value
    interactionMode.value = 'marquee'
    selectionBox.value = { startX, startY, endX: startX, endY: startY }

    if (!event.shiftKey) selectedIds.value = []
    showMoreMenu.value = false
    moreMenuMode.value = 'main'
  }
}

// Element click (drag or Shift multi-select)
function handleMouseDown(event, id) {
  event.stopPropagation()

  let newSelectedIds = [...selectedIds.value]
  if (event.shiftKey) {
    if (newSelectedIds.includes(id)) newSelectedIds = newSelectedIds.filter((i) => i !== id)
    else newSelectedIds.push(id)
  } else {
    if (!newSelectedIds.includes(id)) newSelectedIds = [id]
  }

  selectedIds.value = newSelectedIds
  showMoreMenu.value = false
  moreMenuMode.value = 'main'

  if (newSelectedIds.length === 1) {
    const el = elements.value.find((e) => e.id === newSelectedIds[0])
    if (el && el.type === 'text') activeTab.value = 'text'
  }

  const startPositions = {}
  elements.value.forEach((el) => {
    if (newSelectedIds.includes(el.id)) {
      startPositions[el.id] = { x: el.x, y: el.y }
    }
  })

  const targetRect = event.currentTarget.getBoundingClientRect()
  dragOffset.value = {
    x: event.clientX,
    y: event.clientY,
    startPositions,
    width: targetRect.width / zoom.value,
    height: targetRect.height / zoom.value,
  }
  interactionMode.value = 'move'
}

function handleRotateStart(event, id) {
  event.stopPropagation()
  const el = elements.value.find((item) => item.id === id)
  const workspace = workspaceRef.value
  if (!el || !workspace) return

  const rect = workspace.getBoundingClientRect()
  const screenCenterX = rect.left + (el.x + dragOffset.value.width / 2) * zoom.value
  const screenCenterY = rect.top + (el.y + dragOffset.value.height / 2) * zoom.value

  dragOffset.value = {
    ...dragOffset.value,
    centerX: screenCenterX,
    centerY: screenCenterY,
    startAngle: Math.atan2(event.clientY - screenCenterY, event.clientX - screenCenterX),
    startRotation: el.rotation || 0,
  }
  interactionMode.value = 'rotate'
}

function handleResizeStart(event, id) {
  event.stopPropagation()
  const el = elements.value.find((item) => item.id === id)
  if (!el) return

  dragOffset.value = {
    ...dragOffset.value,
    startX: event.clientX,
    startY: event.clientY,
    startWidth: el.width || 100,
    startHeight: el.height || 100,
    startFontSize: el.fontSize || 24,
  }
  interactionMode.value = 'resize'
}

function handleMouseMove(event) {
  if (!interactionMode.value) return

  // Marquee mode
  if (interactionMode.value === 'marquee' && selectionBox.value) {
    const rect = workspaceRef.value.getBoundingClientRect()
    const currentX = (event.clientX - rect.left) / zoom.value
    const currentY = (event.clientY - rect.top) / zoom.value
    selectionBox.value = { ...selectionBox.value, endX: currentX, endY: currentY }

    const minX = Math.min(selectionBox.value.startX, currentX)
    const maxX = Math.max(selectionBox.value.startX, currentX)
    const minY = Math.min(selectionBox.value.startY, currentY)
    const maxY = Math.max(selectionBox.value.startY, currentY)

    const newSelected = elements.value
      .filter((el) => {
        const domNode = document.getElementById(`element-${el.id}`)
        const w = domNode ? domNode.offsetWidth : (el.width || 100)
        const h = domNode ? domNode.offsetHeight : (el.height || 100)
        return el.x < maxX && el.x + w > minX && el.y < maxY && el.y + h > minY
      })
      .map((el) => el.id)

    selectedIds.value = newSelected
    return
  }

  if (selectedIds.value.length === 0) return

  const canvasWidth = workspaceRef.value.offsetWidth
  const canvasHeight = workspaceRef.value.offsetHeight

  if (interactionMode.value === 'move') {
    const deltaX = (event.clientX - dragOffset.value.x) / zoom.value
    const deltaY = (event.clientY - dragOffset.value.y) / zoom.value

    let snapOffsetX = 0
    let snapOffsetY = 0
    let newSnapLines = []
    const THRESHOLD = 8

    // Only compute snap lines for single selection
    if (selectedIds.value.length === 1) {
      const id = selectedIds.value[0]
      let nextX = dragOffset.value.startPositions[id].x + deltaX
      let nextY = dragOffset.value.startPositions[id].y + deltaY

      const dragXs = [nextX, nextX + dragOffset.value.width / 2, nextX + dragOffset.value.width]
      const dragYs = [nextY, nextY + dragOffset.value.height / 2, nextY + dragOffset.value.height]

      if (Math.abs(dragXs[1] - canvasWidth / 2) < THRESHOLD) {
        nextX = canvasWidth / 2 - dragOffset.value.width / 2
        newSnapLines.push({ type: 'vertical', pos: canvasWidth / 2 })
      }
      if (Math.abs(dragYs[1] - canvasHeight / 2) < THRESHOLD) {
        nextY = canvasHeight / 2 - dragOffset.value.height / 2
        newSnapLines.push({ type: 'horizontal', pos: canvasHeight / 2 })
      }

      elements.value.forEach((otherEl) => {
        if (otherEl.id === id) return
        const elRect = { x: otherEl.x, y: otherEl.y, width: 0, height: 0 }
        const domNode = document.getElementById(`element-${otherEl.id}`)
        if (domNode) {
          elRect.width = domNode.offsetWidth
          elRect.height = domNode.offsetHeight
        } else if (otherEl.width) {
          elRect.width = otherEl.width
          elRect.height = otherEl.height
        }
        if (elRect.width === 0 && elRect.height === 0) return

        const targetXs = [elRect.x, elRect.x + elRect.width / 2, elRect.x + elRect.width]
        const targetYs = [elRect.y, elRect.y + elRect.height / 2, elRect.y + elRect.height]

        targetXs.forEach((tx) =>
          dragXs.forEach((dx, idx) => {
            if (Math.abs(tx - dx) < THRESHOLD) {
              nextX = idx === 0 ? tx : idx === 1 ? tx - dragOffset.value.width / 2 : tx - dragOffset.value.width
              newSnapLines.push({ type: 'vertical', pos: tx })
            }
          }),
        )
        targetYs.forEach((ty) =>
          dragYs.forEach((dy, idx) => {
            if (Math.abs(ty - dy) < THRESHOLD) {
              nextY = idx === 0 ? ty : idx === 1 ? ty - dragOffset.value.height / 2 : ty - dragOffset.value.height
              newSnapLines.push({ type: 'horizontal', pos: ty })
            }
          }),
        )
      })

      snapOffsetX = nextX - (dragOffset.value.startPositions[id].x + deltaX)
      snapOffsetY = nextY - (dragOffset.value.startPositions[id].y + deltaY)
      snapLines.value = newSnapLines.filter(
        (v, i, a) => a.findIndex((t) => t.type === v.type && t.pos === v.pos) === i,
      )
    }

    elements.value = elements.value.map((el) => {
      if (selectedIds.value.includes(el.id) && dragOffset.value.startPositions[el.id]) {
        return {
          ...el,
          x: dragOffset.value.startPositions[el.id].x + deltaX + snapOffsetX,
          y: dragOffset.value.startPositions[el.id].y + deltaY + snapOffsetY,
        }
      }
      return el
    })
  } else if (interactionMode.value === 'rotate' && selectedIds.value.length === 1) {
    const currentAngle = Math.atan2(
      event.clientY - dragOffset.value.centerY,
      event.clientX - dragOffset.value.centerX,
    )
    const angleDiff = (currentAngle - dragOffset.value.startAngle) * (180 / Math.PI)
    updateElement(selectedIds.value[0], { rotation: dragOffset.value.startRotation + angleDiff })
  } else if (interactionMode.value === 'resize' && selectedIds.value.length === 1) {
    const diffX = (event.clientX - dragOffset.value.startX) / zoom.value
    const scaleFactor = 1 + diffX / 200
    const el = elements.value.find((i) => i.id === selectedIds.value[0])

    if (el.type === 'text') {
      const newSize = Math.max(8, Math.round(dragOffset.value.startFontSize * scaleFactor))
      updateElement(selectedIds.value[0], { fontSize: newSize })
    } else {
      updateElement(selectedIds.value[0], {
        width: Math.max(20, dragOffset.value.startWidth * scaleFactor),
        height: Math.max(20, dragOffset.value.startHeight * scaleFactor),
      })
    }
  }
}

function handleMouseUp() {
  if (interactionMode.value === 'marquee') selectionBox.value = null
  interactionMode.value = null
  if (snapLines.value.length > 0) snapLines.value = []
}

function deleteElement(id) {
  elements.value = elements.value.filter((el) => el.id !== id)
  selectedIds.value = selectedIds.value.filter((sid) => sid !== id)
}

function duplicateElement(el) {
  const newId = createId()
  elements.value = [...elements.value, { ...el, id: newId, x: el.x + 20, y: el.y + 20 }]
  selectedIds.value = [newId]
}

// Smart alignment (supports single and multi-select)
function handleAlign(type) {
  const isSingle = selectedIds.value.length === 1
  const canvasW = workspaceRef.value.offsetWidth
  const canvasH = workspaceRef.value.offsetHeight

  const bbox = isSingle
    ? { minX: 0, minY: 0, maxX: canvasW, maxY: canvasH, width: canvasW, height: canvasH }
    : groupBBox.value

  elements.value = elements.value.map((el) => {
    if (!selectedIds.value.includes(el.id)) return el
    const domNode = document.getElementById(`element-${el.id}`)
    const w = domNode ? domNode.offsetWidth : (el.width || 100)
    const h = domNode ? domNode.offsetHeight : (el.height || 100)

    let newX = el.x
    let newY = el.y

    switch (type) {
      case 'left': newX = bbox.minX; break
      case 'center': newX = bbox.minX + bbox.width / 2 - w / 2; break
      case 'right': newX = bbox.maxX - w; break
      case 'top': newY = bbox.minY; break
      case 'middle': newY = bbox.minY + bbox.height / 2 - h / 2; break
      case 'bottom': newY = bbox.maxY - h; break
    }
    return { ...el, x: newX, y: newY }
  })
  showMoreMenu.value = false
  moreMenuMode.value = 'main'
}

function deleteGroup(event) {
  event.stopPropagation()
  elements.value = elements.value.filter((el) => !selectedIds.value.includes(el.id))
  selectedIds.value = []
}

function duplicateGroup(event) {
  event.stopPropagation()
  const newElements = []
  const newSelectedIds = []
  elements.value.forEach((el) => {
    if (selectedIds.value.includes(el.id)) {
      const newId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      newElements.push({ ...el, id: newId, x: el.x + 20, y: el.y + 20 })
      newSelectedIds.push(newId)
    }
  })
  elements.value = [...elements.value, ...newElements]
  selectedIds.value = newSelectedIds
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function addText() {
  const newId = createId()
  elements.value = [
    ...elements.value,
    {
      id: newId,
      type: 'text',
      content: '點擊修改文字',
      x: 150,
      y: 200,
      fontSize: 24,
      color: '#2C2C2C',
      fontWeight: 'normal',
      rotation: 0,
    },
  ]
  selectedIds.value = [newId]
}

function addImageElement(image) {
  const newId = createId()
  elements.value = [
    ...elements.value,
    {
      id: newId,
      type: 'image',
      src: image.src,
      name: image.name,
      x: 150,
      y: 150,
      width: 120,
      height: 120,
      rotation: 0,
    },
  ]
  selectedIds.value = [newId]
}

// Apply name stickers
function handleApplyNameStickers() {
  if (!nameStickerText.value.trim()) return
  const newElements = []
  const newIds = []
  const cols = 4
  const rows = 4

  const canvasW = workspaceRef.value ? workspaceRef.value.offsetWidth : 600
  const canvasH = workspaceRef.value ? workspaceRef.value.offsetHeight : 400

  const paddingX = 50
  const paddingY = 50
  const gapX = (canvasW - paddingX * 2) / Math.max(1, cols - 1)
  const gapY = (canvasH - paddingY * 2) / Math.max(1, rows - 1)

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const newId = `name-${Date.now()}-${i}-${j}-${Math.random().toString(36).substr(2, 5)}`
      newElements.push({
        id: newId,
        type: 'text',
        content: nameStickerText.value,
        x: paddingX + j * gapX,
        y: paddingY + i * gapY,
        fontSize: 28,
        color: '#2C2C2C',
        fontWeight: 'bold',
        rotation: 0,
      })
      newIds.push(newId)
    }
  }
  elements.value = [...elements.value, ...newElements]
  selectedIds.value = newIds
}

function handleLayerDragStart(event, id) {
  event.dataTransfer?.setData('text/plain', id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function handleLayerDragOver(event, id) {
  event.preventDefault()
  if (dragOverId.value !== id) dragOverId.value = id
}

function handleLayerDrop(event, targetId) {
  event.preventDefault()
  dragOverId.value = null
  const draggedId = event.dataTransfer?.getData('text/plain')
  if (!draggedId || draggedId === targetId) return

  elements.value = ((previous) => {
    const oldIndex = previous.findIndex((el) => el.id === draggedId)
    const newIndex = previous.findIndex((el) => el.id === targetId)
    if (oldIndex === -1 || newIndex === -1) return previous
    const result = [...previous]
    const [removed] = result.splice(oldIndex, 1)
    result.splice(newIndex, 0, removed)
    return result
  })(elements.value)
}

function layerItemClass(id) {
  if (selectedIds.value.includes(id)) return 'border-[#0078C8] bg-white shadow-md'
  if (dragOverId.value === id) return 'border-[#0078C8]/50 bg-[#eef7ff]'
  return 'border-transparent'
}

function updateSelectedTexts(patch) {
  elements.value = elements.value.map((el) =>
    selectedIds.value.includes(el.id) && el.type === 'text' ? { ...el, ...patch } : el,
  )
}

function getElementStyle(element) {
  const base = {
    left: `${element.x}px`,
    top: `${element.y}px`,
    transform: `rotate(${element.rotation || 0}deg)`,
  }

  if (selectedIds.value.length === 1 && selectedIds.value.includes(element.id)) {
    base.border = '1px solid #0078C8'
  }

  if (element.type === 'text') {
    return {
      ...base,
      fontSize: `${element.fontSize}px`,
      color: element.color || '#2C2C2C',
      fontWeight: element.fontWeight || 'normal',
      fontStyle: element.isItalic ? 'italic' : 'normal',
      textDecoration:
        `${element.isUnderline ? 'underline ' : ''}${element.isStrikethrough ? 'line-through' : ''}`.trim() || 'none',
      padding: '4px 8px',
    }
  }

  return {
    ...base,
    width: `${element.width}px`,
    height: `${element.height}px`,
  }
}
</script>

<template>
  <div
    class="flex h-[calc(100vh-65px)] min-h-[820px] flex-col overflow-hidden bg-[#ECECEC] text-[#2C2C2C]"
    style="font-family: 'PingFang TC', sans-serif"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
  >
    <!-- Header -->
    <header class="relative z-50 flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
      <div class="flex items-center space-x-4">
        <img src="" alt="FamiPort Logo" class="h-8 object-contain" />
        <div class="h-5 w-px bg-gray-300" />
        <button class="flex items-center space-x-2 text-gray-600 transition hover:text-[#2C2C2C]">
          <X :size="20" />
          <span class="text-sm font-semibold">儲存並離開</span>
        </button>
        <div class="h-5 w-px bg-gray-300" />
        <span class="text-sm font-medium text-gray-700">DIY套框 - 卡娜赫拉</span>
        <div class="flex items-center space-x-1.5 rounded-md bg-[#EAF7FF] px-2 py-1 text-xs font-semibold text-[#0078C8]">
          <div class="h-1.5 w-1.5 rounded-full bg-[#0078C8]" />
          <span>已儲存</span>
        </div>
      </div>

      <div class="flex items-center space-x-4">
        <div class="flex space-x-3 text-gray-400">
          <button class="hover:text-[#2C2C2C]"><Undo :size="20" /></button>
          <button class="hover:text-[#2C2C2C]"><Redo :size="20" /></button>
        </div>
        <button class="flex items-center space-x-2 text-sm font-semibold text-gray-600 transition hover:text-[#2C2C2C]" @click="showPreviewModal = true">
          <Eye :size="20" />
          <span>預覽</span>
        </button>
        <button class="w-[120px] rounded-[100px] bg-[#0078C8] px-4 py-2 text-base font-medium text-white shadow-md transition hover:bg-[#0060a0]">下一步</button>
      </div>
    </header>

    <div class="relative flex flex-1 overflow-hidden">
      <!-- Sidebar -->
      <div class="relative z-40 flex w-[90px] shrink-0 flex-col items-center border-r border-gray-200 bg-white py-4 shadow-sm">
        <template v-for="item in sidebarItems" :key="item.id ?? 'divider'">
          <div v-if="item.divider" class="my-2 h-px w-12 bg-gray-200" />
          <button
            v-else
            class="mb-2 flex h-20 w-20 flex-col items-center justify-center rounded-xl transition-all"
            :class="activeTab === item.id ? 'bg-[#EAF7FF] text-[#2391DA]' : 'text-gray-600 hover:bg-gray-100'"
            @click="setSidebarTab(item.id)"
          >
            <component :is="item.icon" :size="24" class="mb-1" :stroke-width="activeTab === item.id ? 2.5 : 2" />
            <span class="text-[11px]" :class="activeTab === item.id ? 'font-bold' : 'font-medium'">{{ item.label }}</span>
          </button>
        </template>
      </div>

      <!-- Side Panel -->
      <div
        class="absolute bottom-4 left-[106px] top-4 z-30 flex w-[340px] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl transition-all duration-300"
        :class="activeTab === '' ? 'pointer-events-none -translate-x-[10px] opacity-0' : 'translate-x-0 opacity-100'"
      >
        <div class="flex items-center justify-between border-b border-gray-50 px-6 py-5">
          <h2 class="text-lg font-bold">{{ activePanelTitle }}</h2>
          <button class="rounded-full bg-white p-1 text-gray-500 hover:text-[#2C2C2C]" @click="activeTab = ''">
            <X :size="18" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-6">
          <!-- Frames -->
          <div v-if="activeTab === 'frames'" class="space-y-4">
            <div class="relative mb-6">
              <Search :size="18" class="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400" />
              <input
                v-model="frameSearch"
                type="text"
                placeholder="搜尋圖框..."
                class="w-full rounded-full bg-gray-100 py-3 pl-10 pr-4 text-sm text-[#2C2C2C] transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0078C8]"
              />
            </div>
            <div class="mb-2 flex items-center justify-between">
              <h3 class="text-sm font-bold text-gray-700">推薦套框</h3>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div v-for="frame in filteredFrames" :key="frame.id" class="flex flex-col items-center">
                <div
                  class="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 bg-white p-1 shadow-sm transition-all"
                  :class="[
                    selectedFrame.id === frame.id ? 'border-[#0078C8] ring-2 ring-[#0078C8]/20' : 'border-gray-200 hover:border-gray-300',
                    frame.aspect === '2/3' ? 'aspect-[2/3]' : 'aspect-[3/2]',
                  ]"
                  @click="selectedFrame = frame"
                >
                  <img :src="frame.src" :alt="frame.name" class="h-full w-full object-contain" />
                </div>
                <span class="mt-1.5 w-full truncate text-center text-[11px] font-medium text-gray-600">{{ frame.name }}</span>
              </div>
            </div>
          </div>

          <!-- Text Panel -->
          <div v-else-if="activeTab === 'text'" class="flex h-full flex-col">
            <!-- Section 1: Name Sticker Settings -->
            <div class="mb-6 shrink-0 border-b border-gray-200 pb-6">
              <h3 class="mb-3 text-sm font-bold text-[#2C2C2C]">姓名貼設定</h3>
              <div class="mb-3 flex items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 transition-colors focus-within:border-[#0078C8]">
                <input
                  v-model="nameStickerText"
                  type="text"
                  placeholder="輸入姓名"
                  class="w-full border-none bg-transparent text-sm text-[#2C2C2C] focus:outline-none"
                />
                <button class="ml-2 shrink-0 p-1 text-gray-400 hover:text-red-500" title="清除" @click="nameStickerText = ''">
                  <Trash2 :size="16" />
                </button>
              </div>
              <button
                class="flex w-full items-center justify-center rounded-[100px] border border-[#0078c9] bg-white py-2.5 text-[16px] font-bold text-[#0078c9] transition hover:bg-gray-50"
                @click="handleApplyNameStickers"
              >
                <span>套用姓名</span>
              </button>
            </div>

            <!-- Section 2: Add Text -->
            <div class="flex flex-1 flex-col overflow-hidden">
              <h3 class="mb-2 text-sm font-bold text-[#2C2C2C]">新增文字</h3>
              <p class="mb-4 shrink-0 text-sm text-gray-500">在下方編輯您的文字，或點擊設計上的欄位直接編輯。</p>
              <div class="mb-6 flex-1 space-y-1 overflow-y-auto pr-1">
                <div
                  v-for="el in textElements"
                  :key="el.id"
                  class="mb-2 flex items-center justify-between transition-all"
                  :class="selectedIds.includes(el.id) ? '' : 'border-b border-gray-300'"
                  @click="(e) => { e.shiftKey ? handleMouseDown(e, el.id) : (selectedIds = [el.id]) }"
                >
                  <div class="flex-1" :class="selectedIds.includes(el.id) ? 'border-2 border-[#0078C8] px-2 py-1.5' : 'py-2'">
                    <input
                      :ref="selectedIds.length === 1 && selectedIds[0] === el.id ? (node) => { selectedInputRef = node } : undefined"
                      type="text"
                      :value="el.content"
                      class="w-full border-none bg-transparent text-sm text-[#2C2C2C] focus:outline-none"
                      placeholder="輸入文字"
                      @input="updateElement(el.id, { content: $event.target.value })"
                    />
                  </div>
                  <div v-if="selectedIds.includes(el.id) && selectedIds.length === 1" class="ml-3 flex shrink-0 space-x-1">
                    <button class="p-1 text-[#2C2C2C] hover:text-[#0078C8]" @click.stop="duplicateGroup($event)">
                      <Copy :size="20" />
                    </button>
                    <button class="p-1 text-[#2C2C2C] hover:text-red-500" @click.stop="deleteGroup($event)">
                      <Trash2 :size="20" />
                    </button>
                  </div>
                </div>
              </div>
              <button
                class="flex w-full shrink-0 items-center justify-center space-x-2 rounded-[100px] bg-[#0078c9] py-2.5 text-[16px] font-bold text-white"
                @click="addText"
              >
                <span>新增文字區塊</span>
              </button>
            </div>
          </div>

          <!-- Icons -->
          <div v-else-if="activeTab === 'icons'" class="flex h-full flex-col space-y-6">
            <div class="relative shrink-0">
              <Search :size="18" class="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400" />
              <input
                v-model="iconSearch"
                type="text"
                placeholder="搜尋圖像..."
                class="w-full rounded-full bg-gray-100 py-3 pl-10 pr-4 text-sm text-[#2C2C2C] transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0078C8]"
              />
            </div>
            <div class="flex-1 overflow-y-auto">
              <h3 class="mb-3 text-sm font-bold text-[#2C2C2C]">所有圖像</h3>
              <div class="grid grid-cols-3 gap-3">
                <div
                  v-for="img in filteredGalleryImages"
                  :key="img.id"
                  class="group flex flex-col items-center"
                  @click="addImageElement(img)"
                >
                  <div class="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-sm transition aspect-square group-hover:ring-2 group-hover:ring-[#0078C8]">
                    <img :src="img.src" :alt="img.name" class="h-full w-full rounded-lg object-cover" />
                  </div>
                  <span class="mt-1.5 w-full truncate text-center text-[11px] font-medium text-gray-500 transition group-hover:text-[#0078C8]">{{ img.name }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Uploads -->
          <div v-else-if="activeTab === 'uploads'" class="space-y-4">
            <button
              class="flex w-full items-center justify-center space-x-2 rounded-[100px] bg-[#0078c9] py-2.5 text-[16px] font-bold text-white"
              @click="fileInputRef?.click()"
            >
              <Upload :size="18" />
              <span>從這個裝置上傳照片</span>
            </button>
            <div class="grid grid-cols-2 gap-3">
              <div
                v-for="(url, index) in uploads"
                :key="`${url}-${index}`"
                class="aspect-square cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm"
                @click="bgImage = url"
              >
                <img :src="url" alt="upload" class="h-full w-full object-cover" />
              </div>
            </div>
          </div>

          <!-- Layers -->
          <div v-else-if="activeTab === 'layers'" class="space-y-3">
            <div
              v-for="el in reversedElements"
              :key="el.id"
              draggable="true"
              class="flex cursor-grab items-center rounded-xl border bg-[#f4f5f7] p-4"
              :class="layerItemClass(el.id)"
              @dragstart="handleLayerDragStart($event, el.id)"
              @dragover="handleLayerDragOver($event, el.id)"
              @drop="handleLayerDrop($event, el.id)"
              @click="selectedIds = [el.id]"
            >
              <div class="pointer-events-none mr-4 h-6 w-1 shrink-0 rounded-full bg-gray-300" />
              <span class="pointer-events-none flex-1 truncate text-sm font-medium">{{ el.type === 'text' ? el.content : (el.name || '圖像') }}</span>
              <button class="ml-2 shrink-0 p-1 text-gray-400 hover:text-red-500" title="刪除圖層" @click.stop="deleteElement(el.id)">
                <Trash2 :size="16" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Canvas Area -->
      <div class="relative z-10 flex flex-1 items-center justify-center overflow-hidden pl-[340px]">
        <!-- Text Style Toolbar -->
        <div
          v-if="showTextToolbar"
          class="animate-in slide-in-from-top-4 absolute left-[calc(50%+100px)] top-6 z-40 flex h-12 -translate-x-1/2 transform items-center space-x-3 rounded-xl border border-gray-200 bg-white px-4 shadow-md"
          @mousedown.stop
        >
          <div class="flex cursor-pointer items-center rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50">
            <span class="mr-8 text-sm font-medium">PingFang TC</span>
            <ChevronDown :size="14" class="text-gray-500" />
          </div>
          <div class="mx-1 h-5 w-px bg-gray-300" />
          <div class="flex items-center space-x-1 rounded-md border border-gray-300 p-0.5">
            <button
              class="rounded p-1 text-gray-600 hover:bg-gray-100"
              @click="updateSelectedTexts({ fontSize: Math.max(8, (firstSelectedText?.fontSize ?? 24) - 1) })"
            >
              <Minus :size="14" :stroke-width="2.5" />
            </button>
            <div class="w-12 px-2 py-1 text-center text-sm font-medium">{{ firstSelectedText?.fontSize }}</div>
            <button
              class="rounded p-1 text-gray-600 hover:bg-gray-100"
              @click="updateSelectedTexts({ fontSize: (firstSelectedText?.fontSize ?? 24) + 1 })"
            >
              <Plus :size="14" :stroke-width="2.5" />
            </button>
          </div>
          <div class="mx-1 h-5 w-px bg-gray-300" />
          <div
            class="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border-2 border-gray-200 shadow-sm transition-transform hover:scale-105"
            :style="{ backgroundColor: firstSelectedText?.color }"
            title="選擇顏色"
          >
            <input
              type="color"
              class="absolute -left-2 -top-2 h-12 w-12 cursor-pointer opacity-0"
              :value="firstSelectedText?.color || '#000000'"
              @input="updateSelectedTexts({ color: $event.target.value })"
            />
          </div>
          <div class="mx-1 h-5 w-px bg-gray-300" />
          <div class="flex items-center space-x-1">
            <button
              class="rounded p-1.5 transition"
              :class="firstSelectedText?.fontWeight === 'bold' ? 'bg-gray-200 text-black' : 'text-gray-600 hover:bg-gray-100'"
              @click="updateSelectedTexts({ fontWeight: firstSelectedText?.fontWeight === 'bold' ? 'normal' : 'bold' })"
            >
              <Bold :size="18" />
            </button>
            <button
              class="rounded p-1.5 transition"
              :class="firstSelectedText?.isItalic ? 'bg-gray-200 text-black' : 'text-gray-600 hover:bg-gray-100'"
              @click="updateSelectedTexts({ isItalic: !firstSelectedText?.isItalic })"
            >
              <Italic :size="18" />
            </button>
            <button
              class="rounded p-1.5 transition"
              :class="firstSelectedText?.isUnderline ? 'bg-gray-200 text-black' : 'text-gray-600 hover:bg-gray-100'"
              @click="updateSelectedTexts({ isUnderline: !firstSelectedText?.isUnderline })"
            >
              <Underline :size="18" />
            </button>
            <button
              class="rounded p-1.5 transition"
              :class="firstSelectedText?.isStrikethrough ? 'bg-gray-200 text-black' : 'text-gray-600 hover:bg-gray-100'"
              @click="updateSelectedTexts({ isStrikethrough: !firstSelectedText?.isStrikethrough })"
            >
              <Strikethrough :size="18" />
            </button>
          </div>
        </div>

        <!-- Zoom Controls -->
        <div class="absolute bottom-6 right-6 z-40 flex items-center rounded-2xl border border-gray-100 bg-white px-1 py-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.1)]">
          <button class="rounded-lg p-1.5 text-black transition hover:bg-gray-100" title="縮小" @click.stop="zoom = Math.max(0.1, zoom - 0.1)">
            <Minus :size="18" :stroke-width="2.5" />
          </button>
          <span class="min-w-[3.5rem] select-none text-center text-[15px] font-bold text-black">{{ Math.round(zoom * 100) }}%</span>
          <button class="rounded-lg p-1.5 text-black transition hover:bg-gray-100" title="放大" @click.stop="zoom = Math.min(3, zoom + 0.1)">
            <Plus :size="18" :stroke-width="2.5" />
          </button>
        </div>

        <!-- Canvas -->
        <div
          ref="workspaceRef"
          class="relative w-full overflow-hidden rounded-sm bg-white shadow-2xl transition-transform duration-200"
          :class="workspaceClass"
          :style="{ transform: `scale(${zoom})`, transformOrigin: 'center center' }"
          @mousedown="handleCanvasMouseDown"
        >
          <img :src="bgImage" class="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover" alt="底圖" />
          <img v-if="selectedFrame" :src="selectedFrame.src" class="pointer-events-none absolute inset-0 z-10 h-full w-full object-fill" alt="套框" />

          <!-- Marquee Selection Box -->
          <div
            v-if="selectionBox"
            class="pointer-events-none absolute z-50 border border-[#0078C8] bg-[#0078C8]/10"
            :style="{
              left: `${Math.min(selectionBox.startX, selectionBox.endX)}px`,
              top: `${Math.min(selectionBox.startY, selectionBox.endY)}px`,
              width: `${Math.abs(selectionBox.endX - selectionBox.startX)}px`,
              height: `${Math.abs(selectionBox.endY - selectionBox.startY)}px`,
            }"
          />

          <!-- Snap Lines -->
          <div
            v-for="(line, index) in snapLines"
            :key="`${line.type}-${line.pos}-${index}`"
            class="pointer-events-none absolute z-[15] bg-[#0078C8] opacity-80"
            :class="line.type === 'vertical' ? 'bottom-0 top-0 w-px' : 'left-0 right-0 h-px'"
            :style="line.type === 'vertical' ? { left: `${line.pos}px` } : { top: `${line.pos}px` }"
          />

          <!-- Group Selection BBox & Floating Toolbar -->
          <div
            v-if="groupBBox"
            class="pointer-events-none absolute z-40"
            :class="selectedIds.length > 1 ? 'border border-[#0078C8] bg-[#0078C8]/5' : ''"
            :style="{ left: `${groupBBox.minX}px`, top: `${groupBBox.minY}px`, width: `${groupBBox.width}px`, height: `${groupBBox.height}px` }"
          >
            <!-- Floating Group Toolbar -->
            <div
              class="pointer-events-auto absolute -top-[52px] left-1/2 z-50 flex -translate-x-1/2 transform items-center space-x-1 rounded-lg border border-gray-200 bg-white p-1 shadow-xl"
              @mousedown.stop
            >
              <button class="rounded p-1.5 text-gray-700 transition hover:bg-gray-100" title="鎖定">
                <Lock :size="16" />
              </button>
              <div class="mx-1 h-4 w-px bg-gray-300" />
              <button class="rounded p-1.5 text-gray-700 transition hover:bg-gray-100" title="複製" @click="duplicateGroup($event)">
                <Copy :size="16" />
              </button>
              <button class="rounded p-1.5 text-red-500 transition hover:bg-gray-100" title="刪除" @click="deleteGroup($event)">
                <Trash2 :size="16" />
              </button>
              <div class="mx-1 h-4 w-px bg-gray-300" />

              <!-- More Menu with Alignment -->
              <div class="relative">
                <button
                  class="rounded p-1.5 text-gray-700 transition"
                  :class="showMoreMenu ? 'bg-gray-200' : 'hover:bg-gray-100'"
                  title="更多"
                  @click.stop="showMoreMenu = !showMoreMenu"
                >
                  <MoreHorizontal :size="16" />
                </button>

                <div
                  v-if="showMoreMenu"
                  class="absolute left-1/2 top-full z-50 mt-2 flex min-w-[140px] -translate-x-1/2 transform flex-col gap-0.5 rounded-lg border border-gray-100 bg-white p-1 shadow-xl"
                >
                  <!-- Main Menu -->
                  <template v-if="moreMenuMode === 'main'">
                    <button
                      class="flex w-full items-center justify-between rounded-md px-3 py-2 text-gray-700 transition hover:bg-gray-100"
                      @click="moreMenuMode = 'align'"
                    >
                      <div class="flex items-center space-x-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M12 3v18" />
                          <path d="M9 8h-2a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h2" />
                          <path d="M15 8h2a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-2" />
                        </svg>
                        <span class="text-sm font-medium">對齊方式</span>
                      </div>
                      <ChevronRight :size="14" />
                    </button>
                  </template>

                  <!-- Alignment Sub-menu -->
                  <template v-else>
                    <button
                      class="mb-1 flex w-full items-center space-x-2 rounded-md px-2 py-1.5 text-gray-500 hover:bg-gray-100"
                      @click="moreMenuMode = 'main'"
                    >
                      <ChevronLeft :size="14" />
                      <span class="text-xs font-bold">返回</span>
                    </button>
                    <div class="my-1 h-px w-full bg-gray-200" />
                    <button class="flex w-full items-center space-x-2 rounded-md px-3 py-2 text-gray-700 transition hover:bg-gray-100" @click="handleAlign('left')">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="4" y1="2" x2="4" y2="22" />
                        <rect x="8" y="6" width="10" height="4" rx="1" />
                        <rect x="8" y="14" width="6" height="4" rx="1" />
                      </svg>
                      <span class="whitespace-nowrap text-sm font-medium">左側對齊</span>
                    </button>
                    <button class="flex w-full items-center space-x-2 rounded-md px-3 py-2 text-gray-700 transition hover:bg-gray-100" @click="handleAlign('center')">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 3v18" />
                        <path d="M9 8h-2a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h2" />
                        <path d="M15 8h2a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-2" />
                      </svg>
                      <span class="whitespace-nowrap text-sm font-medium">水平置中</span>
                    </button>
                    <button class="flex w-full items-center space-x-2 rounded-md px-3 py-2 text-gray-700 transition hover:bg-gray-100" @click="handleAlign('right')">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="20" y1="2" x2="20" y2="22" />
                        <rect x="6" y="6" width="10" height="4" rx="1" />
                        <rect x="10" y="14" width="6" height="4" rx="1" />
                      </svg>
                      <span class="whitespace-nowrap text-sm font-medium">右側對齊</span>
                    </button>
                    <div class="my-1 h-px w-full bg-gray-200" />
                    <button class="flex w-full items-center space-x-2 rounded-md px-3 py-2 text-gray-700 transition hover:bg-gray-100" @click="handleAlign('top')">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="2" y1="4" x2="22" y2="4" />
                        <rect x="6" y="8" width="4" height="10" rx="1" />
                        <rect x="14" y="8" width="4" height="6" rx="1" />
                      </svg>
                      <span class="whitespace-nowrap text-sm font-medium">頂部對齊</span>
                    </button>
                    <button class="flex w-full items-center space-x-2 rounded-md px-3 py-2 text-gray-700 transition hover:bg-gray-100" @click="handleAlign('middle')">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 12h18" />
                        <path d="M8 9v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2" />
                        <path d="M8 15v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2 -2v-2" />
                      </svg>
                      <span class="whitespace-nowrap text-sm font-medium">垂直置中</span>
                    </button>
                    <button class="flex w-full items-center space-x-2 rounded-md px-3 py-2 text-gray-700 transition hover:bg-gray-100" @click="handleAlign('bottom')">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="2" y1="20" x2="22" y2="20" />
                        <rect x="6" y="6" width="4" height="10" rx="1" />
                        <rect x="14" y="10" width="4" height="6" rx="1" />
                      </svg>
                      <span class="whitespace-nowrap text-sm font-medium">底部對齊</span>
                    </button>
                  </template>
                </div>
              </div>
            </div>

            <!-- Single selection resize/rotate buttons -->
            <div
              v-if="selectedIds.length === 1"
              class="pointer-events-auto absolute -bottom-[50px] left-1/2 flex -translate-x-1/2 transform items-center space-x-3"
              @mousedown.stop
            >
              <div
                class="flex h-10 w-10 cursor-se-resize items-center justify-center rounded-full border border-gray-200 bg-white text-[#0078C8] shadow-lg transition-transform hover:scale-110"
                @mousedown="handleResizeStart($event, selectedIds[0])"
              >
                <Move :size="20" :stroke-width="2.5" />
              </div>
              <div
                class="flex h-10 w-10 cursor-alias items-center justify-center rounded-full border border-gray-200 bg-white text-[#0078C8] shadow-lg transition-transform hover:scale-110"
                @mousedown="handleRotateStart($event, selectedIds[0])"
              >
                <RotateCw :size="20" :stroke-width="2.5" />
              </div>
            </div>
          </div>

          <!-- Elements -->
          <div class="pointer-events-none absolute inset-0 z-20 overflow-hidden">
            <div
              v-for="el in elements"
              :id="`element-${el.id}`"
              :key="el.id"
              class="pointer-events-auto absolute flex items-center justify-center transition-shadow"
              :class="selectedIds.includes(el.id)
                ? 'z-30 cursor-move'
                : 'border border-transparent hover:border-gray-300/50'"
              :style="getElementStyle(el)"
              @mousedown="handleMouseDown($event, el.id)"
              @click.stop
            >
              <div v-if="el.type === 'text'" class="whitespace-pre-wrap">{{ el.content }}</div>
              <img v-else :src="el.src" draggable="false" class="pointer-events-none h-full w-full object-cover" alt="item" />

              <!-- Single selection corner handles -->
              <template v-if="selectedIds.length === 1 && selectedIds.includes(el.id)">
                <div class="absolute -left-1 -top-1 h-2 w-2 rounded-full border border-[#0078C8] bg-white" />
                <div class="absolute -right-1 -top-1 h-2 w-2 rounded-full border border-[#0078C8] bg-white" />
                <div class="absolute -bottom-1 -left-1 h-2 w-2 rounded-full border border-[#0078C8] bg-white" />
                <div class="absolute -bottom-1 -right-1 h-2 w-2 rounded-full border border-[#0078C8] bg-white" />
              </template>
            </div>
          </div>

          <!-- Watermark -->
          <div class="pointer-events-none absolute bottom-6 right-6 z-30 opacity-90">
            <div class="flex items-center space-x-1 rounded bg-yellow-300 px-4 py-1.5 text-sm font-bold text-black shadow-md">
              <span class="text-[12px] tracking-wider">浮水印(FamiPort)</span>
            </div>
          </div>
        </div>
      </div>

      <input ref="fileInputRef" type="file" accept="image/*" class="hidden" @change="handleFileUpload" />
    </div>

    <!-- Preview Modal -->
    <div v-if="showPreviewModal" class="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <button class="absolute left-6 top-6 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-2xl transition-all hover:rotate-90" @click="showPreviewModal = false">
        <X :size="24" :stroke-width="3" />
      </button>

      <div class="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[#f0f2f5] shadow-2xl">
        <div class="relative flex flex-1 items-center justify-center overflow-y-auto p-8">
          <div class="relative overflow-hidden rounded-sm bg-white shadow-2xl" :class="previewWorkspaceClass">
            <img :src="bgImage" alt="preview" class="absolute inset-0 h-full w-full object-cover" />
            <img :src="selectedFrame.src" alt="frame" class="absolute inset-0 z-10 h-full w-full object-fill" />
            <div class="pointer-events-none absolute inset-0 z-20">
              <div
                v-for="el in elements"
                :key="`preview-${el.id}`"
                class="absolute flex items-center justify-center"
                :style="{
                  left: `${el.x}px`,
                  top: `${el.y}px`,
                  transform: `rotate(${el.rotation || 0}deg)`,
                  fontSize: el.type === 'text' ? `${el.fontSize}px` : undefined,
                  color: el.color,
                  fontWeight: el.fontWeight,
                  fontStyle: el.isItalic ? 'italic' : 'normal',
                  textDecoration: `${el.isUnderline ? 'underline ' : ''}${el.isStrikethrough ? 'line-through' : ''}`.trim() || 'none',
                  width: el.type === 'image' ? `${el.width}px` : undefined,
                  height: el.type === 'image' ? `${el.height}px` : undefined,
                }"
              >
                <template v-if="el.type === 'text'">{{ el.content }}</template>
                <img v-else :src="el.src" class="h-full w-full rounded object-cover shadow-sm" alt="sticker" />
              </div>
            </div>
          </div>
        </div>
        <div class="border-t bg-white py-5 text-center text-xl font-bold text-[#2C2C2C]">預覽成品</div>
      </div>
    </div>
  </div>
</template>
