import { ref, shallowRef, watch, onMounted, onUnmounted, type Ref, type ShallowRef } from 'vue'
import jsPDF from 'jspdf'
import * as fabric from 'fabric'
import { FabricObject } from 'fabric'

// ================================================================
// 型別定義 (Type Definitions)
// ================================================================

/** Composable 對外可傳入的選項 */
export interface UseFabricCanvasOptions {
  /** localStorage 儲存鍵名 */
  storageKey?: string
  /** 浮水印文字 */
  watermarkText?: string

}

/** 物件的邊界資訊（含 padding） */
interface ObjectBounds {
  left: number
  top: number
  right: number
  bottom: number
  centerX: number
  centerY: number
}

/** 吸附用的邊線種類 */
type EdgeKindX = 'left' | 'centerX' | 'right'
type EdgeKindY = 'top' | 'centerY' | 'bottom'
type EdgeKind = EdgeKindX | EdgeKindY

/** 來自移動中物件的邊線資料 */
interface MovingEdge {
  value: number
  kind: EdgeKind
}

/** 其他物件提供的對齊候選邊線 */
interface AxisCandidate {
  value: number
  kind: EdgeKind
  bounds: ObjectBounds
}

/** 找到吸附目標時的回傳 */
interface NearestMatch {
  delta: number
  distance: number
  line: number
  candidateBounds: ObjectBounds
}

/** 垂直輔助線資料 */
interface SnapGuideX {
  x: number
  y1: number
  y2: number
}

/** 水平輔助線資料 */
interface SnapGuideY {
  y: number
  x1: number
  x2: number
}

/** PDF 頁面規格 */
interface PageSpec {
  pageWmm: number
  pageHmm: number
  pdfOrientation: 'portrait' | 'landscape'
  pdfFormat: [number, number]
}

/** 持久化於 localStorage 的狀態 */
interface PersistedState {
  canvasJSON: unknown
  canvasWidth: number
  canvasHeight: number
  stickerName: string
}

interface ObjectActionBarState {
  visible: boolean
  left: number
  top: number
}

type CanvasAlignAction = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

/** 給 sidebar 用的 fabric 物件 */
type FabricObj = fabric.FabricObject

/** 帶有自訂 role 的 fabric 物件（用於識別浮水印 / 照片等） */
type FabricObjWithRole = FabricObj & { objectRole?: string }

type GoodsType = 'nameSticker' | 'frame'
type NameStickerSpecKey = '4x6-landscape' | '4x6-portrait' | '4x5-landscape' | '4x5-portrait'

interface NameStickerLayoutConfig {
  columns: number
  rows: number
  marginLeftRatio: number
  marginTopRatio: number
  gapXRatio: number
  gapYRatio: number
}


