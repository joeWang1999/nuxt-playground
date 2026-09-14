import { ref, onUnmounted } from 'vue'

// ================================================================
// 型別定義 (Type Definitions)
// ================================================================

/** 每次跨格時回傳的資訊 */
export interface ReelTick {
  /** 第幾個滾輪（對應 getElements 回傳的順序） */
  index: number
  /**
   * 建議延後幾秒再發聲。
   * 同一幀內補發多次時會把它們錯開，避免疊成單一一聲巨響。
   */
  delay: number
}

/** Composable 對外可傳入的選項 */
export interface UseReelTicksOptions {
  /** 轉多少度算一格，預設 72（等於 5 個獎品：360 / 5） */
  stepDeg?: number
  /**
   * 單一幀最多補發幾次。
   * 掉幀後累積的跨格數可能很大，全部補發會爆出一串雜音。預設 4
   */
  maxTicksPerFrame?: number
  /**
   * 滾輪定位（transition 真正結束）時呼叫，每個滾輪各一次。
   * 用 transitionend 而非計時器，時間點才會跟視覺上的停止完全一致。
   */
  onSettle?: (index: number) => void
  /**
   * 只在「距離終點剩下這麼多格」之後才觸發 onTick。
   * 0 為不限制（全程每格都觸發），這是預設值。
   *
   * 需要能讀到終點角度才會生效，見 targetProperty。
   */
  finalSteps?: number
  /**
   * 存放終點角度的 CSS 自訂屬性名稱，預設 '--targetDeg'。
   * Gift.vue 在起轉當下就把它寫進元素的 inline style，所以不必改動 Gift 也能讀到。
   */
  targetProperty?: string
  /** 某個滾輪進入尾段（剩餘格數 <= finalSteps）時呼叫，每輪各一次 */
  onEnterFinal?: (index: number) => void
}

const RAD_TO_DEG = 180 / Math.PI

/** 兩次取樣間隔小於此值就跳過（毫秒） */
const MIN_SAMPLE_MS = 8

/** 每個滾輪的累計狀態 */
interface ReelState {
  /** 上一幀讀到的角度（±180） */
  prevAngle: number
  /**
   * 累計轉過的角度，有號。
   * 用有號值是為了正確處理回彈：衝過頭再退回時位移會相抵，
   * 若用絕對值累加，退回的路徑會被當成繼續前進而多發好幾聲。
   */
  netDeg: number
  /** 已經發過音的格數（只增不減，退回時不會重複觸發） */
  emittedSteps: number
  /** 是否已進入尾段 */
  inFinal: boolean
}

// ================================================================
// Composable
// ================================================================

/**
 * 偵測滾輪每轉過一格的時機，用來逐格觸發音效。
 *
 * 不依賴動畫的實作細節（CSS transition / animation / JS 都可），
 * 而是每一幀讀 getComputedStyle 的 transform 矩陣、對角度做差分並累計，
 * 所以改了 easing 或時長，音效的疏密會自動跟著對。
 *
 * 因為觸發頻率直接來自真實轉速，快的時候密、慢下來自然變疏，
 * 不需要調整播放速率，也就沒有時間伸縮造成的失真。
 *
 * @param getElements 回傳要量測的元素，每一幀重新呼叫
 * @param onTick 每跨過一格就呼叫一次
 * @param options 格距與補發上限
 *
 * @example
 * const ticks = useReelTicks(
 *   () => rootEl.value?.querySelectorAll('.gift-container'),
 *   ({ delay }) => click.play(delay),
 *   { stepDeg: 360 / gifts.length }
 * )
 * ticks.start()   // 開始轉動
 * ticks.stop()    // 全部停止
 */
