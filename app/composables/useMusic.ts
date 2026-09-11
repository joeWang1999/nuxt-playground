import { ref, shallowRef, computed, watch, onUnmounted, toValue, type MaybeRefOrGetter } from 'vue'

// ================================================================
// 型別定義 (Type Definitions)
// ================================================================

/** Composable 對外可傳入的選項 */
export interface UseMusicOptions {
  /** 是否循環播放，預設 false */
  loop?: boolean
  /** 音量 0 ~ 1，預設 1 */
  volume?: number
  /** 播放速度，預設 1（0.25 ~ 4） */
  playbackRate?: number
  /** 是否保持音高（調速時不變聲），預設 true */
  preservesPitch?: boolean
  /** 建立後立刻播放（瀏覽器可能擋，見 unlockOnInteraction），預設 false */
  autoplay?: boolean
  /**
   * autoplay 被瀏覽器擋掉時，改在使用者第一次互動（點擊 / 觸控 / 按鍵）時自動播放。
   * 預設 true。
   */
  unlockOnInteraction?: boolean
  /**
   * 有聲自動播放被擋時，退而改用「靜音自動播放」（瀏覽器允許），
   * 音樂會實際開始跑，並在可以解除靜音時自動恢復音量。預設 true。
   */
  fallbackToMuted?: boolean
  /** 開頭淡入秒數，0 為不淡入。預設 0 */
  fadeIn?: number
  /** 結尾淡出秒數，0 為不淡出。預設 0 */
  fadeOut?: number
  /** 循環之間的靜默間隔秒數，0 為無縫接續。預設 0 */
  loopGap?: number
}

/** 播放速度的合法範圍（瀏覽器普遍支援） */
const MIN_RATE = 0.25
const MAX_RATE = 4

/** 淡入淡出的取樣間隔（毫秒），50ms 約 20fps，聽覺上已經平滑 */
const FADE_TICK_MS = 50

// ================================================================
// Composable
// ================================================================

/**
 * 音樂播放 composable
 *
 * @param source 音檔路徑，可傳入 ref / getter，變更時會自動換曲
 * @param options 初始設定
 *
 * @example
 * // 基本用法
 * const music = useMusic('/audio/bgm.mp3', { loop: true, volume: 0.6 })
 * music.play()
 *
 * @example
 * // 循環之間加過場：前 1 秒漸強、最後 1 秒漸弱、中間靜默 1 秒
 * useMusic('/audio/bgm.mp3', {
 *   loop: true,
 *   autoplay: true,
 *   fadeIn: 1,
 *   fadeOut: 1,
 *   loopGap: 1,
 * })
 */