// ================================================================
// useFabricCanvas
// ----------------------------------------------------------------
// 封裝 Fabric.js 畫布的 Composable，提供：
//   - 文字 / 圖片 / 照片的新增與樣式控制
//   - 自訂控制點（刪除 / 縮放旋轉）
//   - 物件對齊輔助線（吸附）
//   - Undo / Redo 與 localStorage 自動儲存
//   - 浮水印疊加與 PDF 匯出
//   - 姓名貼批次產生
// ================================================================
export function useFabricCanvas(options: UseFabricCanvasOptions = {}) {
  const SERIALIZE_PROPS: string[] = [
    'objectRole',
    'selectable',
    'evented',
    'hasControls',
    'hasBorders',
    'lockMovementX',
    'lockMovementY',
    'lockRotation',
    'lockScalingX',
    'lockScalingY',
    'lockSkewingX',
    'lockSkewingY',
  ]
  FabricObject.customProperties = SERIALIZE_PROPS
  // ============================================================
  // 一、設定與基本狀態 (Configuration & State)
  // ============================================================
  const storageKey = options.storageKey || 'fabric-canvas-default-state'
  const watermarkText = options.watermarkText || 'PREVIEW'
  const goodsType: Ref<GoodsType> = ref('nameSticker') // PDF 匯出時的商品名稱
  // DOM 參考：canvas 元素與其外層容器（容器用來計算縮放）
  const canvasEl = ref<HTMLCanvasElement | null>(null)
  const canvasContainerEl = ref<HTMLElement | null>(null)
  let canvas: fabric.Canvas | null = null            // Fabric Canvas 實例（非響應式）
  const frameObject = ref<FabricObj | null>(null)     // 底圖（畫框）物件
  const watermarkObject = ref<FabricObj | null>(null) // 浮水印物件（永遠保持在最上層）

  // 目前選取物件的狀態
  const activeIsText = ref<boolean>(false)
  const activeObject = ref<FabricObj | null>(null)
  const objectActionBar = ref<ObjectActionBarState>({ visible: false, left: 0, top: 0 })
  const objectActionMoreMenuOpen = ref<boolean>(false)

  // 文字樣式狀態（與工具列雙向綁定）
  const fontSize = ref<number>(64)
  const DEFAULT_TEXT_COLOR = '#222222'
  const fontColor = ref<string>(DEFAULT_TEXT_COLOR)
  const fontFamily = ref<string>('Noto Sans TC')
  const fontBold = ref<boolean>(false)
  const fontItalic = ref<boolean>(false)
  const fontUnderline = ref<boolean>(false)
  const fontLinethrough = ref<boolean>(false)
  const stickerName = ref<string>('')                 // 姓名貼用的姓名輸入

  // 常數：文字框內距、物件 role 識別、序列化時要保留的自訂屬性
  const TEXTBOX_PADDING_PX = 4
  const WATERMARK_ROLE = 'watermark-overlay'
  const FRAME_ROLE = 'frame-background'
  const PHOTO_ROLE = 'photo'

  // 姓名貼版型參數：目前主規格為 4x6 橫式，其餘先提供可微調的預設值
  const NAME_STICKER_LAYOUTS: Record<NameStickerSpecKey, NameStickerLayoutConfig> = {
    '4x6-landscape': {
      columns: 4,
      rows: 6,
      marginLeftRatio: 0.1,
      marginTopRatio: 0.06,
      gapXRatio: 0.18,
      gapYRatio: 0.1,
    },
    '4x6-portrait': {
      columns: 3,
      rows: 8,
      marginLeftRatio: 0.1,
      marginTopRatio: 0.08,
      gapXRatio: 0.16,
      gapYRatio: 0.08,
    },
    '4x5-landscape': {
      columns: 4,
      rows: 5,
      marginLeftRatio: 0.1,
      marginTopRatio: 0.08,
      gapXRatio: 0.18,
      gapYRatio: 0.12,
    },
    '4x5-portrait': {
      columns: 3,
      rows: 7,
      marginLeftRatio: 0.1,
      marginTopRatio: 0.1,
      gapXRatio: 0.16,
      gapYRatio: 0.1,
    },
  }



  // 工具列可選的字型清單
  const FONT_FAMILIES: readonly string[] = [
    'Arial',
    'Georgia',
    'Times New Roman',
    'Courier New',
    'Verdana',
    'Helvetica',
    'Tahoma',
    'Noto Sans TC',
    'Noto Serif TC',
    'Raleway', // 新增
  ]

  // Undo / Redo 堆疊與批次模式旗標（批次模式下不會記錄歷史）
  const undoStack = ref<unknown[]>([])
  const redoStack = ref<unknown[]>([])
  const isBatchMode = ref<boolean>(false)
  const hasPersistedState = ref<boolean>(false)       // 是否有儲存於 localStorage 的狀態

  // 物件清單（給側邊欄使用）與目前選取的索引
  // canvasObjects 改為帶 displayName 的物件
  const canvasObjects: ShallowRef<Array<FabricObj & { displayName: string }>> = shallowRef([])
  const activeObjectIndex = ref<number>(-1)

  // ============================================================
  // 二、物件清單同步 (Object List Sync)
  // ============================================================

  const getSidebarObjects = (): FabricObj[] => {
    if (!canvas) return []

    return canvas.getObjects().filter((obj) => {
      if (obj.selectable === false && !(obj.type === 'textbox' && (obj as fabric.Textbox).isEditing)) return false
      return true
    }) as FabricObj[]
  }

  /** 重新整理側邊欄物件清單，過濾掉不可選取的物件（如浮水印） */
  const refreshObjectList = (): void => {
    if (!canvas) {
      canvasObjects.value = []
      activeObjectIndex.value = -1
      return
    }
    const reversed = [...getSidebarObjects()].reverse()

    // 依物件型態決定顯示名稱
    const withNames: Array<FabricObj & { displayName: string }> = reversed.map((obj) => {
      let displayName = ''
      if (obj.type === 'textbox') {
        displayName = (obj as fabric.Textbox).text?.trim() || '文字框'
      } else if (obj.type === 'image') {
        // 圖片流水號
        const imageObjs = reversed.filter(o => o.type === 'image')
        const index = imageObjs.indexOf(obj) + 1
        // 嘗試從 obj 的 src 取出檔名
        const src = (obj as any).src || (obj as any).getSrc?.() || ''
        if (typeof src === 'string' && src) {
          try {
            displayName = `${decodeURIComponent(src.split('/').pop()?.split('?')[0] || '')} (${index})`
          } catch { displayName = `圖片${index}` }
        } else {
          displayName = `圖片${index}`
        }
      } else {
        displayName = obj.type || '物件'
      }
      return Object.assign(obj, { displayName }) as FabricObj & { displayName: string }
    })
    canvasObjects.value = withNames
    const active = canvas.getActiveObject()
    activeObjectIndex.value = active ? withNames.findIndex(item => item === active) : -1
  }

  // ============================================================
  // 三、畫布尺寸與縮放 (Canvas Size & Display Scale)
  // ============================================================
  // 內部 (internal) 尺寸 = Fabric 實際運算用的真實像素
  // 顯示 (display) 尺寸 = 縮放後呈現在畫面上的大小
  const canvasScale = ref<number>(1)
  const canvasInternalW = ref<number>(800)
  const canvasInternalH = ref<number>(500)
  const canvasDisplayW = ref<number>(800)
  const canvasDisplayH = ref<number>(500)

  watch(canvasScale, () => {
    requestAnimationFrame(() => updateObjectActionBarPosition())
  })

  // PDF 匯出大小上限 (20MB)
  const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024

  // ============================================================
  // 四、對齊輔助線 / 物件吸附 (Snap Guides)
  // ============================================================
  const SNAP_THRESHOLD_PX = 8                          // 觸發吸附的距離（像素）
  const SNAP_GUIDE_COLOR = 'rgba(0, 120, 200, 0.85)'   // 輔助線顏色
  const SNAP_GUIDE_WIDTH = 1                           // 輔助線寬度
  const SNAP_GUIDE_MARGIN = 12                         // 輔助線延伸的邊距
  const snapGuideX = ref<SnapGuideX | null>(null)       // 垂直輔助線資料
  const snapGuideY = ref<SnapGuideY | null>(null)       // 水平輔助線資料

  // 自訂控制點圖示 (左下角尺寸、右下角旋轉)
  const iconResize = new Image()
  iconResize.src = '/icons/scale.svg'

  const iconRotate = new Image()
  iconRotate.src = '/icons/edit.svg'

  /** 清除目前的輔助線（可選擇是否要立即重繪畫面） */
  const clearSnapGuides = (requestRender = false): void => {
    const hadGuides = !!snapGuideX.value || !!snapGuideY.value
    snapGuideX.value = null
    snapGuideY.value = null

    const c = canvas as (fabric.Canvas & { contextTop?: CanvasRenderingContext2D; clearContext?: (ctx: CanvasRenderingContext2D) => void }) | null
    if (c && c.contextTop && c.clearContext) {
      c.clearContext(c.contextTop)
    }

    if (requestRender && hadGuides && canvas) {
      canvas.requestRenderAll()
    }
  }

  const hideObjectActionBar = (): void => {
    objectActionBar.value = { visible: false, left: 0, top: 0 }
    objectActionMoreMenuOpen.value = false
  }

  const updateObjectActionBarPosition = (): void => {
    if (!canvas || !canvasEl.value) {
      hideObjectActionBar()
      return
    }

    const active = canvas.getActiveObject()
    if (!active || active.selectable === false || active.visible === false) {
      hideObjectActionBar()
      return
    }

    const bounds = active.getBoundingRect()
    const canvasRect = canvasEl.value.getBoundingClientRect()
    const widthRatio = canvasRect.width / canvas.getWidth()
    const heightRatio = canvasRect.height / canvas.getHeight()

    objectActionBar.value = {
      visible: true,
      left: canvasRect.left + (bounds.left + bounds.width / 2) * widthRatio,
      top: canvasRect.top + bounds.top * heightRatio - 12,
    }
  }

  const alignSelectionToCanvas = (action: CanvasAlignAction): void => {
    if (!canvas) return
    objectActionMoreMenuOpen.value = false

    const targets = (canvas.getActiveObjects?.() || []).filter(o => o !== frameObject.value)
    if (!targets.length) return

    const alignToCanvas = targets.length === 1
    const canvasW = canvas.getWidth()
    const canvasH = canvas.getHeight()
    const targetBounds = targets.map((obj) => ({ obj, bounds: obj.getBoundingRect() }))
    const groupBounds = {
      left: Math.min(...targetBounds.map((item) => item.bounds.left)),
      right: Math.max(...targetBounds.map((item) => item.bounds.left + item.bounds.width)),
      top: Math.min(...targetBounds.map((item) => item.bounds.top)),
      bottom: Math.max(...targetBounds.map((item) => item.bounds.top + item.bounds.height)),
    }
    const groupCenterX = (groupBounds.left + groupBounds.right) / 2
    const groupCenterY = (groupBounds.top + groupBounds.bottom) / 2
    canvas.discardActiveObject()

    targetBounds.forEach(({ obj, bounds }) => {
      let nextLeft = obj.left ?? 0
      let nextTop = obj.top ?? 0

      if (action === 'left') {
        nextLeft += (alignToCanvas ? 0 : groupBounds.left) - bounds.left
      } else if (action === 'center') {
        const targetCenter = alignToCanvas ? canvasW / 2 : groupCenterX
        nextLeft += targetCenter - (bounds.left + bounds.width / 2)
      } else if (action === 'right') {
        const targetRight = alignToCanvas ? canvasW : groupBounds.right
        nextLeft += targetRight - (bounds.left + bounds.width)
      } else if (action === 'top') {
        nextTop += (alignToCanvas ? 0 : groupBounds.top) - bounds.top
      } else if (action === 'middle') {
        const targetCenter = alignToCanvas ? canvasH / 2 : groupCenterY
        nextTop += targetCenter - (bounds.top + bounds.height / 2)
      } else if (action === 'bottom') {
        const targetBottom = alignToCanvas ? canvasH : groupBounds.bottom
        nextTop += targetBottom - (bounds.top + bounds.height)
      }

      obj.set({ left: nextLeft, top: nextTop })
      obj.setCoords()
    })

    if (targets.length === 1) {
      canvas.setActiveObject(targets[0]!)
    } else {
      canvas.setActiveObject(new fabric.ActiveSelection(targets, { canvas }))
    }

    updateObjectActionBarPosition()
    keepWatermarkOnTop()
    canvas.renderAll()
    saveState()
  }

  /** 取得物件的外框（含 padding），並計算左/右/中心點等資訊供吸附使用 */
  const getObjectBounds = (obj: FabricObj | null | undefined): ObjectBounds | null => {
    if (!obj || !obj.getBoundingRect) return null

    const rect = obj.getBoundingRect()
    const padding = obj.padding || 0
    const left = rect.left - padding
    const top = rect.top - padding
    const width = rect.width + padding * 2
    const height = rect.height + padding * 2

    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
      centerX: left + width / 2,
      centerY: top + height / 2,
    }
  }

  /**
   * 蒐集除 target 以外、其他物件可作為對齊參考的 X / Y 候選邊線
   * 每個物件提供 left / centerX / right (X 軸) 與 top / centerY / bottom (Y 軸)
   */
  const buildAxisCandidates = (target: FabricObj): { x: AxisCandidate[]; y: AxisCandidate[] } => {
    if (!canvas) {
      return { x: [], y: [] }
    }

    const candidatesX: AxisCandidate[] = []
    const candidatesY: AxisCandidate[] = []

    canvas.getObjects().forEach((obj) => {
      if (!obj || obj === target || obj.selectable === false || obj.visible === false) return

      const bounds = getObjectBounds(obj)
      if (!bounds) return

      candidatesX.push(
        { value: bounds.left, kind: 'left', bounds },
        { value: bounds.centerX, kind: 'centerX', bounds },
        { value: bounds.right, kind: 'right', bounds },
      )
      candidatesY.push(
        { value: bounds.top, kind: 'top', bounds },
        { value: bounds.centerY, kind: 'centerY', bounds },
        { value: bounds.bottom, kind: 'bottom', bounds },
      )
    })

    return { x: candidatesX, y: candidatesY }
  }

  /** 從候選邊線中找出與「移動中物件邊線」距離最近、且在閾值內的吸附目標 */
  const findNearestMatch = (movingEdges: MovingEdge[], candidates: AxisCandidate[]): NearestMatch | null => {
    let best: NearestMatch | null = null

    movingEdges.forEach((edge) => {
      candidates.forEach((candidate) => {
        if (candidate.kind !== edge.kind) return

        const delta = candidate.value - edge.value
        const distance = Math.abs(delta)
        if (distance > SNAP_THRESHOLD_PX) return

        if (!best || distance < best.distance) {
          best = {
            delta,
            distance,
            line: candidate.value,
            candidateBounds: candidate.bounds,
          }
        }
      })
    })

    return best
  }

  /**
   * object:moving 事件的處理：依目前位置計算 X/Y 最佳吸附點，
   * 若在閾值內則修正物件座標並設定輔助線資訊（由 drawSnapGuides 繪出）
   */
  const applyNearestSnap = (event: { target?: FabricObj }): void => {
    if (!canvas) return
    const target = event?.target
    if (!target || target.selectable === false) {
      clearSnapGuides(false)
      return
    }

    const bounds = getObjectBounds(target)
    if (!bounds) {
      clearSnapGuides(false)
      return
    }

    const candidates = buildAxisCandidates(target)
    const nearestX = findNearestMatch([
      { value: bounds.left, kind: 'left' },
      { value: bounds.centerX, kind: 'centerX' },
      { value: bounds.right, kind: 'right' },
    ], candidates.x)
    const nearestY = findNearestMatch([
      { value: bounds.top, kind: 'top' },
      { value: bounds.centerY, kind: 'centerY' },
      { value: bounds.bottom, kind: 'bottom' },
    ], candidates.y)

    clearSnapGuides(false)

    const snappedBounds: ObjectBounds = { ...bounds }

    if (nearestX) {
      target.set('left', (target.left || 0) + nearestX.delta)
      snappedBounds.left += nearestX.delta
      snappedBounds.centerX += nearestX.delta
      snappedBounds.right += nearestX.delta

      snapGuideX.value = {
        x: nearestX.line,
        y1: Math.min(snappedBounds.top, nearestX.candidateBounds.top) - SNAP_GUIDE_MARGIN,
        y2: Math.max(snappedBounds.bottom, nearestX.candidateBounds.bottom) + SNAP_GUIDE_MARGIN,
      }
    }

    if (nearestY) {
      target.set('top', (target.top || 0) + nearestY.delta)
      snappedBounds.top += nearestY.delta
      snappedBounds.centerY += nearestY.delta
      snappedBounds.bottom += nearestY.delta

      snapGuideY.value = {
        y: nearestY.line,
        x1: Math.min(snappedBounds.left, nearestY.candidateBounds.left) - SNAP_GUIDE_MARGIN,
        x2: Math.max(snappedBounds.right, nearestY.candidateBounds.right) + SNAP_GUIDE_MARGIN,
      }
    }

    target.setCoords()
  }

  /** 在 after:render 時於畫布上層繪製目前的吸附輔助線 */
  const drawSnapGuides = (): void => {
    if (!canvas || (!snapGuideX.value && !snapGuideY.value)) return

    const c = canvas as fabric.Canvas & { contextContainer?: CanvasRenderingContext2D; getContext?: () => CanvasRenderingContext2D }
    const ctx = c.contextContainer || c.getContext?.()
    if (!ctx) return

    ctx.save()
    ctx.strokeStyle = SNAP_GUIDE_COLOR
    ctx.lineWidth = SNAP_GUIDE_WIDTH

    if (snapGuideX.value) {
      ctx.beginPath()
      ctx.moveTo(snapGuideX.value.x, snapGuideX.value.y1)
      ctx.lineTo(snapGuideX.value.x, snapGuideX.value.y2)
      ctx.stroke()
    }

    if (snapGuideY.value) {
      ctx.beginPath()
      ctx.moveTo(snapGuideY.value.x1, snapGuideY.value.y)
      ctx.lineTo(snapGuideY.value.x2, snapGuideY.value.y)
      ctx.stroke()
    }

    ctx.restore()
  }

  /**
   * 根據容器大小計算畫布應有的顯示縮放比例
   * 真實尺寸 (w, h) 維持給 Fabric 計算用，CSS 顯示尺寸則會自動縮放
   */
  function updateCanvasScale(w: number, h: number): void {
    const CANVAS_CONTAINER_PADDING_PX = 80
    canvasInternalW.value = w
    canvasInternalH.value = h
    const container = canvasContainerEl.value
    const maxW = container
      ? Math.max(container.clientWidth - CANVAS_CONTAINER_PADDING_PX * 2, 1)
      : Math.max(window.innerWidth * 0.65 - CANVAS_CONTAINER_PADDING_PX * 2, 1)
    const maxH = container
      ? Math.max((container.clientHeight || window.innerHeight * 0.85) - CANVAS_CONTAINER_PADDING_PX * 2, 1)
      : Math.max(window.innerHeight * 0.85 - CANVAS_CONTAINER_PADDING_PX * 2, 1)
    const scale = Math.min(1, maxW / w, maxH / h)
    canvasScale.value = scale
    canvasDisplayW.value = Math.round(w * scale)
    canvasDisplayH.value = Math.round(h * scale)
  }

  // ============================================================
  // 五、狀態持久化與 Undo / Redo (Persistence & History)
  // ============================================================

  /**
   * 將目前畫布完整狀態寫入 localStorage（含寬高與姓名輸入）
   * 注意：底圖、畫框、浮水印等不需要被持久化的物件會依 objectRole 被過濾掉
   */
  const persistState = (): void => {
    if (!canvas) return
    try {
      const json = canvas.toJSON() as { objects?: Array<Record<string, unknown>> }
      const state: PersistedState = {
        canvasJSON: json,
        canvasWidth: canvas.getWidth(),
        canvasHeight: canvas.getHeight(),
        stickerName: stickerName.value,
      }
      localStorage.setItem(storageKey, JSON.stringify(state))
      hasPersistedState.value = true
    } catch (e) {
      console.warn('Failed to persist canvas state', e)
    }
  }

  /** 檢查 localStorage 是否已有資料，並更新對應旗標供 UI 顯示「載入上次」按鈕 */
  const updatePersistedStateFlag = (): void => {
    hasPersistedState.value = !!localStorage.getItem(storageKey)
  }

  /** 推入一筆新的歷史紀錄並寫入 localStorage（批次模式下會跳過） */
  const saveState = (): void => {
    if (isBatchMode.value || !canvas) return
    redoStack.value = []
    undoStack.value.push(canvas.toDatalessJSON(SERIALIZE_PROPS))
    persistState()
  }

  /** 將指定 JSON 內容載回畫布 */
  const loadState = async (json: unknown): Promise<void> => {
    if (!canvas) return
    await canvas.loadFromJSON(json as Parameters<fabric.Canvas['loadFromJSON']>[0])
    canvas.renderAll()
  }

  /** 復原（Undo）— 取出 undoStack 頂端，套用前一個狀態 */
  const undo = async (): Promise<void> => {
    if (undoStack.value.length <= 1) return
    const current = undoStack.value.pop()
    redoStack.value.push(current)
    await loadState(undoStack.value[undoStack.value.length - 1])
    persistState()
  }

  /** 重做（Redo）— 套用 redoStack 頂端的狀態 */
  const redo = async (): Promise<void> => {
    if (!redoStack.value.length) return
    const json = redoStack.value.pop()
    undoStack.value.push(json)
    await loadState(json)
    persistState()
  }

  /**
   * 從 localStorage 還原上一次的畫布狀態：
   *  - 重新建立 canvas 並載入 JSON
   *  - 重新標記浮水印物件、套用自訂控制點
   *  - 重置 undo/redo 堆疊
   */
  const loadPersistedState = async (): Promise<boolean> => {
    const raw = localStorage.getItem(storageKey)
    if (!raw) {
      updatePersistedStateFlag()
      return false
    }

    try {
      const { canvasWidth, canvasHeight, canvasJSON, stickerName: savedName } = JSON.parse(raw) as PersistedState
      isBatchMode.value = true
      createCanvas(canvasWidth || 800, canvasHeight || 500)
      if (!canvas) return false

      await canvas.loadFromJSON(canvasJSON as Parameters<fabric.Canvas['loadFromJSON']>[0])
      canvas.getObjects().forEach((obj) => {
        const o = obj as FabricObjWithRole
        if (o.objectRole === WATERMARK_ROLE) {
          watermarkObject.value = obj
          return
        }
        if (o.objectRole === FRAME_ROLE) {
          frameObject.value = obj
        }
        if (obj.selectable !== false) {
          applyCustomControls(obj)
        }
      })
      keepWatermarkOnTop()
      canvas.renderAll()
      refreshObjectList()
      undoStack.value = [canvas.toDatalessJSON(SERIALIZE_PROPS)]
      redoStack.value = []
      stickerName.value = savedName || ''
      isBatchMode.value = false
      // 載入完成後清除 localStorage 中的佔位資料，避免下次重複還原
      localStorage.removeItem(storageKey)
      hasPersistedState.value = false
      return true
    } catch (e) {
      console.warn('Failed to restore canvas state', e)
      isBatchMode.value = false
      return false
    }
  }

  // ============================================================
  // 六、選取與文字樣式控制 (Selection & Text Styles)
  // ============================================================

  /** 判斷物件是否為 ActiveSelection（多選） */
  const isActiveSelectionObj = (obj: FabricObj): boolean =>
    obj instanceof fabric.ActiveSelection ||
    obj.type === 'activeselection' ||
    (obj.type as string) === 'activeSelection'

  /**
   * selection:created / selection:updated 的處理：
   *  - 若是多選 (ActiveSelection)，為每個子物件套用自訂控制點
   *  - 若是文字框 (textbox)，將其樣式同步到工具列狀態
   */
  function handleSelection(e: { selected?: FabricObj[] }): void {
    const obj = canvas?.getActiveObject?.() || e.selected?.[0]
    if (!obj) {
      hideObjectActionBar()
      return
    }

    objectActionMoreMenuOpen.value = false

    if (isActiveSelectionObj(obj)) {
      const selection = obj as fabric.ActiveSelection
      const selectedItems = selection.getObjects?.() || []
      selectedItems.forEach((item) => applyCustomControls(item))
      applyCustomControls(obj)
      obj.setCoords?.()
      canvas?.renderAll()
      activeObject.value = null
      activeIsText.value = false
      updateObjectActionBarPosition()
      return
    }

    activeObject.value = obj

    if (obj.type === 'textbox') {
      const tb = obj as fabric.Textbox
      activeIsText.value = true
      fontSize.value = tb.fontSize as number
      fontColor.value = (tb.fill as string) || DEFAULT_TEXT_COLOR
      fontFamily.value = tb.fontFamily || 'Noto Sans TC'
      fontBold.value = tb.fontWeight === 'bold'
      fontItalic.value = tb.fontStyle === 'italic'
      fontUnderline.value = !!tb.underline
      fontLinethrough.value = !!tb.linethrough
    } else {
      activeIsText.value = false
    }

    updateObjectActionBarPosition()
  }

  /** 立即為當前 ActiveSelection 套用自訂控制點（避免框選時控制點還沒套用就被使用） */
  function applyActiveSelectionControlsNow(): void {
    if (!canvas) return
    const obj = canvas.getActiveObject?.()
    if (!obj) return

    if (!isActiveSelectionObj(obj)) return

    const selection = obj as fabric.ActiveSelection
    const selectedItems = selection.getObjects?.() || []
    selectedItems.forEach((item) => {
      applyCustomControls(item)
      item.setCoords?.()
    })
    applyCustomControls(obj)
    obj.setCoords?.()
    canvas.renderAll()
  }

  /** 將工具列上的字體 / 樣式套用至目前選取的文字框 */
  function updateTextStyle(): void {
    if (!canvas) return
    const obj = canvas.getActiveObject()
    if (!obj || obj.type !== 'textbox') return
    const tb = obj as fabric.Textbox
    tb.set({
      fontSize: Number(fontSize.value),
      fill: fontColor.value,
      fontFamily: fontFamily.value,
      fontWeight: fontBold.value ? 'bold' : 'normal',
      fontStyle: fontItalic.value ? 'italic' : 'normal',
      underline: fontUnderline.value,
      linethrough: fontLinethrough.value,
    })
    fitTextboxToText(tb)
    canvas.renderAll()
    saveState()
  }

  /**
   * 讓文字框寬度貼合實際文字內容
   * 使用一個臨時的 fabric.Text 量測文字寬度後，再加上左右內距
   */
  function fitTextboxToText(textbox: fabric.Textbox | FabricObj | null | undefined): void {
    if (!textbox || textbox.type !== 'textbox') return
    const tb = textbox as fabric.Textbox

    const text = tb.text?.length ? tb.text : ' '
    const probe = new fabric.Text(text, {
      fontSize: Number(tb.fontSize) || 24,
      fontFamily: tb.fontFamily || 'Noto Sans TC',
      fontWeight: tb.fontWeight || 'normal',
      fontStyle: tb.fontStyle || 'normal',
      underline: !!tb.underline,
      linethrough: !!tb.linethrough,
    })

    const fittedWidth = Math.max((probe.width || 0) + TEXTBOX_PADDING_PX * 2, TEXTBOX_PADDING_PX * 2 + 1)

    tb.set({
      width: fittedWidth,
      padding: TEXTBOX_PADDING_PX,
    })
  }

  /** 切換粗體並更新文字框樣式 */
  function toggleBold(): void {
    fontBold.value = !fontBold.value
    updateTextStyle()
  }

  /** 切換斜體並更新文字框樣式 */
  function toggleItalic(): void {
    fontItalic.value = !fontItalic.value
    updateTextStyle()
  }

  /** 切換底線並更新文字框樣式 */
  function toggleUnderline(): void {
    fontUnderline.value = !fontUnderline.value
    updateTextStyle()
  }

  /** 切換刪除線並更新文字框樣式 */
  function toggleLinethrough(): void {
    fontLinethrough.value = !fontLinethrough.value
    updateTextStyle()
  }

  // ============================================================
  // 七、自訂控制點 (Custom Controls)
  // ============================================================

  /**
   * 為物件套用統一視覺與兩個自訂控制點：
   *   - 左下角：尺寸調整
   *   - 右下角：旋轉
   */
  function applyCustomControls(obj: FabricObj): void {
    const ICON_SIZE = 38
    const CONTROL_SIZE = 40

    obj.set({
      hasControls: true,
      hasBorders: true,
      cornerColor: '#fff',
      cornerStrokeColor: '#0078C8',
      borderColor: '#0078C8',
      borderDashArray: [5, 4],
      transparentCorners: false,
      padding: 14,
      centeredScaling: true,
    })

    obj.setControlsVisibility({
      mt: false, mb: false, ml: false, mr: false,
      tl: false, tr: false, bl: false, br: false,
      mtr: false,
    })

    const controls = obj.controls as Record<string, fabric.Control>

    controls.resizeControl = new fabric.Control({
      x: -0.5, y: 0.5,
      sizeX: CONTROL_SIZE,
      sizeY: CONTROL_SIZE,
      touchSizeX: CONTROL_SIZE,
      touchSizeY: CONTROL_SIZE,
      actionHandler: fabric.controlsUtils.scalingEqually,
      cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
      actionName: 'scale',
      render: (ctx: CanvasRenderingContext2D, left: number, top: number) =>
        ctx.drawImage(iconResize, left - ICON_SIZE / 2, top - ICON_SIZE / 2, ICON_SIZE, ICON_SIZE),
    })

    controls.rotateControl = new fabric.Control({
      x: 0.5, y: 0.5,
      sizeX: CONTROL_SIZE,
      sizeY: CONTROL_SIZE,
      touchSizeX: CONTROL_SIZE,
      touchSizeY: CONTROL_SIZE,
      actionHandler: fabric.controlsUtils.rotationWithSnapping,
      cursorStyleHandler: fabric.controlsUtils.rotationStyleHandler,
      actionName: 'rotate',
      render: (ctx: CanvasRenderingContext2D, left: number, top: number) =>
        ctx.drawImage(iconRotate, left - ICON_SIZE / 2, top - ICON_SIZE / 2, ICON_SIZE, ICON_SIZE),
    })
  }

  // ============================================================
  // 八、新增物件 (Add Objects)
  // ============================================================

  /** 通用：將物件加入畫布、套用控制點，並在必要時調整 z-index */
  const addObject = (obj: FabricObj): void => {
    if (!canvas) return
    const objects = canvas.getObjects()
    console.log(goodsType.value)
    applyCustomControls(obj)
    canvas.add(obj)
    if ((obj as FabricObjWithRole).objectRole === 'photo') {
      placePhotoBelowFrame(obj)
    }else{
      canvas.moveObjectTo(obj, Math.max(objects.length - 2, 0))
    }
    canvas.setActiveObject(obj)
    keepWatermarkOnTop()
    canvas.renderAll()
    saveState()
  }

  /** 新增一個可編輯文字框到指定位置 */
  const addText = (val?: string, x?: number, y?: number, callback?: Function): void => {
    addObject(new fabric.Textbox(val || '可編輯文字', {
      left: x ?? 80,
      top: y ?? 80,
      fontSize: 24,
      fill: DEFAULT_TEXT_COLOR,
      originX: 'left',
      originY: 'top',
    }))
    if (callback) callback()
  }

  // ============================================================
  // 九、姓名貼批次產生 (Name Stickers)
  // ============================================================

  /**
   * 在底圖上以 4 (欄) x 6 (列) 的格狀排列產生姓名文字
   * 會使用目前工具列上的字體、大小、樣式等設定
   */
  const generateNameStickers = (specKey: NameStickerSpecKey): void => {
    if (!canvas || !frameObject.value) {
      alert('請先上傳姓名貼底圖')
      return
    }

    const name = stickerName.value.trim()

    if (!name) {
      alert('請先輸入姓名')
      return
    }

    const layout = NAME_STICKER_LAYOUTS[specKey]
    if (!layout) {
      alert('姓名貼規格無效')
      return
    }

    const COLUMNS = layout.columns
    const ROWS = layout.rows
    const canvasW = canvas.getWidth()
    const canvasH = canvas.getHeight()
    const marginLeft = canvasW * layout.marginLeftRatio
    const marginTop = canvasH * layout.marginTopRatio
    const gapX = canvasW * layout.gapXRatio
    const gapY = canvasH * layout.gapYRatio
    const totalGapX = gapX * (COLUMNS - 1)
    const totalGapY = gapY * (ROWS - 1)
    const cellW = (canvasW - marginLeft * 2 - totalGapX) / COLUMNS
    const cellH = (canvasH - marginTop * 2 - totalGapY) / ROWS

    isBatchMode.value = true

    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLUMNS; col += 1) {
        const textbox = new fabric.Textbox(name, {
          left: marginLeft + col * (cellW + gapX),
          top: marginTop + row * (cellH + gapY),
          width: 1,
          fontSize: Number(fontSize.value),
          fill: DEFAULT_TEXT_COLOR,
          fontFamily: fontFamily.value,
          fontWeight: fontBold.value ? 'bold' : 'normal',
          fontStyle: fontItalic.value ? 'italic' : 'normal',
          underline: fontUnderline.value,
          linethrough: fontLinethrough.value,
          textAlign: 'left',
          originX: 'left',
          originY: 'top',
          splitByGrapheme: true,
          padding: TEXTBOX_PADDING_PX,
        })

        fitTextboxToText(textbox)
        applyCustomControls(textbox)
        canvas.add(textbox)
      }
    }

    isBatchMode.value = false
    keepWatermarkOnTop()
    canvas.renderAll()
    saveState()
  }

  // ============================================================
  // 十、圖片 / 底圖 / 浮水印處理 (Images, Frame, Watermark)
  // ============================================================

  /** 透過建立 Image 物件取得圖片實際寬高 */
  const getImageSize = (imageUrl: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve({ width: image.width, height: image.height })
      image.onerror = reject
      image.src = imageUrl
    })
  }

  /** 將照片放到畫框 (frame) 下方一層，避免遮住外框 */
  const placePhotoBelowFrame = (photo: FabricObj): void => {
    if (!canvas || !frameObject.value || !photo) return
    const frameIndex = canvas.getObjects().indexOf(frameObject.value)
    canvas.moveObjectTo(photo, canvas.getObjects().length-4)
  }

  /** 確保浮水印永遠在最上層（任何重新排序後皆需呼叫） */
  const keepWatermarkOnTop = (): void => {
    if (!canvas || !watermarkObject.value) return
    const objects = canvas.getObjects()
    canvas.moveObjectTo(watermarkObject.value, Math.max(objects.length - 1, 0))
  }

  /** 產生與預覽一致的格狀傾斜浮水印影像（透明背景） */
  const buildTiledWatermarkDataUrl = (label: string, width: number, height: number): string => {
    const watermarkCanvas = document.createElement('canvas')
    watermarkCanvas.width = width
    watermarkCanvas.height = height
    const ctx = watermarkCanvas.getContext('2d')
    if (!ctx) return ''

    ctx.save()
    ctx.translate(width / 2, height / 2)
    ctx.rotate(-Math.PI / 6)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'bold 42px Arial'
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'

    const xStep = 260
    const yStep = 150
    for (let y = -height; y <= height; y += yStep) {
      for (let x = -width; x <= width; x += xStep) {
        ctx.fillText(label, x, y)
      }
    }
    ctx.restore()

    return watermarkCanvas.toDataURL('image/png')
  }

  /** 在畫布上加上一個與預覽一致的格狀浮水印（不可選取） */
  const addCanvasWatermark = async (): Promise<void> => {
    if (!canvas) return
    // 已存在則先從 canvas 移除，避免重複
    if (watermarkObject.value) {
      if (canvas.getObjects().includes(watermarkObject.value)) {
        canvas.remove(watermarkObject.value)
      }
      watermarkObject.value = null
    }

    const width = canvas.getWidth()
    const height = canvas.getHeight()

    try {
      const dataUrl = buildTiledWatermarkDataUrl(watermarkText, width, height)
      if (!dataUrl) return

      const overlay = await fabric.Image.fromURL(dataUrl)
      overlay.set({
        left: 0,
        top: 0,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        lockMovementX: true,
        lockMovementY: true,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
      })

      ;(overlay as FabricObjWithRole).objectRole = WATERMARK_ROLE

      watermarkObject.value = overlay
      canvas.add(overlay)
      keepWatermarkOnTop()
    } catch (e) {
      console.warn('Failed to create tiled watermark, fallback to simple watermark', e)
      const fallback = new fabric.Text(watermarkText, {
        left: width / 2,
        top: height / 2,
        originX: 'center',
        originY: 'center',
        angle: -25,
        fontSize: Math.max(Math.round(width * 0.12), 42),
        fontWeight: 'bold',
        fill: 'rgba(0, 0, 0, 0.14)',
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
      })
      ;(fallback as FabricObjWithRole).objectRole = WATERMARK_ROLE
      watermarkObject.value = fallback
      canvas.add(fallback)
      keepWatermarkOnTop()
    }
  }

  /**
   * 以底圖 (Frame) 為基準建立一個與圖片同寬高的畫布
   * 同時鎖定底圖不可選取/移動，並加上浮水印
   */
  const createCanvasFromBackground = async (imageUrl: string): Promise<void> => {
    if (!imageUrl) return

    const frame = await fabric.Image.fromURL(imageUrl, { crossOrigin: 'anonymous' })
    const width = frame.width || 800
    const height = frame.height || 500

    createCanvas(width, height)
    if (!canvas) return

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
    ;(frame as FabricObjWithRole).objectRole = FRAME_ROLE

    frameObject.value = frame
    canvas.add(frame)
    await addCanvasWatermark()
    canvas.discardActiveObject()
    canvas.renderAll()
    saveState()
  }

  /** 將上傳的照片以 90% 畫布尺寸為上限，置中加入並放在畫框下方 */
  const addPhotoToCanvas = async (imageUrl: string): Promise<void> => {
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
    })
    ;(photo as FabricObjWithRole).objectRole = PHOTO_ROLE

    addObject(photo)

    if (frameObject.value) {
      placePhotoBelowFrame(photo)
      keepWatermarkOnTop()
      canvas.renderAll()
    }

    saveState()
  }

  // ============================================================
  // 十一、檔案上傳處理 (File Uploads)
  // ============================================================

  /** 由 input 事件取出第一個 File，無則回傳 null */
  const getFileFromEvent = (e: Event): File | null => {
    const input = e.target as HTMLInputElement | null
    return input?.files?.[0] ?? null
  }

  /** 重設 input 的值（讓使用者可再上傳同一個檔案） */
  const resetInputValue = (e: Event): void => {
    const input = e.target as HTMLInputElement | null
    if (input) input.value = ''
  }

  /** 上傳「畫框底圖」：驗證解析度後依底圖尺寸建立畫布 */
  const uploadFrameImage = (e: Event): void => {
    const file = getFileFromEvent(e)
    if (!file) return

    goodsType.value = 'frame'

    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const imageUrl = String(reader.result || '')
        const size = await getImageSize(imageUrl)
        if (size.width < 200 || size.height < 200) {
          alert('檔案解析度差，請上傳至少 200x200px 的圖片')
          resetInputValue(e)
          return
        }
        await createCanvasFromBackground(imageUrl)
        resetInputValue(e)
      } catch (err) {
        console.error('Upload frame failed:', err)
        alert('圖片載入失敗，請確認檔案格式')
      }
    }
    reader.readAsDataURL(file)
  }

  /** 上傳「姓名貼底圖」：邏輯與 uploadFrameImage 相同（語意分開） */
  const uploadNameStickerFrameImage = (e: Event): void => {
    const file = getFileFromEvent(e)
    if (!file) return
    
    goodsType.value = 'frame'
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const imageUrl = String(reader.result || '')
        const size = await getImageSize(imageUrl)
        if (size.width < 200 || size.height < 200) {
          alert('檔案解析度差，請上傳至少 200x200px 的圖片')
          resetInputValue(e)
          return
        }
        await createCanvasFromBackground(imageUrl)
        resetInputValue(e)
      } catch (err) {
        console.error('Upload name sticker frame failed:', err)
        alert('圖片載入失敗，請確認檔案格式')
      }
    }
    reader.readAsDataURL(file)
  }

  /** 上傳「照片」：必須先有畫框底圖才能上傳 */
  const uploadPhotoImage = (e: Event): void => {
    const input = e.target as HTMLInputElement | null
    const files = input?.files
    if (!files || files.length === 0) return

    if (!frameObject.value) {
      alert('請先上傳畫框底圖，再上傳照片')
      resetInputValue(e)
      return
    }

    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const imageUrl = String(reader.result || '')
          await addPhotoToCanvas(imageUrl)
        } catch (err) {
          console.error('Upload photo failed:', err)
          alert('照片載入失敗，請確認檔案格式')
        }
      }
      reader.readAsDataURL(file)
    })
    // 清空 input 讓同一批檔案可重複上傳
    resetInputValue(e)
  }

  // ============================================================
  // 十二、層級調整 / 對齊 / 複製 (Z-order, Align, Duplicate)
  // ============================================================

  /** 將目前選取物件往上移一層（畫框本身不可移動） */
  const bringForward = (): void => {
    if (!canvas) return
    const obj = canvas.getActiveObject()
    if (!obj) return

    if (frameObject.value && obj === frameObject.value) return

    canvas.moveObjectTo(obj, canvas.getObjects().indexOf(obj) + 1)
    keepWatermarkOnTop()
    canvas.renderAll()
    saveState()
  }

  /** 將目前選取物件往下移一層；若是照片，仍維持在畫框下方 */
  const sendBackward = (): void => {
    if (!canvas) return
    const obj = canvas.getActiveObject()
    if (!obj) return

    if (frameObject.value && obj === frameObject.value) return

    canvas.moveObjectTo(obj, canvas.getObjects().indexOf(obj) - 1)
    if ((obj as FabricObjWithRole).objectRole === 'photo') {
      placePhotoBelowFrame(obj)
    }
    keepWatermarkOnTop()
    canvas.renderAll()
    saveState()
  }

  /**
   * 複製目前選取的所有物件，並向右下偏移 20px 以利辨識
   * 複製後若為多個則重新組成 ActiveSelection 一起選取
   */
  const duplicateSelectedObject = async (): Promise<void> => {
    const selectedObjects = canvas?.getActiveObjects?.() || []
    if (!selectedObjects.length || !canvas) return

    const duplicated: FabricObj[] = []
    canvas.discardActiveObject()

    for (const source of selectedObjects) {
      const cloned = await source.clone()
      cloned.set({
        left: (cloned.left || 0) + 20,
        top: (cloned.top || 0) + 20,
      })
      applyCustomControls(cloned)
      canvas.add(cloned)
      if ((cloned as FabricObjWithRole).objectRole === 'photo') {
        placePhotoBelowFrame(cloned)
      }
      duplicated.push(cloned)
    }

    if (duplicated.length === 1) {
      canvas.setActiveObject(duplicated[0]!)
    } else if (duplicated.length > 1) {
      canvas.setActiveObject(new fabric.ActiveSelection(duplicated, { canvas }))
    }

    updateObjectActionBarPosition()
    keepWatermarkOnTop()
    canvas.renderAll()
    saveState()
  }

  const deleteSelectedObject = (): void => {
    if (!canvas) return
    const currentCanvas = canvas
    objectActionMoreMenuOpen.value = false
    const selected = currentCanvas.getActiveObjects?.() || []
    if (!selected.length) return

    currentCanvas.discardActiveObject()
    selected.forEach((obj) => currentCanvas.remove(obj))
    hideObjectActionBar()
    currentCanvas.requestRenderAll()
    saveState()
  }

  const hideSelectedObject = (): void => {
    if (!canvas) return
    objectActionMoreMenuOpen.value = false
    const selected = canvas.getActiveObjects?.() || []
    if (!selected.length) return

    selected.forEach((obj) => {
      obj.set({ visible: false })
    })
    canvas.discardActiveObject()
    hideObjectActionBar()
    canvas.requestRenderAll()
    refreshObjectList()
    saveState()
  }

  const toggleObjectActionMoreMenu = (): void => {
    objectActionMoreMenuOpen.value = !objectActionMoreMenuOpen.value
    updateObjectActionBarPosition()
  }

  const closeObjectActionMoreMenu = (): void => {
    objectActionMoreMenuOpen.value = false
  }

  const alignLeftToCanvas = (): void => alignSelectionToCanvas('left')
  const alignCenterToCanvas = (): void => alignSelectionToCanvas('center')
  const alignRightToCanvas = (): void => alignSelectionToCanvas('right')
  const alignTopToCanvas = (): void => alignSelectionToCanvas('top')
  const alignMiddleToCanvas = (): void => alignSelectionToCanvas('middle')
  const alignBottomToCanvas = (): void => alignSelectionToCanvas('bottom')

  /** 將所有選取物件對齊至畫布最左側 */
  const alignLeft = (): void => {
    alignLeftToCanvas()
  }

  /** 將所有選取物件對齊至畫布最上方 */
  const alignTop = (): void => {
    alignTopToCanvas()
  }

  /** 把目前選取文字框的樣式（字體、顏色、角度…）套用到畫布上所有文字框 */
  const applyStyleToAll = (): void => {
    const source = canvas?.getActiveObject?.()
    if (!source || source.type !== 'textbox' || !canvas) {
      alert('請先選取一個文字框')
      return
    }
    const src = source as fabric.Textbox

    const allTextboxes = canvas.getObjects().filter(o => o.type === 'textbox') as fabric.Textbox[]
    allTextboxes.forEach((obj) => {
      obj.set({
        fontSize: src.fontSize,
        fill: src.fill,
        fontFamily: src.fontFamily,
        fontWeight: src.fontWeight,
        fontStyle: src.fontStyle,
        underline: src.underline,
        linethrough: src.linethrough,
        angle: src.angle,
      })
      fitTextboxToText(obj)
    })

    keepWatermarkOnTop()
    canvas.renderAll()
    saveState()
  }

  // ============================================================
  // 十三、PDF 匯出 (PDF Export)
  // ============================================================

  /** 將同一張 baseImgData 在水平方向重覆 copies 份，組合成一張較寬的圖（用於並排輸出） */
  const buildRepeatedImageData = (baseImgData: string, copies: number, imageQuality: number): Promise<string> => {
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
   * 依 pageSpec、DPI 與品質產生 PDF Blob：
   *  1. 暫時隱藏浮水印
   *  2. 以指定 multiplier 匯出高解析度 JPEG
   *  3. 還原浮水印
   *  4. 視需要做水平複製
   *  5. 以 cover 邏輯置中放入 PDF
   */
  const buildPdfBlob = async (
    pageSpec: PageSpec,
    dpi: number,
    imageQuality: number,
    exportCopies = 1,
  ): Promise<Blob | null> => {
    if (!canvas) return null

    const MM_PER_INCH = 25.4
    const { pageWmm, pageHmm, pdfOrientation, pdfFormat } = pageSpec
    const exportWidth = canvas.getWidth() * exportCopies
    const exportHeight = canvas.getHeight()

    const multiplier = Math.min(
      Math.round((pageWmm / MM_PER_INCH) * dpi) / exportWidth,
      Math.round((pageHmm / MM_PER_INCH) * dpi) / exportHeight,
    )

    const previousWatermarkVisible = watermarkObject.value?.visible
    if (watermarkObject.value) {
      watermarkObject.value.set({ visible: false })
      canvas.renderAll()
    }

    const baseImgData = canvas.toDataURL({
      format: 'jpeg',
      quality: imageQuality,
      multiplier,
    })

    if (watermarkObject.value) {
      watermarkObject.value.set({ visible: previousWatermarkVisible ?? true })
      keepWatermarkOnTop()
      canvas.renderAll()
    }

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
    let imgW: number
    let imgH: number
    let offsetX: number
    let offsetY: number

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
   * 依畫布尺寸推算 PDF 頁面規格 (mm)
   * widthMultiplier 用於姓名貼等需要橫向重覆的情境
   */
  const getPageSpecFromCanvas = (widthMultiplier = 1): PageSpec => {
    if (!canvas) {
      return {
        pageWmm: 0,
        pageHmm: 0,
        pdfOrientation: 'portrait',
        pdfFormat: [0, 0],
      }
    }

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
   * 匯出 PDF：
   *  - 由高 DPI/品質往下嘗試，第一個 ≤ 20MB 的版本即輸出
   *  - 即使全部超過上限，仍輸出最後一個並提醒使用者
   */
  const exportPDF = async (): Promise<void> => {
    if (!canvas) {
      alert('目前沒有可匯出的畫布')
      return
    }

    const pageSpec = getPageSpecFromCanvas(1)

    // DPI / 品質候選（由高至低嘗試壓縮，直到符合大小限制）
    const candidates: Array<{ dpi: number; quality: number }> = [
      { dpi: 300, quality: 0.92 },
      { dpi: 260, quality: 0.88 },
      { dpi: 220, quality: 0.84 },
      { dpi: 200, quality: 0.8 },
      { dpi: 180, quality: 0.76 },
      { dpi: 160, quality: 0.72 },
      { dpi: 140, quality: 0.68 },
    ]

    let selectedBlob: Blob | null = null
    for (const candidate of candidates) {
      const blob = await buildPdfBlob(pageSpec, candidate.dpi, candidate.quality, 1)
      selectedBlob = blob
      if (blob && blob.size <= MAX_PDF_SIZE_BYTES) {
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

  // ============================================================
  // 十四、預覽圖（含格狀浮水印） (Preview Image)
  // ============================================================

  /**
   * 取得目前畫布的 PNG 預覽圖
   * 畫布本身已含浮水印，不再額外覆蓋一次
   */
  const getCanvasPreviewDataUrl = (): string => {
    if (!canvas) return ''
    return canvas.toDataURL({ format: 'png', multiplier: 1 })
  }



  // ============================================================
  // 十五、側邊欄物件清單操作 (Sidebar Object Operations)
  // ============================================================

  /** 由側邊欄點擊聚焦至特定物件 */
  const focusObject = (obj: FabricObj): void => {
    if (!canvas || !obj) return
    canvas.setActiveObject(obj)
    objectActionMoreMenuOpen.value = false
    updateObjectActionBarPosition()
    canvas.renderAll()
    refreshObjectList()
  }

  /** 由側邊欄點擊刪除特定物件 */
  const removeObjectFromCanvas = (obj: FabricObj): void => {
    if (!canvas || !obj) return
    canvas.remove(obj)
    if (canvas.getActiveObjects?.().length === 0) {
      hideObjectActionBar()
    }
    canvas.requestRenderAll()
    saveState()
  }

  /**
   * 由側邊欄拖曳調整圖層順序，保留不可操作物件（如底圖、浮水印）在原位。
   * 注意：sidebar 顯示順序是「上層在前」，而 canvas.getObjects() 是「下層在前」，
   * 因此中間會做一次 reverse 來回轉換。
   */
  const reorderObjectLayer = (fromIndex: number, toIndex: number): void => {
    if (!canvas || fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return

    // sidebar 可操作物件（已排除不可選取物件），順序為畫布底 -> 頂
    const sidebarObjects = getSidebarObjects()
    // 轉為 sidebar 顯示順序：頂 -> 底，才能用拖曳索引直接運算
    const displayObjects = [...sidebarObjects].reverse()
    const draggedObject = displayObjects[fromIndex]

    if (!draggedObject || !displayObjects[toIndex]) return

    // 先在「顯示順序」中完成拖曳插入
    const nextDisplayObjects = [...displayObjects]
    nextDisplayObjects.splice(fromIndex, 1)
    nextDisplayObjects.splice(toIndex, 0, draggedObject)

    // 再轉回 fabric 實際堆疊順序：底 -> 頂
    const nextSidebarStack = [...nextDisplayObjects].reverse()
    const currentObjects = [...canvas.getObjects()]
    const sidebarObjectSet = new Set(sidebarObjects)

    // 找出可重排物件在原始 canvas stack 的索引位置（不可操作物件不動）
    const reorderablePositions = currentObjects.reduce<number[]>((positions, obj, index) => {
      if (sidebarObjectSet.has(obj)) positions.push(index)
      return positions
    }, [])

    // 只覆寫可重排位置，其餘位置維持原本物件
    const nextObjects = [...currentObjects]
    reorderablePositions.forEach((position, index) => {
      nextObjects[position] = nextSidebarStack[index]!
    })

    // 依新陣列逐一套回 canvas 實際 z-index
    nextObjects.forEach((obj, index) => {
      canvas!.moveObjectTo(obj, index)
    })

    // 浮水印固定置頂，並同步 UI 與歷史
    keepWatermarkOnTop()
    canvas.requestRenderAll()
    refreshObjectList()
    saveState()
  }

  // ============================================================
  // 十六、畫布事件綁定與初始化 (Canvas Events & Init)
  // ============================================================

  /**
   * 綁定 Fabric Canvas 的所有事件：
   *  - 選取變化 → 同步狀態 / 套用控制點 / 重整清單
   *  - 物件新增/刪除/修改 → 同步清單 / 儲存歷史
   *  - 移動中 → 計算吸附；放開 → 清除輔助線
   *  - 重繪後 → 將輔助線繪到上層
   *  - 文字內容變更 → 自動 fit 寬度
   */
  function bindCanvasEvents(): void {
    if (!canvas) return

    canvas.on('selection:created', (e) => {
      handleSelection(e as { selected?: FabricObj[] })
      applyActiveSelectionControlsNow()
      requestAnimationFrame(() => applyActiveSelectionControlsNow())
      refreshObjectList()
    })
    canvas.on('selection:updated', (e) => {
      handleSelection(e as { selected?: FabricObj[] })
      applyActiveSelectionControlsNow()
      requestAnimationFrame(() => applyActiveSelectionControlsNow())
      refreshObjectList()
    })
    canvas.on('selection:cleared', () => {
      activeObject.value = null
      activeIsText.value = false
      hideObjectActionBar()
      clearSnapGuides(true)
      refreshObjectList()
    })
    canvas.on('object:added', refreshObjectList)
    canvas.on('object:removed', refreshObjectList)
    canvas.on('object:moving', (e) => {
      applyNearestSnap(e as { target?: FabricObj })
      updateObjectActionBarPosition()
    })
    canvas.on('object:scaling', updateObjectActionBarPosition)
    canvas.on('object:rotating', updateObjectActionBarPosition)
    canvas.on('object:modified', () => {
      updateObjectActionBarPosition()
      saveState()
      refreshObjectList()
    })
    canvas.on('mouse:up', () => {
      clearSnapGuides(true)
      updateObjectActionBarPosition()
    })
    canvas.on('after:render', drawSnapGuides)
    canvas.on('text:changed', (event) => {
      const target = (event as { target?: FabricObj }).target
      if (!target || target.type !== 'textbox') return
      fitTextboxToText(target)
      refreshObjectList() // 先同步物件列表，確保即時顯示
      canvas?.requestRenderAll()
      saveState()
    })
  }

  /**
   * 建立全新的 Fabric Canvas 實例（會先 dispose 舊的）
   * preserveObjectStacking: true → 點擊不會把物件自動帶到最上層
   */
  function createCanvas(width: number, height: number): void {
    canvas?.dispose()
    frameObject.value = null
    watermarkObject.value = null
    hideObjectActionBar()
    updateCanvasScale(width, height)

    if (!canvasEl.value) return

    canvas = new fabric.Canvas(canvasEl.value, {
      backgroundColor: '#fff',
      width,
      height,
      preserveObjectStacking: true,
    })

    bindCanvasEvents()
    saveState()
  }

  // 元件掛載：檢查是否有上次的儲存、註冊視窗 resize 監聽器
  onMounted(() => {
    updatePersistedStateFlag()
    // 注意：此處刻意不自動建立空白畫布，要等使用者上傳底圖後才會建立
    // createCanvas(800, 500)

    const onResize = (): void => {
      if (canvas) {
        updateCanvasScale(canvas.getWidth(), canvas.getHeight())
        updateObjectActionBarPosition()
      }
    }

    window.addEventListener('resize', onResize)
    onUnmounted(() => window.removeEventListener('resize', onResize))
  })

  // ============================================================
  // 十七、對外 API (Public API)
  // ============================================================
  return {
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
    addText,
    generateNameStickers,
    uploadFrameImage,
    uploadNameStickerFrameImage,
    uploadPhotoImage,
    bringForward,
    sendBackward,
    duplicateSelectedObject,
    deleteSelectedObject,
    hideSelectedObject,
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
    alignTop,
    applyStyleToAll,
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
  }
}

/** Composable 的回傳型別，方便外部標註 */
export type UseFabricCanvasReturn = ReturnType<typeof useFabricCanvas>