export function useReelTicks(
  getElements: () => ArrayLike<Element> | null | undefined,
  onTick: (tick: ReelTick) => void,
  options: UseReelTicksOptions = {},
) {
  const {
    stepDeg = 72,
    maxTicksPerFrame = 4,
    onSettle,
    finalSteps = 0,
    targetProperty = '--targetDeg',
    onEnterFinal,
  } = options

  /** 本次轉動總共發了幾次音 */
  const tickCount = ref(0)
  /** 是否正在偵測 */
  const isMeasuring = ref(false)

  let rafId: number | null = null
  let lastTs = 0
  let states = new WeakMap<Element, ReelState>()
  /** 目前掛著 transitionend 監聽的元素，stop() 時要解除 */
  let watchedElements: Element[] = []

  /**
   * 從 computed transform 取出 rotateX 角度。
   * transition 進行中讀到的是「當下插值後」的矩陣，所以能拿到即時角度。
   */
  function readRotateX(style: CSSStyleDeclaration): number | null {
    const transform = style.transform
    if (!transform || transform === 'none') return null

    const open = transform.indexOf('(')
    const close = transform.lastIndexOf(')')
    if (open < 0 || close <= open) return null

    const n = transform.slice(open + 1, close).split(',').map(Number)

    // matrix3d 是 column-major，第二欄（index 4~7）為 (0, cos, sin, 0)
    if (transform.startsWith('matrix3d')) {
      const cos = n[5]
      const sin = n[6]
      if (cos === undefined || sin === undefined) return null
      return Math.atan2(sin, cos) * RAD_TO_DEG
    }

    // 退化成 2D matrix(a,b,c,d,e,f) 時只剩 d = cos，拿不到正負號；
    // 僅作保險，實務上 preserve-3d 會給 matrix3d
    if (transform.startsWith('matrix')) {
      const d = n[3]
      if (d === undefined) return null
      return Math.acos(clamp(d, -1, 1)) * RAD_TO_DEG
    }

    return null
  }

  /**
   * 讀出終點角度（絕對值，deg）。
   * Gift 寫的是負值字串如 "-1980deg"，這裡只關心大小。
   */
  function readTargetDeg(style: CSSStyleDeclaration): number {
    const raw = style.getPropertyValue(targetProperty)
    if (!raw) return 0
    const value = Math.abs(Number.parseFloat(raw))
    return Number.isFinite(value) ? value : 0
  }

  /** 每一幀檢查各滾輪是否跨過新的格線 */
  function tick(ts: number) {
    rafId = requestAnimationFrame(tick)

    const dt = ts - lastTs
    if (dt < MIN_SAMPLE_MS) return
    lastTs = ts

    const elements = getElements()
    const count = elements?.length ?? 0

    for (let i = 0; i < count; i++) {
      const el = elements![i]
      if (!el) continue

      // 一次取得 computed style，角度與終點共用，避免重複觸發樣式計算
      const style = getComputedStyle(el)
      const angle = readRotateX(style)
      if (angle === null) continue

      const state = states.get(el)
      if (!state) {
        // 第一幀只記下基準，還算不出位移
        states.set(el, { prevAngle: angle, netDeg: 0, emittedSteps: 0, inFinal: false })
        continue
      }

      // atan2 的值域是 ±180，轉過頭會回繞，取最短路徑還原真正的位移
      let delta = angle - state.prevAngle
      while (delta > 180) delta -= 360
      while (delta < -180) delta += 360

      state.prevAngle = angle
      state.netDeg += delta

      const reachedSteps = Math.floor(Math.abs(state.netDeg) / stepDeg)
      // 只在跨到「更遠」的格子時發聲；回彈退回時 pending 為負，自然不會重複觸發
      let pending = reachedSteps - state.emittedSteps
      if (pending <= 0) continue

      state.emittedSteps = reachedSteps

      // 判斷是否進入尾段。emittedSteps 上面已經更新過，
      // 所以進入尾段時不會把先前累積的格數一次補發出來
      if (finalSteps > 0) {
        const targetDeg = readTargetDeg(style)
        if (targetDeg > 0 && !state.inFinal) {
          const remainingSteps = (targetDeg - Math.abs(state.netDeg)) / stepDeg
          if (remainingSteps <= finalSteps) {
            state.inFinal = true
            onEnterFinal?.(i)
          }
        }
        // 還沒進入尾段就不發聲，這段期間交給循環音
        if (!state.inFinal) continue
      }

      // 掉幀後可能一次累積很多格，補發過多只會變成雜音
      pending = Math.min(pending, maxTicksPerFrame)

      for (let k = 0; k < pending; k++) {
        // 把這一幀要補的幾聲平均散在剛過去的這段時間裡，避免疊成一聲
        onTick({ index: i, delay: (dt / 1000) * (k / pending) })
      }
      tickCount.value += pending
    }
  }

  /**
   * transition 結束＝滾輪真正定位。
   * 不用計時器推算，因為那會跟實際算繪差上一段；transitionend 由瀏覽器
   * 在最後一幀套用完才派發，跟視覺上的停止完全同步。
   */
  function handleTransitionEnd(event: Event) {
    const e = event as TransitionEvent
    // 只認元素自己的 transform，忽略子元素冒泡上來的其他屬性
    if (e.propertyName !== 'transform') return
    const index = watchedElements.indexOf(e.currentTarget as Element)
    if (index < 0) return
    onSettle?.(index)
  }

  function bindSettleListeners() {
    unbindSettleListeners()
    const elements = getElements()
    const count = elements?.length ?? 0
    for (let i = 0; i < count; i++) {
      const el = elements![i]
      if (!el) continue
      el.addEventListener('transitionend', handleTransitionEnd)
      watchedElements.push(el)
    }
  }

  function unbindSettleListeners() {
    for (const el of watchedElements) {
      el.removeEventListener('transitionend', handleTransitionEnd)
    }
    watchedElements = []
  }

  /** 開始偵測 */
  function start() {
    if (typeof window === 'undefined' || rafId !== null) return
    // 重新開始時清掉上一輪的基準，否則第一幀會算出巨大的位移
    states = new WeakMap()
    lastTs = performance.now()
    tickCount.value = 0
    isMeasuring.value = true
    if (onSettle) bindSettleListeners()
    rafId = requestAnimationFrame(tick)
  }

  /** 停止偵測 */
  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    unbindSettleListeners()
    isMeasuring.value = false
  }

  onUnmounted(stop)

  return {
    tickCount,
    isMeasuring,
    start,
    stop,
  }
}

/** 把數值夾在區間內 */
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

/** Composable 的回傳型別，方便外部標註 */
export type UseReelTicksReturn = ReturnType<typeof useReelTicks>