export function useMusic(
  source: MaybeRefOrGetter<string>,
  options: UseMusicOptions = {},
) {
  const {
    loop: initialLoop = false,
    volume: initialVolume = 1,
    playbackRate: initialRate = 1,
    preservesPitch: initialPreservesPitch = true,
    autoplay = false,
    unlockOnInteraction = true,
    fallbackToMuted = true,
    fadeIn = 0,
    fadeOut = 0,
    loopGap = 0,
  } = options

  // ---- 狀態 ----
  /** HTMLAudioElement 實體，僅在 client 端建立 */
  const audio = shallowRef<HTMLAudioElement | null>(null)
  /** 是否正在播放 */
  const isPlaying = ref(false)
  /** 音檔是否已載入完成（可取得 duration） */
  const isReady = ref(false)
  /** 載入或播放的錯誤訊息 */
  const error = ref<string | null>(null)
  /** 目前播放秒數 */
  const currentTime = ref(0)
  /** 音檔總長度（秒），未載入時為 0 */
  const duration = ref(0)

  /** 是否循環播放 */
  const loop = ref(initialLoop)
  /** 使用者設定的目標音量 0 ~ 1（淡入淡出不會改到這個值） */
  const volume = ref(clamp(initialVolume, 0, 1))
  /** 播放速度 */
  const playbackRate = ref(clamp(initialRate, MIN_RATE, MAX_RATE))
  /** 是否靜音 */
  const muted = ref(false)
  /** 調速時是否保持音高 */
  const preservesPitch = ref(initialPreservesPitch)

  /** 播放進度 0 ~ 1 */
  const progress = computed(() => (duration.value > 0 ? currentTime.value / duration.value : 0))

  /** 使用者現在是否真的聽得到聲音（有播放且沒靜音） */
  const isAudible = computed(() => isPlaying.value && !muted.value)

  // ================================================================
  // 淡入淡出與循環間隔 (Fade & Gap)
  // ================================================================

  /** 有設定任何過場效果時就得自己接管循環（原生 loop 無法插入間隔，也不會觸發 ended） */
  const hasTransition = fadeIn > 0 || fadeOut > 0 || loopGap > 0

  /** 淡入淡出增益 0 ~ 1，與 volume 相乘後才寫進 element */
  const fadeGain = ref(fadeIn > 0 ? 0 : 1)
  /** 是否正處於兩次循環之間的靜默間隔 */
  const isInGap = ref(false)

  let fadeTimer: ReturnType<typeof setInterval> | null = null
  let gapTimer: ReturnType<typeof setTimeout> | null = null

  /** 把「使用者音量 × 淡入淡出增益」寫進 element */
  function applyVolume() {
    const el = audio.value
    if (!el) return
    el.volume = clamp(volume.value * fadeGain.value, 0, 1)
  }

  /** 依目前播放位置算出該有的增益 */
  function computeFadeGain(el: HTMLAudioElement): number {
    const t = el.currentTime
    const total = Number.isFinite(el.duration) ? el.duration : 0

    let gain = 1
    if (fadeIn > 0) gain = Math.min(gain, t / fadeIn)
    // 長度未知時算不出淡出，維持原音量
    if (fadeOut > 0 && total > 0) gain = Math.min(gain, (total - t) / fadeOut)

    return clamp(gain, 0, 1)
  }

  /** 淡入淡出的定時取樣 */
  function fadeTick() {
    const el = audio.value
    if (!el || el.paused) return
    fadeGain.value = computeFadeGain(el)
    applyVolume()
  }

  function startFadeTicker() {
    if (!hasTransition || fadeTimer !== null) return
    fadeTimer = setInterval(fadeTick, FADE_TICK_MS)
  }

  function stopFadeTicker() {
    if (fadeTimer === null) return
    clearInterval(fadeTimer)
    fadeTimer = null
  }

  function clearGapTimer() {
    if (gapTimer === null) return
    clearTimeout(gapTimer)
    gapTimer = null
    isInGap.value = false
  }

  /** 播完一輪後，靜默 loopGap 秒再從頭淡入播放 */
  function scheduleLoopRestart() {
    clearGapTimer()
    isInGap.value = true
    fadeGain.value = fadeIn > 0 ? 0 : 1
    applyVolume()

    gapTimer = setTimeout(() => {
      gapTimer = null
      isInGap.value = false

      const el = audio.value
      // 間隔期間若使用者已關掉循環，就不要硬是接下去
      if (!el || !loop.value) return
      el.currentTime = 0
      currentTime.value = 0
      void play()
    }, loopGap * 1000)
  }

  // ---- 事件處理 ----
  function handleLoadedMetadata() {
    isReady.value = true
    duration.value = audio.value?.duration ?? 0
  }

  function handleTimeUpdate() {
    currentTime.value = audio.value?.currentTime ?? 0
  }

  function handlePlay() {
    isPlaying.value = true
    startFadeTicker()
  }

  function handlePause() {
    isPlaying.value = false
    stopFadeTicker()
  }

  function handleEnded() {
    isPlaying.value = false
    stopFadeTicker()

    // 自己接管循環：靜默一段時間再重播
    if (hasTransition && loop.value) {
      scheduleLoopRestart()
      return
    }
    currentTime.value = 0
  }

  function handleError() {
    error.value = `音檔載入失敗：${toValue(source)}`
    isReady.value = false
    isPlaying.value = false
  }

  /** 綁定事件監聽 */
  function bindEvents(el: HTMLAudioElement) {
    el.addEventListener('loadedmetadata', handleLoadedMetadata)
    el.addEventListener('timeupdate', handleTimeUpdate)
    el.addEventListener('play', handlePlay)
    el.addEventListener('pause', handlePause)
    el.addEventListener('ended', handleEnded)
    el.addEventListener('error', handleError)
  }

  /** 移除事件監聽 */
  function unbindEvents(el: HTMLAudioElement) {
    el.removeEventListener('loadedmetadata', handleLoadedMetadata)
    el.removeEventListener('timeupdate', handleTimeUpdate)
    el.removeEventListener('play', handlePlay)
    el.removeEventListener('pause', handlePause)
    el.removeEventListener('ended', handleEnded)
    el.removeEventListener('error', handleError)
  }

  /** 把目前所有設定套用到 audio element 上 */
  function applySettings(el: HTMLAudioElement) {
    // 有過場效果時必須關掉原生 loop，否則 ended 不觸發、也插不進間隔
    el.loop = loop.value && !hasTransition
    el.muted = muted.value
    el.playbackRate = playbackRate.value
    applyVolume()
    applyPreservesPitch(el, preservesPitch.value)
  }

  /**
   * 設定調速時是否保持音高。
   * 標準屬性是 preservesPitch，iOS 17 以前的 Safari 只認 webkitPreservesPitch，
   * 兩個都寫才能在手機上生效。
   */
  function applyPreservesPitch(el: HTMLAudioElement, value: boolean) {
    const target = el as HTMLAudioElement & {
      preservesPitch?: boolean
      webkitPreservesPitch?: boolean
    }
    if ('preservesPitch' in target) target.preservesPitch = value
    if ('webkitPreservesPitch' in target) target.webkitPreservesPitch = value
  }

  /**
   * 取得（必要時建立）audio element。
   * SSR 期間沒有 Audio 建構子，回傳 null。
   */
  function ensureAudio(): HTMLAudioElement | null {
    // 不依賴 Nuxt 專屬的 import.meta.server，純 Vue 專案也能直接用
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return null
    if (audio.value) return audio.value

    const el = new Audio(toValue(source))
    el.preload = 'metadata'
    audio.value = el
    applySettings(el)
    bindEvents(el)
    return el
  }

  // ================================================================
  // 對外操作 (Actions)
  // ================================================================

  /** 播放；瀏覽器擋自動播放時會把原因寫進 error */
  async function play() {
    const el = ensureAudio()
    if (!el) return

    error.value = null
    // 先把增益算好，避免第一次取樣前爆出全音量
    if (hasTransition) {
      fadeGain.value = computeFadeGain(el)
      applyVolume()
    }

    try {
      await el.play()
    }
    catch (e) {
      error.value = e instanceof Error ? e.message : '播放失敗'
      isPlaying.value = false
    }
  }

  /** 暫停，保留播放進度 */
  function pause() {
    clearGapTimer()
    audio.value?.pause()
  }

  /** 切換播放 / 暫停 */
  function toggle() {
    if (isPlaying.value) pause()
    else void play()
  }

  /** 停止並回到開頭 */
  function stop() {
    clearGapTimer()
    const el = audio.value
    if (!el) return
    el.pause()
    el.currentTime = 0
    currentTime.value = 0
    fadeGain.value = fadeIn > 0 ? 0 : 1
    applyVolume()
  }

  /** 跳到指定秒數 */
  function seek(seconds: number) {
    const el = audio.value
    if (!el) return
    el.currentTime = clamp(seconds, 0, duration.value || Number.MAX_SAFE_INTEGER)
    currentTime.value = el.currentTime
    if (hasTransition) fadeTick()
  }

  /** 更換音檔；原本在播放的話會接著播新的 */
  function setSource(src: string) {
    const el = ensureAudio()
    if (!el) return

    clearGapTimer()
    const wasPlaying = isPlaying.value
    isReady.value = false
    error.value = null
    duration.value = 0
    currentTime.value = 0
    fadeGain.value = fadeIn > 0 ? 0 : 1
    el.src = src
    el.load()
    applySettings(el)
    if (wasPlaying) void play()
  }

  /** 設定是否循環播放 */
  function setLoop(value: boolean) {
    loop.value = value
  }

  /** 設定音量（0 ~ 1，超出會被夾住） */
  function setVolume(value: number) {
    volume.value = clamp(value, 0, 1)
  }

  /** 設定播放速度（0.25 ~ 4，超出會被夾住） */
  function setPlaybackRate(value: number) {
    playbackRate.value = clamp(value, MIN_RATE, MAX_RATE)
  }

  /** 設定靜音 */
  function setMuted(value: boolean) {
    muted.value = value
  }

  /**
   * 切換「聽得到 / 聽不到」，給單一顆音效按鈕用。
   * 注意：必須在使用者手勢的同一個 task 內同步呼叫，前面不要 await。
   */
  function toggleSound() {
    if (isAudible.value) {
      setMuted(true)
      return
    }
    // 先解除靜音再確保在播放，這樣靜音墊底的情況不會中斷進度
    setMuted(false)
    if (audio.value) audio.value.muted = false
    // 正在循環間隔中就讓它自己接下去，不要打斷過場
    if (isInGap.value) return
    if (!audio.value || audio.value.paused) void play()
  }

  /** 釋放資源：停止播放並解除事件與來源 */
  function destroy() {
    removeUnlockListeners()
    stopFadeTicker()
    clearGapTimer()
    const el = audio.value
    if (!el) return
    el.pause()
    unbindEvents(el)
    el.src = ''
    audio.value = null
    isPlaying.value = false
    isReady.value = false
  }

  // ================================================================
  // 同步：狀態變動 → audio element
  // ================================================================

  watch(loop, (value) => {
    if (audio.value) audio.value.loop = value && !hasTransition
    // 關掉循環時要取消還在等待的間隔重播
    if (!value) clearGapTimer()
  })

  watch(volume, applyVolume)

  watch(muted, (value) => {
    if (audio.value) audio.value.muted = value
  })

  watch(playbackRate, (value) => {
    if (audio.value) audio.value.playbackRate = value
  })

  watch(preservesPitch, (value) => {
    if (audio.value) applyPreservesPitch(audio.value, value)
  })

  // source 是 ref / getter 時，跟著換曲
  watch(() => toValue(source), (src) => {
    if (src && audio.value) setSource(src)
  })

  // ================================================================
  // 自動播放與互動解鎖 (Autoplay)
  // ================================================================

  /** 用來解鎖播放的使用者互動事件 */
  const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const

  /** 是否因瀏覽器 autoplay policy 而在等待使用者互動 */
  const isWaitingForInteraction = ref(false)

  function removeUnlockListeners() {
    if (typeof window === 'undefined') return
    for (const type of UNLOCK_EVENTS) window.removeEventListener(type, handleUnlock)
    isWaitingForInteraction.value = false
  }

  /** 使用者一互動就重試播放；若正在靜音墊底播放，則解除靜音 */
  function handleUnlock() {
    removeUnlockListeners()
    if (isPlaying.value && muted.value) {
      // 已經靜音在跑，只要恢復音量即可（不中斷進度）
      setMuted(false)
      return
    }
    void play()
  }

  /** 掛上一次性的互動監聽，等使用者操作後再播 */
  function waitForInteraction() {
    if (typeof window === 'undefined' || isWaitingForInteraction.value) return
    isWaitingForInteraction.value = true
    for (const type of UNLOCK_EVENTS) {
      window.addEventListener(type, handleUnlock, { once: true, passive: true })
    }
  }

  /**
   * 立刻嘗試播放；被瀏覽器 autoplay policy 擋掉時，
   * 退回到「使用者第一次互動時播放」。
   */
  async function autoplayOrWait() {
    await play()

    // isPlaying 由事件驅動，這裡改讀 element 的即時狀態
    const playing = () => !!audio.value && !audio.value.paused

    // 有聲播放被擋 → 改用靜音播放，讓音樂實際開始跑
    if (!playing() && fallbackToMuted) {
      error.value = null
      muted.value = true
      if (audio.value) audio.value.muted = true
      await play()

      // 靜音播起來後，試著立刻解除靜音（部分瀏覽器允許）
      if (playing()) {
        if (audio.value) audio.value.muted = false
        muted.value = false

        // 解除靜音若導致瀏覽器暫停，就退回靜音繼續跑
        if (!playing()) {
          if (audio.value) audio.value.muted = true
          muted.value = true
          await play()
        }
      }
    }

    // 仍然沒聲音（沒播成功、或還在靜音）→ 等使用者第一次互動
    if (unlockOnInteraction && (!playing() || muted.value)) {
      error.value = null
      waitForInteraction()
    }
  }

  if (autoplay) void autoplayOrWait()

  onUnmounted(destroy)

  return {
    // 狀態
    audio,
    isPlaying,
    isReady,
    error,
    currentTime,
    duration,
    progress,
    loop,
    volume,
    playbackRate,
    muted,
    isAudible,
    preservesPitch,
    fadeGain,
    isInGap,
    isWaitingForInteraction,
    // 操作
    play,
    pause,
    toggle,
    stop,
    seek,
    setSource,
    setLoop,
    setVolume,
    setPlaybackRate,
    setMuted,
    toggleSound,
    autoplayOrWait,
    destroy,
  }
}

/** 把數值夾在區間內 */
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

/** Composable 的回傳型別，方便外部標註 */
export type UseMusicReturn = ReturnType<typeof useMusic>
