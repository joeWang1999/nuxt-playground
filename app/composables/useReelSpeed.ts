import { ref, onUnmounted } from 'vue'

// ================================================================
// 型別定義 (Type Definitions)
// ================================================================

/** Composable 對外可傳入的選項 */
export interface UseReelSpeedOptions {
  /** 視為「全速」的角速度（deg/ms），用來把速度正規化成 0 ~ 1。預設 2.5 */
  maxSpeed?: number
  /**
   * 正規化後再套的次方曲線。
   * 拉霸的 easing 極度前重（約 16% 的時間跑完 60% 的角度），
   * 直接線性對應會讓大部分時間都貼在低速；< 1 可以把減速過程拉長。預設 0.5
   */
  curve?: number
  /** 指數平滑係數 0 ~ 1，越小越平滑（抗掉幀抖動）。預設 0.25 */
  smoothing?: number
}

const RAD_TO_DEG = 180 / Math.PI

/** 兩次取樣間隔小於此值就跳過，避免除以過小的 dt 炸出尖峰（毫秒） */
const MIN_SAMPLE_MS = 8

// ================================================================
// Composable
// ================================================================

/**
 * 量測一組元素的 rotateX 角速度。
 *
 * 不依賴任何動畫實作細節（CSS transition / animation / JS 都可），
 * 而是每一幀讀 getComputedStyle 的 transform 矩陣、對角度做差分，
 * 所以改了 CSS 的 easing 或時長都會自動跟上。
 *
 * @param getElements 回傳要量測的元素，會在每一幀重新呼叫
 * @param options 正規化與平滑設定
 *
 * @example
 * const reel = useReelSpeed(() => rootEl.value?.querySelectorAll('.gift-container'))
 * reel.start()   // 開始轉動時
 * reel.stop()    // 全部停止時
 * watch(reel.normalized, n => music.setPlaybackRate(0.5 + n * 1.5))
 */
export function useReelSpeed(
  getElements: () => ArrayLike<Element> | null | undefined,
  options: UseReelSpeedOptions = {},
) {
  const {
    maxSpeed = 2.5,
    curve = 0.5,
    smoothing = 0.25,
  } = options

  /** 目前角速度（deg/ms），取所有元素中最快的那個 */
  const speed = ref(0)
  /** 本次量測期間出現過的最高速，用來校正 maxSpeed */
  const peakSpeed = ref(0)
  /** 正規化並套上曲線後的 0 ~ 1，適合直接對應到播放速率 */
  const normalized = ref(0)
  /** 是否正在量測 */
  const isMeasuring = ref(false)

  let rafId: number | null = null
  let lastTs = 0
  /** 每個元素上一次的角度，用 WeakMap 避免元素被移除後還留著參考 */
  let lastAngles = new WeakMap<Element, number>()

  /**
   * 從 computed transform 取出 rotateX 角度。
   * transition 進行中讀到的是「當下插值後」的矩陣，所以能拿到即時角度。
   */
  function readRotateX(el: Element): number | null {
    const transform = getComputedStyle(el).transform
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

    // 退化成 2D matrix(a,b,c,d,e,f) 時只剩 d = cos，拿不到正負號，
    // 角度會在 0~180 之間來回；僅作為保險，實務上 preserve-3d 會給 matrix3d
    if (transform.startsWith('matrix')) {
      const d = n[3]
      if (d === undefined) return null
      return Math.acos(clamp(d, -1, 1)) * RAD_TO_DEG
    }

    return null
  }

  /** 每一幀取樣一次，取所有滾輪中最快的角速度 */
  function tick(ts: number) {
    rafId = requestAnimationFrame(tick)

    const dt = ts - lastTs
    if (dt < MIN_SAMPLE_MS) return
    lastTs = ts

    const elements = getElements()
    let fastest = 0

    for (let i = 0; i < (elements?.length ?? 0); i++) {
      const el = elements![i]
      if (!el) continue

      const angle = readRotateX(el)
      if (angle === null) continue

      const prev = lastAngles.get(el)
      lastAngles.set(el, angle)
      if (prev === undefined) continue

      // atan2 的值域是 ±180，轉過頭會回繞，取最短路徑還原真正的位移
      let delta = angle - prev
      while (delta > 180) delta -= 360
      while (delta < -180) delta += 360

      fastest = Math.max(fastest, Math.abs(delta) / dt)
    }

    // 指數平滑：掉一幀不會讓速度瞬間歸零
    speed.value += (fastest - speed.value) * smoothing
    peakSpeed.value = Math.max(peakSpeed.value, speed.value)

    const ratio = clamp(speed.value / maxSpeed, 0, 1)
    normalized.value = curve === 1 ? ratio : ratio ** curve
  }

  /** 開始量測 */
  function start() {
    if (typeof window === 'undefined' || rafId !== null) return
    // 重新開始時清掉上一輪的角度基準，否則第一幀會算出巨大的位移
    lastAngles = new WeakMap()
    lastTs = performance.now()
    speed.value = 0
    peakSpeed.value = 0
    normalized.value = 0
    isMeasuring.value = true
    rafId = requestAnimationFrame(tick)
  }

  /** 停止量測並歸零 */
  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    isMeasuring.value = false
    speed.value = 0
    normalized.value = 0
  }

  onUnmounted(stop)

  return {
    speed,
    peakSpeed,
    normalized,
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
export type UseReelSpeedReturn = ReturnType<typeof useReelSpeed>
