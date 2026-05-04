<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  Bold,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  HelpCircle,
  Image as ImageIcon2,
  Info,
  Italic,
  Layers,
  LayoutTemplate,
  Minus,
  MoreHorizontal,
  Move,
  Plus,
  Redo,
  RotateCw,
  Scan,
  Search,
  Settings,
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
const showQRCodeModal = ref(false)

const startupModal = ref('mode')
const editorMode = ref(null)
const paperSpec = ref({ size: '4x6相紙', orientation: '橫式' })

const mockFrames = [
  { id: 1, name: '推薦套框 1', src: 'https://drive.google.com/thumbnail?id=1YWTrbRN-SBu6U-x1cBThYDwcp3ZzK88T&sz=w1000', aspect: '3/2' },
  { id: 2, name: '推薦套框 2', src: 'https://drive.google.com/thumbnail?id=193E6pQQr3I3FGF8G4vKUV1e90CJjIEdM&sz=w1000', aspect: '3/2' },
  { id: 3, name: '推薦套框 3', src: 'https://drive.google.com/thumbnail?id=1B8ubeLiu0Dp3rGPV2jNMQZszKvSUPaNz&sz=w1000', aspect: '2/3' },
]

const mockNameStickers = [
  { id: 'ns1', name: '姓名貼 1', src: 'https://drive.google.com/thumbnail?id=1Hjk7xqc5KVuzCt2h7VPH4nGhFu2UkqDn&sz=w1000', aspect: '3/2' },
  { id: 'ns2', name: '姓名貼 2', src: 'https://drive.google.com/thumbnail?id=1sxdapOJILQpAidaRGTmOn3uOVpupm0RO&sz=w1000', aspect: '3/2' },
  { id: 'ns3', name: '姓名貼 3', src: 'https://drive.google.com/thumbnail?id=19ri1zouC_2X1hAs_-Mg1lgbpSzdx8Vd4&sz=w1000', aspect: '3/2' },
]

const customIcons = [
  { id: 'icon1', name: '圖像 1', src: 'https://drive.google.com/thumbnail?id=1-WmeQFAn4VNSC9FfBfxnBI7WVgzbM3sB&sz=w1000' },
  { id: 'icon2', name: '圖像 2', src: 'https://drive.google.com/thumbnail?id=1Yi7L6R8ZBhBumYrQBqMrVO0u4XiHdFJP&sz=w1000' },
  { id: 'icon3', name: '圖像 3', src: 'https://drive.google.com/thumbnail?id=1eY433VERAZrNUkykLd9Ovd3efvce3XqX&sz=w1000' },
  { id: 'icon4', name: '圖像 4', src: 'https://drive.google.com/thumbnail?id=1R9HbyVpZ5wr3cFgxwqJ4o6RHGa4ieR3s&sz=w1000' },
  { id: 'icon5', name: '圖像 5', src: 'https://drive.google.com/thumbnail?id=1WTWzs3NQma2SrA03NVDNb0wZ-jM59POe&sz=w1000' },
]

const selectedFrame = ref(mockFrames[0])
const bgImage = ref('https://images.unsplash.com/photo-1531642765602-5cae8bbbf285?auto=format&fit=crop&w=800&q=80')

const mockGalleryImages = customIcons
const mockRecommendedImages = customIcons

const elements = ref([])
const selectedIds = ref([])
const showMoreMenu = ref(false)
const moreMenuMode = ref('main')

const nameStickerText = ref('王小明')
const frameSearch = ref('')
const iconSearch = ref('')

const currentRecPage = ref(0)
const recommendScrollRef = ref(null)

const interactionMode = ref(null)
const dragOffset = ref({ x: 0, y: 0, width: 0, height: 0, rotation: 0, fontSize: 0, startPositions: {} })
const selectionBox = ref(null)
const snapLines = ref([])
const dragOverId = ref(null)

const zoom = ref(1)

const showReviewPage = ref(false)
const showSaveTooltip = ref(false)
const showLeaveModal = ref(false)

const editingTextId = ref(null)
const editModalText = ref('')
const lastTapRef = ref({ time: 0, id: null })

const workspaceRef = ref(null)
const fileInputRef = ref(null)

const uploads = ref([
  'https://drive.google.com/thumbnail?id=12HImw2jTbyy5JNSupZAKYvpUbWS0MiFj&sz=w1000',
  'https://drive.google.com/thumbnail?id=1VNLkEK2Bp0tQsXNX4G5Vto_ME2ifd_vf&sz=w1000',
  'https://drive.google.com/thumbnail?id=1ygH5joQR4XveMyvibGUeEvcFr9_fL0CF&sz=w1000',
  'https://drive.google.com/thumbnail?id=1sbnUMvvVrex9KN8Slky6OeFqzll01hR3&sz=w1000',
])

const localUploadUrls = []

const activePanelTitle = computed(() => {
  if (activeTab.value === 'layers') return '圖層'
  if (activeTab.value === 'icons') return '圖像庫'
  if (activeTab.value === 'text') return '新增文字'
  if (activeTab.value === 'frames') return '圖框樣式'
  if (activeTab.value === 'namestickers') return '姓名貼'
  if (activeTab.value === 'paperSettings') return '紙材規格'
  return '照片上傳'
})

const isPortrait = computed(() => {
  if (editorMode.value === 'collage') {
    return paperSpec.value.orientation === '直式'
  }
  return selectedFrame.value?.aspect === '2/3'
})

const currentAspectRatio = computed(() => {
  if (editorMode.value !== 'collage') {
    return isPortrait.value ? '2 / 3' : '3 / 2'
  }
  const isAFormat = paperSpec.value.size.includes('A3') || paperSpec.value.size.includes('A4')
  if (paperSpec.value.orientation === '直式') {
    return isAFormat ? '29.7 / 42.0' : '10.2 / 15.2'
  }
  return isAFormat ? '42.0 / 29.7' : '15.2 / 10.2'
})

const canvasMaxWidthClass = computed(() => (isPortrait.value ? 'max-w-[450px]' : 'max-w-[800px]'))
const previewMaxWidthClass = computed(() => (isPortrait.value ? 'max-w-[400px]' : 'max-w-[650px]'))
const reviewMaxWidthClass = computed(() => (isPortrait.value ? 'max-w-[450px]' : 'max-w-[700px]'))

const currentPrice = computed(() => {
  if (editorMode.value !== 'collage') return 55
  if (paperSpec.value.size === '4x6相紙') return 55
  if (paperSpec.value.size === '4x6貼紙') return 60
  if (paperSpec.value.size === 'A4特殊紙') return 50
  return 40
})

const firstSelectedText = computed(() => elements.value.find((el) => selectedIds.value.includes(el.id) && el.type === 'text') || null)
const showTextToolbar = computed(() => selectedIds.value.length > 0 && !!firstSelectedText.value)
const textElements = computed(() => elements.value.filter((el) => el.type === 'text'))
const reversedElements = computed(() => [...elements.value].reverse())
const filteredFrames = computed(() => mockFrames.filter((frame) => frame.name.includes(frameSearch.value)))
const filteredGalleryImages = computed(() => mockGalleryImages.filter((img) => img.name.includes(iconSearch.value)))

const groupBBox = computed(() => {
  if (selectedIds.value.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const id of selectedIds.value) {
    const el = elements.value.find((item) => item.id === id)
    if (!el) continue
    const domNode = typeof document !== 'undefined' ? document.getElementById(`element-${id}`) : null
    const w = domNode ? domNode.offsetWidth : (el.width || 100)
    const h = domNode ? domNode.offsetHeight : (el.height || 100)
    if (el.x < minX) minX = el.x
    if (el.y < minY) minY = el.y
    if (el.x + w > maxX) maxX = el.x + w
    if (el.y + h > maxY) maxY = el.y + h
  }

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
})

watch([selectedIds, activeTab], async ([ids, tab]) => {
  if (tab === 'text' && ids.length === 1) {
    await nextTick()
    const input = document.getElementById(`text-input-${ids[0]}`)
    if (input) input.focus()
  }
}, { deep: true })

onBeforeUnmount(() => {
  for (const url of localUploadUrls) {
    URL.revokeObjectURL(url)
  }
})

function sidebarButtonClass(id) {
  const isActive = activeTab.value === id
  return [
    'shrink-0 flex flex-col items-center justify-center w-16 md:w-20 h-16 md:h-20 rounded-xl mb-0 md:mb-2 transition-all',
    isActive ? 'bg-[#EAF7FF] text-[#2391DA]' : 'text-gray-600 hover:bg-gray-100',
  ]
}

function sidebarIconStroke(id) {
  return activeTab.value === id ? 2.5 : 2
}

function sidebarLabelClass(id) {
  return ['text-[10px] md:text-[11px]', activeTab.value === id ? 'font-bold' : 'font-medium']
}

function getClientPos(e) {
  if (e.touches && e.touches.length > 0) {
    return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }
  }
  return { clientX: e.clientX || 0, clientY: e.clientY || 0 }
}

function handleFileUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const url = URL.createObjectURL(file)
  localUploadUrls.push(url)
  bgImage.value = url
  uploads.value = [url, ...uploads.value]
  e.target.value = ''
}

function handleCanvasDown(e) {
  if (!workspaceRef.value) return
  const target = e.target
  const isWorkspace = target === workspaceRef.value
  const isImg = target && target.tagName === 'IMG'

  if (isWorkspace || isImg) {
    const { clientX, clientY } = getClientPos(e)
    const rect = workspaceRef.value.getBoundingClientRect()
    const startX = (clientX - rect.left) / zoom.value
    const startY = (clientY - rect.top) / zoom.value
    interactionMode.value = 'marquee'
    selectionBox.value = { startX, startY, endX: startX, endY: startY }

    if (!e.shiftKey) selectedIds.value = []
    showMoreMenu.value = false
    moreMenuMode.value = 'main'
  }
}

function handleElementDown(e, id) {
  e.stopPropagation()

  const now = Date.now()
  if (now - lastTapRef.value.time < 400 && lastTapRef.value.id === id) {
    const el = elements.value.find((item) => item.id === id)
    if (el && el.type === 'text') {
      editingTextId.value = id
      editModalText.value = el.content || ''
      lastTapRef.value = { time: 0, id: null }
      return
    }
  }
  lastTapRef.value = { time: now, id }

  const { clientX, clientY } = getClientPos(e)

  let newSelectedIds = [...selectedIds.value]
  if (e.shiftKey) {
    if (newSelectedIds.includes(id)) newSelectedIds = newSelectedIds.filter((itemId) => itemId !== id)
    else newSelectedIds.push(id)
  } else {
    if (!newSelectedIds.includes(id)) newSelectedIds = [id]
  }

  selectedIds.value = newSelectedIds
  showMoreMenu.value = false
  moreMenuMode.value = 'main'

  if (newSelectedIds.length === 1) {
    const el = elements.value.find((item) => item.id === newSelectedIds[0])
    if (el && el.type === 'text' && typeof window !== 'undefined' && window.innerWidth >= 768) {
      activeTab.value = 'text'
    }
  }

  const startPositions = {}
  for (const el of elements.value) {
    if (newSelectedIds.includes(el.id)) {
      startPositions[el.id] = { x: el.x, y: el.y }
    }
  }

  const targetRect = e.currentTarget.getBoundingClientRect()
  dragOffset.value = {
    ...dragOffset.value,
    x: clientX,
    y: clientY,
    startPositions,
    width: targetRect.width / zoom.value,
    height: targetRect.height / zoom.value,
  }
  interactionMode.value = 'move'
}

function handleRotateStart(e, id) {
  e.stopPropagation()
  const { clientX, clientY } = getClientPos(e)
  const el = elements.value.find((item) => item.id === id)
  if (!el || !workspaceRef.value) return
  const rect = workspaceRef.value.getBoundingClientRect()
  const screenCenterX = rect.left + (el.x + dragOffset.value.width / 2) * zoom.value
  const screenCenterY = rect.top + (el.y + dragOffset.value.height / 2) * zoom.value

  dragOffset.value = {
    ...dragOffset.value,
    centerX: screenCenterX,
    centerY: screenCenterY,
    startAngle: Math.atan2(clientY - screenCenterY, clientX - screenCenterX),
    startRotation: el.rotation || 0,
  }
  interactionMode.value = 'rotate'
}

function handleResizeStart(e, id) {
  e.stopPropagation()
  const { clientX, clientY } = getClientPos(e)
  const el = elements.value.find((item) => item.id === id)
  if (!el) return

  dragOffset.value = {
    ...dragOffset.value,
    startX: clientX,
    startY: clientY,
    startWidth: el.width || 100,
    startHeight: el.height || 100,
    startFontSize: el.fontSize || 24,
  }
  interactionMode.value = 'resize'
}

function handleMove(e) {
  if (!interactionMode.value || !workspaceRef.value) return
  const { clientX, clientY } = getClientPos(e)

  if (interactionMode.value === 'marquee' && selectionBox.value) {
    const rect = workspaceRef.value.getBoundingClientRect()
    const currentX = (clientX - rect.left) / zoom.value
    const currentY = (clientY - rect.top) / zoom.value
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
    const deltaX = (clientX - dragOffset.value.x) / zoom.value
    const deltaY = (clientY - dragOffset.value.y) / zoom.value

    let snapOffsetX = 0
    let snapOffsetY = 0
    let newSnapLines = []
    const THRESHOLD = 8

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
        const domNode = document.getElementById(`element-${otherEl.id}`)
        const elRect = {
          x: otherEl.x,
          y: otherEl.y,
          width: domNode ? domNode.offsetWidth : (otherEl.width || 0),
          height: domNode ? domNode.offsetHeight : (otherEl.height || 0),
        }
        if (elRect.width === 0 && elRect.height === 0) return

        const targetXs = [elRect.x, elRect.x + elRect.width / 2, elRect.x + elRect.width]
        const targetYs = [elRect.y, elRect.y + elRect.height / 2, elRect.y + elRect.height]

        targetXs.forEach((tx) => dragXs.forEach((dx, idx) => {
          if (Math.abs(tx - dx) < THRESHOLD) {
            nextX = idx === 0 ? tx : idx === 1 ? tx - dragOffset.value.width / 2 : tx - dragOffset.value.width
            newSnapLines.push({ type: 'vertical', pos: tx })
          }
        }))

        targetYs.forEach((ty) => dragYs.forEach((dy, idx) => {
          if (Math.abs(ty - dy) < THRESHOLD) {
            nextY = idx === 0 ? ty : idx === 1 ? ty - dragOffset.value.height / 2 : ty - dragOffset.value.height
            newSnapLines.push({ type: 'horizontal', pos: ty })
          }
        }))
      })

      snapOffsetX = nextX - (dragOffset.value.startPositions[id].x + deltaX)
      snapOffsetY = nextY - (dragOffset.value.startPositions[id].y + deltaY)
      snapLines.value = newSnapLines.filter((v, i, arr) => arr.findIndex((t) => t.type === v.type && t.pos === v.pos) === i)
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
    const currentAngle = Math.atan2(clientY - dragOffset.value.centerY, clientX - dragOffset.value.centerX)
    const angleDiff = (currentAngle - dragOffset.value.startAngle) * (180 / Math.PI)
    updateElement(selectedIds.value[0], { rotation: dragOffset.value.startRotation + angleDiff })
  } else if (interactionMode.value === 'resize' && selectedIds.value.length === 1) {
    const diffX = (clientX - dragOffset.value.startX) / zoom.value
    const scaleFactor = 1 + diffX / 200
    const el = elements.value.find((item) => item.id === selectedIds.value[0])
    if (!el) return

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
  if (!interactionMode.value) return
  if (interactionMode.value === 'marquee') selectionBox.value = null
  interactionMode.value = null
  if (snapLines.value.length > 0) snapLines.value = []
}

function updateElement(id, newProps) {
  elements.value = elements.value.map((el) => (el.id === id ? { ...el, ...newProps } : el))
}

function deleteElement(id) {
  elements.value = elements.value.filter((el) => el.id !== id)
  selectedIds.value = selectedIds.value.filter((selectedId) => selectedId !== id)
}

function deleteGroup(e) {
  if (e) e.stopPropagation()
  elements.value = elements.value.filter((el) => !selectedIds.value.includes(el.id))
  selectedIds.value = []
}

function duplicateGroup(e) {
  if (e) e.stopPropagation()
  const newElements = []
  const newSelected = []
  for (const el of elements.value) {
    if (selectedIds.value.includes(el.id)) {
      const newId = `${Date.now()}${Math.random().toString(36).slice(2, 11)}`
      newElements.push({ ...el, id: newId, x: el.x + 20, y: el.y + 20 })
      newSelected.push(newId)
    }
  }
  elements.value = [...elements.value, ...newElements]
  selectedIds.value = newSelected
}

function getBoundingBox() {
  if (selectedIds.value.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  selectedIds.value.forEach((id) => {
    const el = elements.value.find((item) => item.id === id)
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
}

function handleAlign(type) {
  if (!workspaceRef.value || selectedIds.value.length === 0) return
  const isSingle = selectedIds.value.length === 1
  const canvasW = workspaceRef.value.offsetWidth
  const canvasH = workspaceRef.value.offsetHeight

  const bbox = isSingle
    ? { minX: 0, minY: 0, maxX: canvasW, maxY: canvasH, width: canvasW, height: canvasH }
    : getBoundingBox()

  if (!bbox) return

  elements.value = elements.value.map((el) => {
    if (!selectedIds.value.includes(el.id)) return el

    const domNode = document.getElementById(`element-${el.id}`)
    const w = domNode ? domNode.offsetWidth : (el.width || 100)
    const h = domNode ? domNode.offsetHeight : (el.height || 100)

    let newX = el.x
    let newY = el.y

    if (type === 'left') newX = bbox.minX
    if (type === 'center') newX = bbox.minX + bbox.width / 2 - w / 2
    if (type === 'right') newX = bbox.maxX - w
    if (type === 'top') newY = bbox.minY
    if (type === 'middle') newY = bbox.minY + bbox.height / 2 - h / 2
    if (type === 'bottom') newY = bbox.maxY - h

    return { ...el, x: newX, y: newY }
  })

  showMoreMenu.value = false
  moreMenuMode.value = 'main'
}

function addText() {
  const newId = `${Date.now()}`
  elements.value = [
    ...elements.value,
    {
      id: newId,
      type: 'text',
      content: '',
      x: 150,
      y: 200,
      fontSize: 24,
      color: '#2C2C2C',
      fontWeight: 'normal',
      rotation: 0,
      isItalic: false,
      isUnderline: false,
      isStrikethrough: false,
    },
  ]
  selectedIds.value = [newId]

  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    editingTextId.value = newId
    editModalText.value = ''
  }
}

function addImageElement(img) {
  const newId = `${Date.now()}`
  elements.value = [
    ...elements.value,
    {
      id: newId,
      type: 'image',
      src: img.src,
      name: img.name,
      x: 150,
      y: 150,
      width: 120,
      height: 120,
      rotation: 0,
    },
  ]
  selectedIds.value = [newId]
}

function handleApplyNameStickers() {
  if (!nameStickerText.value.trim()) return

  const cols = 4
  const rows = 4
  const canvasW = workspaceRef.value ? workspaceRef.value.offsetWidth : 600
  const canvasH = workspaceRef.value ? workspaceRef.value.offsetHeight : 400

  const paddingX = 50
  const paddingY = 50
  const gapX = (canvasW - paddingX * 2) / Math.max(1, cols - 1)
  const gapY = (canvasH - paddingY * 2) / Math.max(1, rows - 1)

  const newElements = []
  const newIds = []

  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      const newId = `name-${Date.now()}-${i}-${j}-${Math.random().toString(36).slice(2, 7)}`
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

function handleLayerDragStart(e, id) {
  e.dataTransfer.setData('text/plain', id)
  e.dataTransfer.effectAllowed = 'move'
}

function handleLayerDragOver(e, id) {
  e.preventDefault()
  if (dragOverId.value !== id) dragOverId.value = id
}

function handleLayerDrop(e, targetId) {
  e.preventDefault()
  dragOverId.value = null
  const draggedId = e.dataTransfer.getData('text/plain')
  if (!draggedId || draggedId === targetId) return

  const oldIndex = elements.value.findIndex((el) => el.id === draggedId)
  const newIndex = elements.value.findIndex((el) => el.id === targetId)
  if (oldIndex < 0 || newIndex < 0) return

  const result = [...elements.value]
  const [removed] = result.splice(oldIndex, 1)
  result.splice(newIndex, 0, removed)
  elements.value = result
}

function handleRecScroll() {
  if (!recommendScrollRef.value) return
  const { scrollLeft, scrollWidth, clientWidth } = recommendScrollRef.value
  const scrollRatio = scrollLeft / (scrollWidth - clientWidth || 1)
  const newPage = Math.min(3, Math.max(0, Math.round(scrollRatio * 3)))
  currentRecPage.value = newPage
}

function handleModeSelect(mode) {
  editorMode.value = mode
  if (mode === 'collage') {
    startupModal.value = 'paper'
    return
  }

  startupModal.value = 'none'
  if (mode === 'frame') {
    activeTab.value = 'frames'
    selectedFrame.value = mockFrames[0]
  } else if (mode === 'namesticker') {
    activeTab.value = 'namestickers'
    selectedFrame.value = mockNameStickers[0]
  }
}

function getTextDecoration(el) {
  const parts = []
  if (el.isUnderline) parts.push('underline')
  if (el.isStrikethrough) parts.push('line-through')
  return parts.length > 0 ? parts.join(' ') : 'none'
}
</script>

<template>
  <div
    class="flex flex-col h-screen bg-[#ECECEC] text-[#2C2C2C] overflow-hidden select-none"
    style="font-family: 'PingFang TC', sans-serif"
    @mousemove="handleMove"
    @touchmove="handleMove"
    @mouseup="handleMouseUp"
    @touchend="handleMouseUp"
  >
    <header class="h-16 relative bg-white border-b border-gray-200 flex items-center justify-between px-2 sm:px-4 z-50 shrink-0 shadow-sm">
      <div class="flex items-center space-x-2 sm:space-x-4">
        <img src="https://drive.google.com/thumbnail?id=1bphtTeKgT7SnqwCbKdobq2G142U751P2&sz=w500" alt="FamiPort Logo" class="h-6 sm:h-8 object-contain shrink-0">
        <div class="h-5 w-px bg-gray-300" />

        <div class="flex items-center shrink-0">
          <button class="flex items-center space-x-1 sm:space-x-2 text-gray-600 hover:text-[#2C2C2C] transition" @click="showLeaveModal = true">
            <X :size="20" />
            <span class="font-semibold text-sm">儲存並離開</span>
          </button>

          <div
            class="relative ml-1.5 hidden sm:flex items-center"
            @mouseenter="showSaveTooltip = true"
            @mouseleave="showSaveTooltip = false"
          >
            <HelpCircle
              :size="16"
              class="cursor-pointer transition-colors"
              :class="showSaveTooltip ? 'text-[#0078C8]' : 'text-gray-400 hover:text-gray-600'"
              @click="showSaveTooltip = !showSaveTooltip"
            />

            <div
              v-if="showSaveTooltip"
              class="absolute top-full mt-3 left-1/2 -translate-x-1/2 w-[240px] bg-[#2C2C2C] text-white text-[13px] px-3.5 py-2.5 rounded-lg shadow-xl leading-relaxed text-center z-[100] animate-in fade-in zoom-in duration-200 pointer-events-none"
            >
              登入後即可儲存設計於我的帳號頁面之「我的設計」。
              <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#2C2C2C] rotate-45 rounded-sm" />
            </div>
          </div>
        </div>

        <div class="h-5 w-px bg-gray-300 hidden sm:block" />
        <span class="text-sm font-medium text-gray-700 hidden lg:inline">
          {{ editorMode === 'frame' ? 'DIY套框' : editorMode === 'namesticker' ? 'DIY姓名貼' : 'DIY圖像拼貼' }}
        </span>

        <div class="hidden md:flex items-center space-x-3 shrink-0">
          <span class="text-[#0078C8] font-bold text-[15px] tracking-wide">${{ currentPrice }}/張</span>
        </div>
      </div>

      <div class="flex items-center space-x-2 sm:space-x-4 shrink-0">
        <div class="flex space-x-1 sm:space-x-3 text-gray-400">
          <button class="hover:text-[#2C2C2C] p-1"><Undo :size="20" /></button>
          <button class="hover:text-[#2C2C2C] p-1"><Redo :size="20" /></button>
        </div>
        <button class="flex items-center space-x-1 sm:space-x-2 text-gray-600 hover:text-[#2C2C2C] font-semibold text-sm transition" @click="showPreviewModal = true">
          <Eye :size="20" /><span class="hidden sm:inline">預覽</span>
        </button>
        <button class="bg-[#0078C8] text-white py-1.5 sm:py-2 px-3 sm:px-4 rounded-[100px] text-sm sm:text-base font-medium shadow-md hover:bg-[#0060a0] transition" @click="showReviewPage = true">
          下一步
        </button>
      </div>
    </header>

    <div class="flex flex-1 relative overflow-hidden">
      <div class="w-full md:w-[90px] absolute md:relative bottom-0 md:bottom-auto bg-white border-t md:border-t-0 md:border-r border-gray-200 flex flex-row md:flex-col items-center px-4 md:px-0 py-2 md:py-4 z-50 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] md:shadow-sm overflow-x-auto space-x-2 md:space-x-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <button
          v-if="editorMode === 'frame'"
          :class="sidebarButtonClass('frames')"
          @click="activeTab = 'frames'"
        >
          <LayoutTemplate :size="24" class="mb-1" :stroke-width="sidebarIconStroke('frames')" />
          <span :class="sidebarLabelClass('frames')">圖框樣式</span>
        </button>

        <button
          v-if="editorMode === 'namesticker'"
          :class="sidebarButtonClass('namestickers')"
          @click="activeTab = 'namestickers'"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-1">
            <path d="M8 4h11a2 2 0 0 1 2 2v10" opacity="0.6" />
            <rect x="3" y="8" width="14" height="12" rx="2" />
            <circle cx="7.5" cy="13" r="2" />
            <path d="M4 18.5c0-1.5 1.5-2.5 3.5-2.5s3.5 1 3.5 2.5" />
          </svg>
          <span :class="sidebarLabelClass('namestickers')">姓名貼</span>
        </button>

        <button
          v-if="editorMode === 'collage'"
          :class="sidebarButtonClass('paperSettings')"
          @click="activeTab = 'paperSettings'"
        >
          <Settings :size="24" class="mb-1" :stroke-width="sidebarIconStroke('paperSettings')" />
          <span :class="sidebarLabelClass('paperSettings')">紙材規格</span>
        </button>

        <button
          v-if="editorMode !== 'namesticker'"
          :class="sidebarButtonClass('uploads')"
          @click="activeTab = 'uploads'"
        >
          <Upload :size="24" class="mb-1" :stroke-width="sidebarIconStroke('uploads')" />
          <span :class="sidebarLabelClass('uploads')">照片上傳</span>
        </button>

        <button :class="sidebarButtonClass('text')" @click="activeTab = 'text'">
          <Type :size="24" class="mb-1" :stroke-width="sidebarIconStroke('text')" />
          <span :class="sidebarLabelClass('text')">新增文字</span>
        </button>

        <div class="w-px h-8 md:w-12 md:h-px bg-gray-200 mx-2 md:mx-0 md:my-2 shrink-0" />

        <button
          v-if="editorMode !== 'namesticker'"
          :class="sidebarButtonClass('icons')"
          @click="activeTab = 'icons'"
        >
          <ImageIcon2 :size="24" class="mb-1" :stroke-width="sidebarIconStroke('icons')" />
          <span :class="sidebarLabelClass('icons')">圖像庫</span>
        </button>

        <button :class="sidebarButtonClass('layers')" @click="activeTab = 'layers'">
          <Layers :size="24" class="mb-1" :stroke-width="sidebarIconStroke('layers')" />
          <span :class="sidebarLabelClass('layers')">圖層</span>
        </button>
      </div>

      <div
        class="absolute left-0 md:left-[106px] bottom-[72px] md:bottom-4 top-auto md:top-4 h-[60vh] md:h-auto w-full md:w-[340px] bg-white rounded-t-2xl md:rounded-b-2xl md:rounded-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] md:shadow-xl z-40 md:z-30 border border-gray-100 overflow-hidden flex flex-col transition-all duration-300"
        :class="activeTab === '' ? 'opacity-0 pointer-events-none translate-y-10 md:translate-y-0 md:translate-x-[-10px]' : 'opacity-100 translate-y-0 md:translate-x-0'"
      >
        <div class="px-6 py-5 flex items-center justify-between border-b border-gray-50">
          <h2 class="text-lg font-bold">{{ activePanelTitle }}</h2>
          <button class="text-gray-500 hover:text-[#2C2C2C] bg-white p-1 rounded-full" @click="activeTab = ''"><X :size="18" /></button>
        </div>

        <div class="flex-1 overflow-y-auto p-6 relative">
          <div v-if="activeTab === 'frames'" class="space-y-4">
            <div class="relative mb-6">
              <Search :size="18" class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input v-model="frameSearch" type="text" placeholder="搜尋圖框..." class="w-full bg-gray-100 text-[#2C2C2C] text-sm rounded-full pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0078C8] focus:bg-white transition">
            </div>
            <div class="flex justify-between items-center mb-2"><h3 class="text-sm font-bold text-gray-700">推薦套框</h3></div>
            <div class="grid grid-cols-2 gap-4">
              <div v-for="frame in filteredFrames" :key="frame.id" class="flex flex-col items-center">
                <div
                  class="cursor-pointer rounded-xl overflow-hidden border-2 transition-all bg-white shadow-sm flex items-center justify-center p-1 w-full"
                  :class="[
                    selectedFrame?.id === frame.id ? 'border-[#0078C8] ring-2 ring-[#0078C8]/20' : 'border-gray-200 hover:border-gray-300',
                    frame.aspect === '2/3' ? 'aspect-[2/3]' : 'aspect-[3/2]',
                  ]"
                  @click="selectedFrame = frame"
                >
                  <img :src="frame.src" :alt="frame.name" class="w-full h-full object-contain">
                </div>
                <span class="text-[11px] text-gray-600 mt-1.5 truncate w-full text-center font-medium">{{ frame.name }}</span>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'namestickers'" class="space-y-4">
            <div class="flex justify-between items-center mb-2"><h3 class="text-sm font-bold text-gray-700">選擇貼紙款式</h3></div>
            <div class="grid grid-cols-2 gap-4">
              <div v-for="sticker in mockNameStickers" :key="sticker.id" class="flex flex-col items-center">
                <div
                  class="cursor-pointer rounded-xl overflow-hidden border-2 transition-all bg-white shadow-sm flex items-center justify-center p-1 w-full"
                  :class="[
                    selectedFrame?.id === sticker.id ? 'border-[#0078C8] ring-2 ring-[#0078C8]/20' : 'border-gray-200 hover:border-gray-300',
                    sticker.aspect === '2/3' ? 'aspect-[2/3]' : 'aspect-[3/2]',
                  ]"
                  @click="selectedFrame = sticker"
                >
                  <img :src="sticker.src" :alt="sticker.name" class="w-full h-full object-cover rounded-md opacity-90">
                </div>
                <span class="text-[11px] text-gray-600 mt-1.5 truncate w-full text-center font-medium">{{ sticker.name }}</span>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'paperSettings'" class="space-y-8">
            <div>
              <h3 class="text-[15px] font-bold text-[#4A4A4A] mb-4">紙張尺寸與種類</h3>
              <div class="grid grid-cols-2 gap-3">
                <button
                  v-for="spec in ['4x6相紙', '4x6貼紙', 'A4特殊紙', 'A3一般用紙', 'A4一般用紙']"
                  :key="spec"
                  class="h-[40px] w-full rounded-[100px] border text-[14px] transition-all flex items-center justify-center tracking-wide"
                  :class="paperSpec.size === spec ? 'border-[#0078C8] bg-[#EAF7FF] text-[#2C2C2C] font-bold' : 'border-gray-200 text-[#4A4A4A] hover:bg-gray-50'"
                  @click="paperSpec = { ...paperSpec, size: spec }"
                >
                  {{ spec }}
                </button>
              </div>
            </div>

            <div>
              <h3 class="text-[15px] font-bold text-[#4A4A4A] mb-4">列印方向</h3>
              <div class="grid grid-cols-2 gap-3">
                <button
                  v-for="dir in ['直式', '橫式']"
                  :key="dir"
                  class="h-[40px] w-full rounded-[100px] border text-[14px] transition-all flex items-center justify-center tracking-wide"
                  :class="paperSpec.orientation === dir ? 'border-[#0078C8] bg-[#EAF7FF] text-[#2C2C2C] font-bold' : 'border-gray-200 text-[#4A4A4A] hover:bg-gray-50'"
                  @click="paperSpec = { ...paperSpec, orientation: dir }"
                >
                  {{ dir }}
                </button>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'text'" class="flex flex-col h-full pb-20">
            <div v-if="editorMode === 'namesticker'" class="mb-6 border-b border-gray-200 pb-6 shrink-0 text-left">
              <h3 class="text-[16px] font-bold text-[#2C2C2C] mb-3">姓名貼設定</h3>
              <div class="flex items-center space-x-3">
                <div class="flex-1 flex items-center justify-between bg-white border border-gray-300 rounded-full px-4 py-2 focus-within:border-[#0078C8] transition-colors">
                  <input v-model="nameStickerText" type="text" class="bg-transparent border-none focus:outline-none text-[#2C2C2C] text-[16px] w-full" placeholder="輸入姓名">
                  <button class="p-0.5 shrink-0 ml-2 outline-none flex items-center justify-center" title="清除" @click="nameStickerText = ''">
                    <div class="w-[18px] h-[18px] bg-[#AFAFAF] hover:bg-gray-500 transition-colors rounded-full flex items-center justify-center text-white">
                      <X :size="12" :stroke-width="3" />
                    </div>
                  </button>
                </div>
                <button class="px-6 py-2.5 bg-white border border-[#0078c9] text-[#0078c9] text-[16px] rounded-full font-bold flex items-center justify-center transition hover:bg-[#EAF7FF] shrink-0 outline-none" @click="handleApplyNameStickers">
                  <span>套用姓名</span>
                </button>
              </div>
            </div>

            <div class="flex flex-col flex-1 overflow-hidden">
              <p class="text-sm text-gray-500 mb-4 shrink-0 text-left">在下方編輯您的文字。</p>
              <div class="mb-4 shrink-0">
                <button class="w-full py-2.5 bg-[#0078c9] text-white text-[16px] rounded-[100px] font-bold flex items-center justify-center space-x-2" @click="addText">
                  <span>新增文字區塊</span>
                </button>
              </div>

              <div class="flex-1 overflow-y-auto space-y-1 pr-1">
                <div
                  v-for="el in textElements"
                  :key="el.id"
                  class="flex items-center justify-between mb-2 transition-all"
                  :class="selectedIds.includes(el.id) ? '' : 'border-b border-gray-300'"
                  @click="(e) => e.shiftKey ? handleElementDown(e, el.id) : (selectedIds = [el.id])"
                >
                  <div class="flex-1" :class="selectedIds.includes(el.id) ? 'border-2 border-[#0078C8] px-2 py-1.5' : 'py-2'">
                    <input
                      :id="`text-input-${el.id}`"
                      type="text"
                      :value="el.content"
                      class="block bg-transparent border-none focus:outline-none text-[#2C2C2C] text-sm w-full"
                      placeholder="請輸入文字"
                      @input="updateElement(el.id, { content: $event.target.value })"
                    >
                  </div>

                  <div v-if="selectedIds.includes(el.id) && selectedIds.length === 1" class="flex space-x-1 shrink-0 ml-3">
                    <button class="text-[#2C2C2C] hover:text-[#0078C8] p-1" @click="duplicateGroup"><Copy :size="20" /></button>
                    <button class="text-[#2C2C2C] hover:text-red-500 p-1" @click="deleteGroup"><Trash2 :size="20" /></button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'icons'" class="flex flex-col h-full space-y-6">
            <div class="relative shrink-0">
              <Search :size="18" class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input v-model="iconSearch" type="text" placeholder="搜尋圖像..." class="w-full bg-gray-100 text-[#2C2C2C] text-sm rounded-full pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0078C8] focus:bg-white transition">
            </div>

            <div class="shrink-0 w-full overflow-hidden">
              <div class="flex justify-between items-center mb-3"><h3 class="text-[16px] font-bold text-[#4A4A4A]">推薦圖像</h3></div>
              <div class="relative group/slider w-full">
                <div class="absolute left-0 top-1/2 -translate-y-1/2 z-10 pl-0.5 pointer-events-none -mt-3">
                  <button class="pointer-events-auto bg-white/95 backdrop-blur-sm rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.1)] w-9 h-9 flex items-center justify-center text-[#0078C8] hover:scale-105 transition-transform" @click.stop="recommendScrollRef?.scrollBy({ left: -150, behavior: 'smooth' })">
                    <ChevronLeft :size="22" :stroke-width="2.5" />
                  </button>
                </div>

                <div
                  ref="recommendScrollRef"
                  class="flex space-x-3 overflow-x-auto pb-2 pt-1 scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] w-full px-[2px]"
                  @scroll="handleRecScroll"
                  @wheel="(e) => { if (recommendScrollRef) recommendScrollRef.scrollLeft += e.deltaY }"
                >
                  <div v-for="img in mockRecommendedImages" :key="img.id" class="relative shrink-0 cursor-pointer group" @click="addImageElement(img)">
                    <div class="w-[74px] h-[74px] bg-white border-2 border-gray-100/80 rounded-[20px] overflow-hidden group-hover:border-[#0078C8] transition shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                      <img :src="img.src" :alt="img.name" class="w-full h-full object-contain p-1">
                    </div>
                  </div>
                </div>

                <div class="absolute right-0 top-1/2 -translate-y-1/2 z-10 pr-0.5 pointer-events-none -mt-3">
                  <button class="pointer-events-auto bg-white/95 backdrop-blur-sm rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.1)] w-9 h-9 flex items-center justify-center text-[#0078C8] hover:scale-105 transition-transform" @click.stop="recommendScrollRef?.scrollBy({ left: 150, behavior: 'smooth' })">
                    <ChevronRight :size="22" :stroke-width="2.5" />
                  </button>
                </div>
              </div>

              <div class="flex justify-center items-center space-x-1.5 mt-2">
                <div v-for="idx in [0, 1, 2, 3]" :key="idx" class="h-2 rounded-full transition-all duration-300" :class="currentRecPage === idx ? 'w-5 bg-[#0078C8]' : 'w-2 bg-[#D1D5DB]'" />
              </div>
            </div>

            <div class="flex-1 overflow-y-auto">
              <h3 class="text-[15px] font-bold text-[#4A4A4A] mb-3">所有圖像</h3>
              <div class="grid grid-cols-3 gap-3">
                <div v-for="img in filteredGalleryImages" :key="img.id" class="flex flex-col items-center group" @click="addImageElement(img)">
                  <div class="w-full aspect-square bg-white border border-gray-200 rounded-xl overflow-hidden cursor-pointer group-hover:ring-2 group-hover:ring-[#0078C8] p-1 shadow-sm transition flex items-center justify-center">
                    <img :src="img.src" :alt="img.name" class="w-full h-full object-cover rounded-lg">
                  </div>
                  <span class="text-[11px] text-gray-500 group-hover:text-[#0078C8] transition mt-1.5 truncate w-full text-center font-medium">{{ img.name }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'uploads'" class="space-y-4">
            <button class="w-full py-2.5 bg-[#0078c9] text-white text-[16px] rounded-[100px] font-bold flex items-center justify-center space-x-2" @click="fileInputRef?.click()">
              <Upload :size="18" /><span>從這個裝置上傳照片</span>
            </button>
            <button class="w-full py-2.5 bg-white border border-[#0078c9] text-[#0078c9] text-[16px] rounded-[100px] font-bold flex items-center justify-center space-x-2 hover:bg-gray-50 transition" @click="showQRCodeModal = true">
              <Scan :size="18" /><span>從手機上傳照片</span>
            </button>
            <div class="grid grid-cols-2 gap-3">
              <div v-for="(url, idx) in uploads" :key="idx" class="aspect-square border border-gray-200 rounded-xl overflow-hidden cursor-pointer bg-gray-50 shadow-sm" @click="bgImage = url">
                <img :src="url" alt="upload" class="w-full h-full object-cover">
              </div>
            </div>
            <input ref="fileInputRef" type="file" accept="image/*" class="hidden" @change="handleFileUpload">
          </div>

          <div v-if="activeTab === 'layers'" class="space-y-3">
            <div v-if="elements.length === 0" class="text-center text-gray-400 text-sm py-4">目前沒有圖層</div>
            <div
              v-for="el in reversedElements"
              :key="el.id"
              draggable="true"
              class="flex items-center bg-[#f4f5f7] rounded-xl p-4 cursor-grab border text-left"
              :class="selectedIds.includes(el.id) ? 'border-[#0078C8] bg-white shadow-md' : 'border-transparent'"
              @dragstart="handleLayerDragStart($event, el.id)"
              @dragover="handleLayerDragOver($event, el.id)"
              @drop="handleLayerDrop($event, el.id)"
              @click="selectedIds = [el.id]"
            >
              <div class="w-1 h-6 bg-gray-300 rounded-full mr-4 shrink-0 pointer-events-none" />
              <span class="text-sm font-medium truncate flex-1 pointer-events-none">{{ el.type === 'text' ? (el.content || '文字區塊') : (el.name || '圖像') }}</span>
              <button class="text-gray-400 hover:text-red-500 p-1 shrink-0 ml-2" title="刪除圖層" @click.stop="deleteElement(el.id)">
                <Trash2 :size="16" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="showTextToolbar"
        class="absolute top-6 left-1/2 md:left-[calc(50%+170px)] transform -translate-x-1/2 bg-white px-3 py-2 md:py-0 md:px-4 md:h-12 rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.12)] border border-gray-200 flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3 z-50 animate-in slide-in-from-top-4 w-[90%] sm:w-auto max-w-[340px] md:max-w-none"
        @mousedown.stop
        @touchstart.stop
      >
        <div class="flex items-center justify-center space-x-2 md:space-x-3 w-full md:w-auto">
          <div class="flex shrink-0 items-center border border-gray-300 rounded-md px-2 md:px-3 py-1.5 cursor-pointer hover:bg-gray-50">
            <span class="text-sm font-medium mr-4 md:mr-8">PingFang TC</span>
            <ChevronDown :size="14" class="text-gray-500" />
          </div>
          <div class="w-px h-5 bg-gray-300 shrink-0" />
          <div class="flex shrink-0 items-center space-x-1 border border-gray-300 rounded-md p-0.5">
            <button class="p-1 hover:bg-gray-100 rounded text-gray-600" @click="elements = elements.map(el => (selectedIds.includes(el.id) && el.type === 'text') ? { ...el, fontSize: Math.max(8, el.fontSize - 1) } : el)"><Minus :size="14" :stroke-width="2.5" /></button>
            <div class="px-1 md:px-2 py-1 text-sm w-8 md:w-12 text-center font-medium">{{ firstSelectedText?.fontSize }}</div>
            <button class="p-1 hover:bg-gray-100 rounded text-gray-600" @click="elements = elements.map(el => (selectedIds.includes(el.id) && el.type === 'text') ? { ...el, fontSize: el.fontSize + 1 } : el)"><Plus :size="14" :stroke-width="2.5" /></button>
          </div>
          <div class="hidden md:block w-px h-5 bg-gray-300 shrink-0" />
        </div>

        <div class="flex items-center justify-center space-x-2 md:space-x-3 w-full md:w-auto">
          <div class="w-7 h-7 shrink-0 rounded-full border-2 border-gray-200 cursor-pointer overflow-hidden relative shadow-sm hover:scale-105 transition-transform" :style="{ backgroundColor: firstSelectedText?.color }" title="選擇顏色">
            <input type="color" class="absolute -top-2 -left-2 w-12 h-12 cursor-pointer opacity-0" :value="firstSelectedText?.color || '#000000'" @input="elements = elements.map(el => (selectedIds.includes(el.id) && el.type === 'text') ? { ...el, color: $event.target.value } : el)">
          </div>
          <div class="w-px h-5 bg-gray-300 shrink-0" />
          <div class="flex shrink-0 items-center space-x-1">
            <button class="p-1.5 rounded transition" :class="firstSelectedText?.fontWeight === 'bold' ? 'bg-gray-200 text-black' : 'text-gray-600 hover:bg-gray-100'" @click="elements = elements.map(el => (selectedIds.includes(el.id) && el.type === 'text') ? { ...el, fontWeight: firstSelectedText?.fontWeight === 'bold' ? 'normal' : 'bold' } : el)"><Bold :size="18" /></button>
            <button class="p-1.5 rounded transition" :class="firstSelectedText?.isItalic ? 'bg-gray-200 text-black' : 'text-gray-600 hover:bg-gray-100'" @click="elements = elements.map(el => (selectedIds.includes(el.id) && el.type === 'text') ? { ...el, isItalic: !firstSelectedText?.isItalic } : el)"><Italic :size="18" /></button>
            <button class="p-1.5 rounded transition" :class="firstSelectedText?.isUnderline ? 'bg-gray-200 text-black' : 'text-gray-600 hover:bg-gray-100'" @click="elements = elements.map(el => (selectedIds.includes(el.id) && el.type === 'text') ? { ...el, isUnderline: !firstSelectedText?.isUnderline } : el)"><Underline :size="18" /></button>
            <button class="p-1.5 rounded transition" :class="firstSelectedText?.isStrikethrough ? 'bg-gray-200 text-black' : 'text-gray-600 hover:bg-gray-100'" @click="elements = elements.map(el => (selectedIds.includes(el.id) && el.type === 'text') ? { ...el, isStrikethrough: !firstSelectedText?.isStrikethrough } : el)"><Strikethrough :size="18" /></button>
          </div>
        </div>
      </div>

      <div class="flex-1 relative z-10 flex items-center justify-center pb-[80px] md:pb-0 md:pl-[340px]">
        <div class="absolute bottom-[90px] md:bottom-6 right-4 md:right-6 bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.1)] border border-gray-100 flex items-center px-1 py-1.5 z-30 md:z-40">
          <button class="p-1.5 hover:bg-gray-100 rounded-lg text-black transition" title="縮小" @click.stop="zoom = Math.max(0.1, zoom - 0.1)"><Minus :size="18" :stroke-width="2.5" /></button>
          <span class="text-[15px] font-bold text-black min-w-[3.5rem] text-center select-none">{{ Math.round(zoom * 100) }}%</span>
          <button class="p-1.5 hover:bg-gray-100 rounded-lg text-black transition" title="放大" @click.stop="zoom = Math.min(3, zoom + 0.1)"><Plus :size="18" :stroke-width="2.5" /></button>
        </div>

        <button class="absolute bottom-[90px] md:bottom-6 left-4 md:left-[364px] bg-white rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.1)] border border-gray-100 w-10 h-10 flex items-center justify-center text-[#0078C8] hover:bg-[#EAF7FF] transition-colors z-30 md:z-40" title="切換編輯模式" @click.stop="startupModal = 'mode'">
          <Info :size="20" :stroke-width="2.5" />
        </button>

        <div
          ref="workspaceRef"
          class="relative shadow-2xl bg-white transition-transform duration-200 rounded-sm w-full touch-none"
          :class="canvasMaxWidthClass"
          :style="{ transform: `scale(${zoom})`, transformOrigin: 'center center', aspectRatio: currentAspectRatio }"
          @mousedown="handleCanvasDown"
          @touchstart="handleCanvasDown"
        >
          <img :src="bgImage" class="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none" alt="底圖">
          <img v-if="editorMode !== 'collage' && selectedFrame" :src="selectedFrame.src" class="absolute inset-0 w-full h-full object-fill z-10 pointer-events-none" alt="套框">

          <div
            v-if="selectionBox"
            class="absolute border-[#0078C8] bg-[#0078C8]/10 pointer-events-none z-50"
            :style="{
              left: Math.min(selectionBox.startX, selectionBox.endX) + 'px',
              top: Math.min(selectionBox.startY, selectionBox.endY) + 'px',
              width: Math.abs(selectionBox.endX - selectionBox.startX) + 'px',
              height: Math.abs(selectionBox.endY - selectionBox.startY) + 'px',
              borderWidth: '1px',
            }"
          />

          <div
            v-for="(line, idx) in snapLines"
            :key="idx"
            class="absolute bg-[#0078C8] z-15 pointer-events-none opacity-80"
            :class="line.type === 'vertical' ? 'top-0 bottom-0 w-[1px]' : 'left-0 right-0 h-[1px]'"
            :style="line.type === 'vertical' ? { left: `${line.pos}px` } : { top: `${line.pos}px` }"
          />

          <div class="absolute inset-0 z-20 pointer-events-none">
            <div
              v-for="el in elements"
              :id="`element-${el.id}`"
              :key="el.id"
              class="absolute pointer-events-auto flex items-center justify-center transition-shadow"
              :class="selectedIds.includes(el.id) ? 'z-30 cursor-move border border-[#4CC032]' : ''"
              :style="{
                left: `${el.x}px`,
                top: `${el.y}px`,
                transform: `rotate(${el.rotation || 0}deg)`,
                fontSize: `${el.fontSize}px`,
                color: el.color,
                fontWeight: el.fontWeight,
                fontStyle: el.isItalic ? 'italic' : 'normal',
                textDecoration: getTextDecoration(el),
              }"
              @mousedown="handleElementDown($event, el.id)"
              @touchstart="handleElementDown($event, el.id)"
              @click.stop
            >
              <div v-if="el.type === 'text'" class="whitespace-nowrap px-2 py-1 min-w-[20px] min-h-[28px]">{{ el.content }}</div>
              <img v-else :src="el.src" :style="{ width: `${el.width}px`, height: `${el.height}px` }" class="object-cover pointer-events-none" alt="item">

              <template v-if="selectedIds.length === 1 && selectedIds.includes(el.id)">
                <div class="absolute -top-[5px] -left-[5px] w-[10px] h-[10px] bg-white border-[1.5px] border-[#4CC032] rounded-full" />
                <div class="absolute -top-[5px] -right-[5px] w-[10px] h-[10px] bg-white border-[1.5px] border-[#4CC032] rounded-full" />
                <div class="absolute -bottom-[5px] -left-[5px] w-[10px] h-[10px] bg-white border-[1.5px] border-[#4CC032] rounded-full" />
                <div class="absolute -bottom-[5px] -right-[5px] w-[10px] h-[10px] bg-white border-[1.5px] border-[#4CC032] rounded-full" />
              </template>
            </div>
          </div>

          <div
            v-if="selectedIds.length > 0 && groupBBox"
            class="absolute z-[60] pointer-events-auto flex items-center justify-center"
            :style="{
              left: `${groupBBox.minX + groupBBox.width / 2}px`,
              top: `${groupBBox.minY - 55}px`,
              transform: 'translateX(-50%)',
            }"
          >
            <div class="bg-white rounded-lg shadow-xl border border-gray-200 p-1 flex items-center space-x-1 relative" @mousedown.stop @touchstart.stop>
              <button class="p-1.5 hover:bg-gray-100 rounded text-gray-700 transition" title="複製" @click="duplicateGroup"><Copy :size="16" /></button>
              <button class="p-1.5 hover:bg-gray-100 rounded text-red-500 transition" title="刪除" @click="deleteGroup"><Trash2 :size="16" /></button>
              <div class="w-px h-4 bg-gray-200 mx-1" />
              <button class="p-1.5 rounded transition" :class="showMoreMenu ? 'bg-gray-200' : 'hover:bg-gray-100'" @click="showMoreMenu = !showMoreMenu"><MoreHorizontal :size="16" /></button>

              <div v-if="showMoreMenu" class="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-xl border border-gray-200 py-3 flex flex-col z-50 w-[150px]">
                <button class="px-5 py-2 text-[16px] font-semibold text-[#1A1A1A] hover:bg-gray-50 flex items-center space-x-4 text-left transition-colors" @click="handleAlign('left')"><span>靠左</span></button>
                <button class="px-5 py-2 text-[16px] font-semibold text-[#1A1A1A] hover:bg-gray-50 flex items-center space-x-4 text-left transition-colors" @click="handleAlign('center')"><span>水平置中</span></button>
                <button class="px-5 py-2 text-[16px] font-semibold text-[#1A1A1A] hover:bg-gray-50 flex items-center space-x-4 text-left transition-colors" @click="handleAlign('right')"><span>靠右</span></button>
                <div class="h-px bg-gray-200 my-2 mx-4" />
                <button class="px-5 py-2 text-[16px] font-semibold text-[#1A1A1A] hover:bg-gray-50 flex items-center space-x-4 text-left transition-colors" @click="handleAlign('top')"><span>靠上</span></button>
                <button class="px-5 py-2 text-[16px] font-semibold text-[#1A1A1A] hover:bg-gray-50 flex items-center space-x-4 text-left transition-colors" @click="handleAlign('middle')"><span>垂直置中</span></button>
                <button class="px-5 py-2 text-[16px] font-semibold text-[#1A1A1A] hover:bg-gray-50 flex items-center space-x-4 text-left transition-colors" @click="handleAlign('bottom')"><span>靠下</span></button>
              </div>
            </div>
          </div>

          <div
            v-if="selectedIds.length === 1 && groupBBox"
            class="absolute z-50 pointer-events-auto flex space-x-4"
            :style="{
              left: `${groupBBox.minX + groupBBox.width / 2}px`,
              top: `${groupBBox.maxY + 15}px`,
              transform: 'translateX(-50%)',
            }"
          >
            <div class="w-10 h-10 bg-white border border-gray-200 rounded-full shadow-lg flex items-center justify-center cursor-se-resize text-[#0078C8] hover:scale-110 transition-transform" @mousedown="handleResizeStart($event, selectedIds[0])" @touchstart="handleResizeStart($event, selectedIds[0])"><Move :size="20" :stroke-width="2.5" /></div>
            <div class="w-10 h-10 bg-white border border-gray-200 rounded-full shadow-lg flex items-center justify-center cursor-alias text-[#0078C8] hover:scale-110 transition-transform" @mousedown="handleRotateStart($event, selectedIds[0])" @touchstart="handleRotateStart($event, selectedIds[0])"><RotateCw :size="20" :stroke-width="2.5" /></div>
          </div>

          <div class="absolute bottom-4 right-4 bg-yellow-300 text-black px-3 py-1 font-bold text-[11px] shadow-sm rounded opacity-80 pointer-events-none">浮水印(FamiPort)</div>
        </div>
      </div>
    </div>

    <div v-if="showLeaveModal" class="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm" @touchend.stop @mouseup.stop>
      <div class="bg-white rounded-[24px] shadow-2xl p-8 w-full max-w-[360px] flex flex-col items-center animate-in zoom-in-95 text-center relative">
        <button class="absolute top-5 right-5 text-gray-400 hover:text-black transition" @click="showLeaveModal = false"><X :size="32" :stroke-width="1" /></button>
        <h2 class="text-[24px] font-bold text-[#2C2C2C] mb-3 mt-4 tracking-wide">確定放棄設計？</h2>
        <p class="text-[16px] text-gray-500 mb-8 font-medium">登入會員即可儲存設計。</p>
        <div class="flex justify-center space-x-4 w-full">
          <button class="w-[120px] h-[40px] bg-white text-[#4A4A4A] border border-gray-400 rounded-full font-medium transition hover:bg-gray-50 flex items-center justify-center" @click="showLeaveModal = false">登入 / 註冊</button>
          <button class="w-[120px] h-[40px] bg-[#2A75C9] text-white rounded-full font-medium shadow-sm transition hover:bg-[#1d5c9e] flex items-center justify-center" @click="showLeaveModal = false">確定離開</button>
        </div>
      </div>
    </div>

    <div v-if="startupModal === 'mode'" class="fixed inset-0 bg-black/60 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm" @touchend.stop @mouseup.stop>
      <div class="bg-white rounded-[24px] p-8 max-w-sm w-full shadow-2xl flex flex-col items-center relative animate-in zoom-in-95">
        <button v-if="editorMode" class="absolute top-5 right-5 text-gray-400 hover:text-black transition" @click="startupModal = 'none'"><X :size="32" :stroke-width="1" /></button>
        <h2 class="text-[22px] font-bold text-[#2C2C2C] mb-6">選擇編輯模式</h2>
        <div class="w-full space-y-3">
          <button class="w-full py-4 border-2 border-gray-100 rounded-xl font-bold text-[#4A4A4A] hover:border-[#0078C8] hover:bg-[#EAF7FF] hover:text-[#0078C8] transition-all text-lg shadow-sm" @click="handleModeSelect('frame')">圖框</button>
          <button class="w-full py-4 border-2 border-gray-100 rounded-xl font-bold text-[#4A4A4A] hover:border-[#0078C8] hover:bg-[#EAF7FF] hover:text-[#0078C8] transition-all text-lg shadow-sm" @click="handleModeSelect('namesticker')">姓名貼</button>
          <button class="w-full py-4 border-2 border-gray-100 rounded-xl font-bold text-[#4A4A4A] hover:border-[#0078C8] hover:bg-[#EAF7FF] hover:text-[#0078C8] transition-all text-lg shadow-sm" @click="handleModeSelect('collage')">圖像拼貼</button>
        </div>
      </div>
    </div>

    <div v-if="startupModal === 'paper'" class="fixed inset-0 bg-black/60 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm text-left" @touchend.stop @mouseup.stop>
      <div class="bg-white rounded-[24px] p-8 md:p-10 max-w-[640px] w-full shadow-2xl flex flex-col text-left relative animate-in zoom-in-95">
        <button class="absolute top-6 right-6 text-gray-400 hover:text-black transition" @click="startupModal = 'mode'"><X :size="32" :stroke-width="1" /></button>
        <h2 class="text-[28px] font-bold text-[#2C2C2C] mb-8 tracking-tight">編輯列印規格</h2>

        <div class="mb-6 w-full">
          <h3 class="text-[15px] font-bold text-[#2C2C2C] mb-4 text-left">紙張尺寸與種類</h3>
          <div class="grid grid-cols-3 gap-4 mb-4">
            <button v-for="s in ['4x6相紙', '4x6貼紙', 'A4特殊紙']" :key="s" class="h-[44px] rounded-full border text-[15px] transition-all flex items-center justify-center tracking-wide" :class="paperSpec.size === s ? 'border-[#0078C8] bg-[#EAF7FF] text-[#2C2C2C] font-bold' : 'border-gray-200 text-[#666666] hover:bg-gray-50'" @click="paperSpec = { ...paperSpec, size: s }">{{ s }}</button>
          </div>
          <div class="grid grid-cols-3 gap-4">
            <button v-for="s in ['A3一般用紙', 'A4一般用紙']" :key="s" class="h-[44px] rounded-full border text-[15px] transition-all flex items-center justify-center tracking-wide" :class="paperSpec.size === s ? 'border-[#0078C8] bg-[#EAF7FF] text-[#2C2C2C] font-bold' : 'border-gray-200 text-[#666666] hover:bg-gray-50'" @click="paperSpec = { ...paperSpec, size: s }">{{ s }}</button>
          </div>
        </div>

        <div class="mb-4 w-full">
          <h3 class="text-[16px] font-bold text-[#2C2C2C] mb-4 text-left">列印方向</h3>
          <div class="grid grid-cols-3 gap-4">
            <button v-for="d in ['直式', '橫式']" :key="d" class="h-[44px] rounded-full border text-[15px] transition-all flex items-center justify-center tracking-wide" :class="paperSpec.orientation === d ? 'border-[#0078C8] bg-[#EAF7FF] text-[#2C2C2C] font-bold' : 'border-gray-200 text-[#666666] hover:bg-gray-50'" @click="paperSpec = { ...paperSpec, orientation: d }">{{ d }}</button>
          </div>
        </div>

        <div class="mb-10 text-[#0078C8] font-bold text-[24px] tracking-wide text-left">${{ currentPrice }}</div>
        <div class="flex justify-center space-x-4">
          <button class="w-[120px] h-[40px] border border-gray-400 rounded-full font-medium text-[#4A4A4A] transition hover:bg-gray-50" @click="startupModal = 'mode'">取消</button>
          <button class="w-[120px] h-[40px] bg-[#2A75C9] text-white rounded-full font-medium shadow-md transition hover:bg-[#1d5c9e]" @click="startupModal = 'none'; activeTab = 'uploads'">確認</button>
        </div>
      </div>
    </div>

    <div v-if="showReviewPage" class="fixed inset-0 bg-[#F4F5F6] z-[120] flex flex-col md:flex-row overflow-hidden w-full h-full animate-in fade-in duration-300 text-left" @touchend.stop @mouseup.stop>
      <button class="md:hidden absolute top-4 right-4 text-gray-500 hover:text-black transition z-[130]" @click="showReviewPage = false"><X :size="32" :stroke-width="1" /></button>

      <div class="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
        <div class="relative shadow-[0_20px_50px_rgba(0,0,0,0.1)] bg-white rounded-sm overflow-hidden w-full" :class="reviewMaxWidthClass" :style="{ aspectRatio: currentAspectRatio }">
          <img :src="bgImage" class="absolute inset-0 w-full h-full object-cover" alt="preview">
          <img v-if="editorMode !== 'collage' && selectedFrame" :src="selectedFrame.src" class="absolute inset-0 w-full h-full object-fill z-10" alt="frame">
          <div class="absolute inset-0 z-20 pointer-events-none">
            <div v-for="el in elements" :key="el.id" class="absolute flex items-center justify-center" :style="{ left: `${el.x}px`, top: `${el.y}px`, transform: `rotate(${el.rotation || 0}deg)`, fontSize: `${el.fontSize}px`, color: el.color, fontWeight: el.fontWeight, fontStyle: el.isItalic ? 'italic' : 'normal', textDecoration: getTextDecoration(el) }">
              <template v-if="el.type === 'text'">{{ el.content }}</template>
              <img v-else :src="el.src" :style="{ width: `${el.width}px`, height: `${el.height}px` }" class="object-cover rounded shadow-sm" alt="sticker">
            </div>
          </div>
        </div>
      </div>

      <div class="w-full md:w-[480px] bg-white md:shadow-[-10px_0_30px_rgba(0,0,0,0.04)] p-6 md:p-12 pb-8 md:pb-12 flex flex-col relative shrink-0 overflow-y-auto rounded-t-[32px] md:rounded-none shadow-[0_-10px_20px_rgba(0,0,0,0.05)] md:shadow-none">
        <button class="hidden md:block absolute top-6 right-6 text-gray-400 hover:text-black transition text-left" @click="showReviewPage = false"><X :size="32" :stroke-width="1" /></button>

        <div class="mt-2 md:mt-4 text-left">
          <h2 class="text-[26px] md:text-[24px] font-bold text-[#2C2C2C] mb-5">請檢閱你的設計！</h2>

          <div class="md:hidden flex items-center space-x-4 mb-6">
            <span class="bg-[#EAF7FF] text-[#0078C8] px-4 py-1.5 rounded-xl text-[16px] font-medium tracking-wide">{{ editorMode === 'collage' ? paperSpec.size : '4x6' }} 彩色</span>
            <span class="text-[#0078C8] font-medium text-[28px]">NT$ {{ currentPrice }}</span>
          </div>

          <div class="hidden md:flex items-center space-x-3 mb-6">
            <span class="bg-[#EAF7FF] text-[#0078C8] px-3 py-1.5 rounded-[100px] text-[13px] font-bold tracking-wide">{{ editorMode === 'collage' ? paperSpec.size : '4x6' }} 彩色</span>
            <span class="text-[#0078C8] font-bold text-[20px]">NT$ {{ currentPrice }}</span>
          </div>

          <ul class="md:hidden space-y-2 text-[15px] text-[#4A4A4A] list-disc pl-5 marker:text-[#4A4A4A] font-medium leading-relaxed">
            <li>請確認設計與文字無誤</li>
            <li>產生列印碼後將無法修改。</li>
            <li class="text-[#0078C8]"><span class="underline underline-offset-4 cursor-pointer">登入會員即可將設計儲存至「我的設計」。</span></li>
          </ul>

          <ul class="hidden md:block space-y-3 text-[16px] text-[#4A4A4A] list-disc pl-5 marker:text-[#4A4A4A] font-medium leading-relaxed">
            <li>請確認設計與文字無誤</li>
            <li>產生列印碼後將無法修改。</li>
            <li>登入會員即可將設計儲存至「我的設計」。</li>
          </ul>
        </div>

        <div class="md:hidden mt-10 mb-2 flex flex-row space-x-3 w-full">
          <button class="flex-[0.8] py-3.5 bg-white text-[#4A4A4A] border border-gray-400 rounded-full font-medium text-[16px] active:bg-gray-50" @click="showReviewPage = false">繼續編輯</button>
          <button class="flex-[1.2] py-3.5 bg-[#0078C8] text-white rounded-full font-medium text-[16px] shadow-sm active:bg-[#0060a0]">確認：產生列印碼</button>
        </div>

        <div class="hidden md:block mt-auto pt-10 space-y-3.5">
          <button class="w-full py-3.5 bg-[#0078C8] text-white rounded-full font-bold text-[15px] shadow-sm hover:bg-[#0060a0] transition-all">確認：產生列印碼</button>
          <button class="w-full py-3.5 bg-white text-[#0078C8] border border-[#0078C8] rounded-full font-bold text-[15px] hover:bg-[#EAF7FF] transition-all" @click="showReviewPage = false">回去繼續編輯</button>
          <div class="flex items-center justify-center space-x-4 py-1"><div class="h-px bg-gray-200 w-10" /><span class="text-[12px] text-gray-400 font-medium">或</span><div class="h-px bg-gray-200 w-10" /></div>
          <button class="w-full py-3.5 bg-white text-[#0078C8] border border-[#0078C8] rounded-full font-bold text-[15px] hover:bg-[#EAF7FF] transition-all">登入 / 註冊儲存設計</button>
        </div>
      </div>
    </div>

    <div v-if="editingTextId" class="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 md:hidden backdrop-blur-sm" @touchend.stop @mouseup.stop>
      <div class="bg-white rounded-[24px] shadow-2xl p-6 w-full max-w-sm flex flex-col animate-in zoom-in-95 relative text-left">
        <button class="absolute top-5 right-5 text-gray-400 hover:text-black transition" @click="editingTextId = null"><X :size="32" :stroke-width="1" /></button>
        <h2 class="text-[24px] font-bold text-[#2C2C2C] mb-6 mt-2">新增文字</h2>
        <div class="relative mb-8">
          <textarea v-model="editModalText" class="w-full border border-gray-300 rounded-2xl p-4 min-h-[140px] focus:outline-none focus:border-[#0078C8] text-[16px] resize-none text-[#2C2C2C] bg-white pb-8" placeholder="請輸入文字" @input="editModalText = editModalText.substring(0, 30)" />
          <span class="absolute bottom-3 right-4 text-[13px] text-gray-400">{{ editModalText.length }}/30</span>
        </div>
        <div class="flex justify-center space-x-4 w-full">
          <button class="flex-1 bg-white text-[#4A4A4A] border border-gray-300 py-3 rounded-full font-bold text-[16px] transition active:bg-gray-50" @click="editingTextId = null">取消</button>
          <button class="flex-1 bg-[#1578c2] text-white py-3 rounded-full font-bold text-[16px] shadow-sm transition active:bg-[#0060a0]" @click="updateElement(editingTextId, { content: editModalText }); editingTextId = null">確認</button>
        </div>
      </div>
    </div>

    <div v-if="showPreviewModal" class="fixed inset-0 bg-black/70 z-[100] flex flex-col items-center justify-center p-4 backdrop-blur-md" @touchend.stop @mouseup.stop>
      <div class="bg-[#f0f2f5] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-w-4xl w-full max-h-[85vh] relative">
        <button class="absolute top-5 right-5 text-gray-400 hover:text-black transition-all z-[110]" title="關閉" @click="showPreviewModal = false"><X :size="32" :stroke-width="1" /></button>
        <div class="flex-1 relative flex items-center justify-center p-8 overflow-y-auto">
          <div class="relative bg-white shadow-xl rounded-sm overflow-hidden w-full" :class="previewMaxWidthClass" :style="{ aspectRatio: currentAspectRatio }">
            <img :src="bgImage" class="absolute inset-0 w-full h-full object-cover" alt="preview">
            <img v-if="editorMode !== 'collage' && selectedFrame" :src="selectedFrame.src" class="absolute inset-0 w-full h-full object-fill z-10" alt="frame">
            <div class="absolute inset-0 z-20 pointer-events-none">
              <div v-for="el in elements" :key="el.id" class="absolute flex items-center justify-center" :style="{ left: `${el.x}px`, top: `${el.y}px`, transform: `rotate(${el.rotation || 0}deg)`, fontSize: `${el.fontSize}px`, color: el.color, fontWeight: el.fontWeight, fontStyle: el.isItalic ? 'italic' : 'normal', textDecoration: getTextDecoration(el) }">
                <template v-if="el.type === 'text'">{{ el.content }}</template>
                <img v-else :src="el.src" :style="{ width: `${el.width}px`, height: `${el.height}px` }" class="object-cover rounded shadow-sm" alt="element">
              </div>
            </div>
          </div>
        </div>
        <div class="bg-white py-5 text-center font-bold text-xl border-t tracking-wide text-[#2C2C2C]">預覽成品</div>
      </div>
    </div>

    <div v-if="showQRCodeModal" class="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-[2px]" @touchend.stop @mouseup.stop>
      <div class="bg-white rounded-xl shadow-2xl flex flex-col w-[460px] max-w-full relative p-8">
        <button class="absolute top-4 right-4 w-8 h-8 bg-white border border-gray-300 rounded-md flex items-center justify-center text-[#2C2C2C] hover:bg-gray-100 transition-all" @click="showQRCodeModal = false"><X :size="20" :stroke-width="2" /></button>
        <h2 class="text-center font-bold text-[22px] mt-4 mb-6 tracking-tight text-[#1A1A1A]">Scan to upload from phone</h2>
        <div class="bg-[#F3F4F6] rounded-xl p-8 flex items-center justify-center mx-auto mb-6 w-[280px] h-[280px]">
          <img src="https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg" alt="QR Code" class="w-full h-full mix-blend-multiply">
        </div>
        <p class="text-center text-[13px] text-gray-500 font-medium mb-4">This upload URL will expire in 09:54</p>
      </div>
    </div>
  </div>
</template>