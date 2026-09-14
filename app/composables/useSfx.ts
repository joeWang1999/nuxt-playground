import { ref, onUnmounted } from 'vue'

// ================================================================
// 型別定義 (Type Definitions)
// ================================================================

/** Composable 對外可傳入的選項 */
export interface UseSfxOptions {
  /** 音量 0 ~ 1，預設 1 */
  volume?: number
  /**
   * 同時最多幾個聲音疊在一起，超過就略過不播。
   * 防止極端情況下（例如長時間掉幀後一次補發）堆出過多節點。預設 24
   */
  maxVoices?: number
  /**
   * 每次播放隨機微調音高的幅度 0 ~ 1（例如 0.06 為 ±6%）。
   * 連續快速觸發同一個取樣會有「機關槍」的機械感，加一點點變化會自然許多。
   * 預設 0（完全不變調）
   */
  pitchJitter?: number
  /**
   * 單聲道模式：同時只允許一個聲音，新的觸發會把前一聲接手掉（voice stealing）。
   *
   * 觸發密集時每聲會被下一聲截短、間隔拉長後才完整響完，
   * 所以節奏會跟著觸發頻率自然疏密，但永遠不會疊加。預設 false
   */
  mono?: boolean
  /**
   * 單聲道模式下，新觸發撞上還在發聲的前一聲時怎麼處理：
   * - 'steal'：接手，前一聲淡出停止（每聲被截短，節奏完全跟隨觸發頻率）
   * - 'drop'：略過，讓前一聲完整播完（每聲都完整，但觸發頻率高於音檔長度時會被吃掉）
   *
   * 預設 'steal'
   */
  monoPolicy?: 'steal' | 'drop'
}

// ================================================================
// 共用資源 (Shared Resources)
// ================================================================

/**
 * 整頁共用一個 AudioContext。
 *
 * 一來瀏覽器對同時存在的 AudioContext 數量有上限，二來共用之後
 * 單一 composable 卸載時不需要（也不應該）關閉它——關閉會把正在
 * 發聲的節點一併切斷，最後一聲就被截掉了。
 */
let sharedCtx: AudioContext | null = null

/**
 * 單聲道模式接手前一聲時的淡出秒數。
 * 直接 stop() 會從波形中間硬切而產生爆音，8ms 已足夠消除且聽不出被截。
 */
const STEAL_FADE_SEC = 0.008

/** 依網址快取原始位元組，同一個檔案被多個 composable 使用時只抓一次 */
const bytesCache = new Map<string, Promise<ArrayBuffer | null>>()
/** 依網址快取解碼結果，同一個檔案只解碼一次 */
const bufferCache = new Map<string, Promise<AudioBuffer | null>>()

/** 取得（必要時建立）共用的 AudioContext */
function getSharedContext(): AudioContext | null {
  if (sharedCtx) return sharedCtx
  if (typeof window === 'undefined') return null

  const Ctor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null

  sharedCtx = new Ctor()
  return sharedCtx
}

/** 抓取音檔位元組，不需要 AudioContext，所以可以很早就開始 */
function fetchBytes(src: string): Promise<ArrayBuffer | null> {
  const cached = bytesCache.get(src)
  if (cached) return cached

  const task = typeof fetch === 'undefined'
    ? Promise.resolve(null)
    : fetch(src)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.arrayBuffer()
        })
        .catch(() => null)

  bytesCache.set(src, task)
  return task
}

/** 把位元組解碼成可播放的 buffer */
function decodeBuffer(src: string, ctx: AudioContext): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(src)
  if (cached) return cached

  const task = fetchBytes(src)
    .then((bytes) => {
      if (!bytes) return null
      // decodeAudioData 會吃掉（detach）傳入的 ArrayBuffer，所以給它複本
      return ctx.decodeAudioData(bytes.slice(0))
    })
    .catch(() => null)

  bufferCache.set(src, task)
  return task
}

// ================================================================
// Composable
// ================================================================

/**
 * 短音效播放器，用 Web Audio 播放同一段取樣、可大量重疊觸發。
 *
 * 跟 useMusic 的差別：useMusic 是一個 HTMLAudioElement 播一首曲子，
 * 同一時間只能有一個播放位置；這個是把音檔解碼成 buffer，
 * 每次觸發都建立一個極輕量的 source node，所以可以每秒觸發數十次而互不干擾。
 *
 * 已經開始發聲的音一定會播完整——元件卸載不會中斷它們。
 *
 * @param source 音檔路徑
 * @param options 音量與疊音設定
 *
 * @example
 * const click = useSfx('/audio/click.mp3', { volume: 0.5 })
 * onMounted(click.preload)      // 先把檔案抓下來
 * function onUserClick() {
 *   click.unlock()              // 必須在使用者手勢內呼叫一次
 *   click.play()
 *   click.play(0, true)         // priority：即使額滿也保證播出
 * }
 */
export function useSfx(source: string, options: UseSfxOptions = {}) {
  const {
    volume: initialVolume = 1,
    maxVoices = 24,
    pitchJitter = 0,
    mono = false,
    monoPolicy = 'steal',
  } = options

  /** 解碼完成、可以觸發了 */
  const isReady = ref(false)
  /** 載入或解碼的錯誤訊息 */
  const error = ref<string | null>(null)
  /** 目前正在發聲的節點數 */
  const activeVoices = ref(0)
  /** 音量 0 ~ 1 */
  const volume = ref(clamp(initialVolume, 0, 1))

  let gainNode: GainNode | null = null
  let buffer: AudioBuffer | null = null
  let isDestroyed = false
  /** 目前的循環音節點，同時只會有一個，確保循環不疊加 */
  let loopNode: AudioBufferSourceNode | null = null
  /** 呼叫 startLoop 時 buffer 可能還沒解碼完，記下意圖等解碼好再補開 */
  let wantLoop = false
  /** 單聲道模式下目前正在發聲的那一個，新的觸發要先把它接手掉 */
  let currentVoice: { node: AudioBufferSourceNode, gain: GainNode } | null = null
  /** 單聲道發聲會持續到這個時間點（ctx 時間軸），drop 策略用它判斷是否略過 */
  let voiceBusyUntil = 0
  /** 目前已排定的最後一個聲音會在什麼時候結束（ctx.currentTime 的時間軸） */
  let voicesEndAt = 0

  /** 建立這個 composable 專屬的音量節點，掛在共用的 context 上 */
  function ensureGain(): GainNode | null {
    if (gainNode) return gainNode
    const ctx = getSharedContext()
    if (!ctx) {
      error.value = '此瀏覽器不支援 Web Audio'
      return null
    }
    gainNode = ctx.createGain()
    gainNode.gain.value = volume.value
    gainNode.connect(ctx.destination)
    return gainNode
  }

  /**
   * 先把音檔位元組抓下來。
   * 不需要 AudioContext，所以可以在 onMounted 就做，
   * 第一次觸發時才不會因為還在下載而漏掉幾聲。
   */
  function preload(): Promise<void> {
    return fetchBytes(source).then((bytes) => {
      if (!bytes) error.value = `音效載入失敗：${source}`
    })
  }

  /**
   * 解鎖音訊輸出。必須在使用者手勢（click / touch）的處理器內同步呼叫一次，
   * 否則 AudioContext 會一直停在 suspended 狀態而沒有聲音。
   */
  function unlock() {
    const ctx = getSharedContext()
    if (!ctx) {
      error.value = '此瀏覽器不支援 Web Audio'
      return
    }
    if (ctx.state === 'suspended') void ctx.resume()
    ensureGain()

    void decodeBuffer(source, ctx).then((decoded) => {
      if (!decoded) {
        error.value = `音效解碼失敗：${source}`
        return
      }
      buffer = decoded
      isReady.value = true
      // 解碼完成前就被要求循環，這裡補開
      if (wantLoop && !loopNode) startLoop()
    })
  }

  /**
   * 開始循環播放。
   *
   * 只會有一個節點在跑，重複呼叫不會疊加；用 Web Audio 的原生 loop，
   * 接點由取樣本身決定，不像 HTMLAudioElement 每圈都要重新起播。
   */
  function startLoop() {
    if (isDestroyed) return
    wantLoop = true
    if (loopNode) return

    const ctx = getSharedContext()
    const gain = ensureGain()
    if (!ctx || !gain || !buffer) return

    const node = ctx.createBufferSource()
    node.buffer = buffer
    node.loop = true
    node.connect(gain)
    node.start()
    loopNode = node
  }

  /** 停止循環播放（不影響已經觸發的單次音效） */
  function stopLoop() {
    wantLoop = false
    if (!loopNode) return
    try {
      loopNode.stop()
    }
    catch {
      // 已經停止的節點再 stop 會丟例外，忽略即可
    }
    loopNode.disconnect()
    loopNode = null
  }

  /**
   * 觸發一次音效。
   *
   * @param delay 延後幾秒發聲，用來把同一幀內要補發的多次觸發錯開
   * @param priority 略過疊音上限，保證這一聲一定會播出（例如定位聲）
   */
  function play(delay = 0, priority = false) {
    if (isDestroyed) return
    const ctx = getSharedContext()
    const gain = ensureGain()
    if (!ctx || !gain || !buffer) return
    if (!priority && activeVoices.value >= maxVoices) return

    const node = ctx.createBufferSource()
    node.buffer = buffer

    if (pitchJitter > 0) {
      // 只做極小幅度的變化，避免變成明顯的變速失真
      node.playbackRate.value = 1 + (Math.random() * 2 - 1) * pitchJitter
    }

    const startAt = ctx.currentTime + Math.max(0, delay)

    let voiceGain = null
    if (mono && monoPolicy === 'drop') {
      // 前一聲還沒播完就略過這次觸發，確保每一聲都完整
      if (startAt < voiceBusyUntil) return
      node.connect(gain)
    }
    else if (mono) {
      // steal：先讓前一聲淡出再停，然後把新聲接上自己的音量節點
      stealCurrentVoice(startAt)
      voiceGain = ctx.createGain()
      voiceGain.connect(gain)
      node.connect(voiceGain)
    }
    else {
      node.connect(gain)
    }

    activeVoices.value++
    node.onended = () => {
      activeVoices.value--
      node.disconnect()
      voiceGain?.disconnect()
      if (currentVoice?.node === node) currentVoice = null
    }

    node.start(startAt)
    if (voiceGain) currentVoice = { node, gain: voiceGain }
    if (mono) voiceBusyUntil = startAt + node.buffer.duration / node.playbackRate.value
    // 記下最晚的結束時間，卸載時才知道要等多久才能收掉音量節點
    voicesEndAt = Math.max(voicesEndAt, startAt + node.buffer.duration / node.playbackRate.value)
  }

  /**
   * 讓目前發聲中的那一聲淡出並停止。
   * 淡出而非直接 stop，是為了避免波形被硬切而發出爆音。
   */
  function stealCurrentVoice(at: number) {
    if (!currentVoice) return
    const { node, gain } = currentVoice
    currentVoice = null

    gain.gain.cancelScheduledValues(at)
    gain.gain.setValueAtTime(gain.gain.value, at)
    gain.gain.linearRampToValueAtTime(0, at + STEAL_FADE_SEC)
    try {
      node.stop(at + STEAL_FADE_SEC)
    }
    catch {
      // 已經停止的節點再 stop 會丟例外，忽略即可
    }
  }

  /** 設定音量（0 ~ 1，超出會被夾住） */
  function setVolume(value: number) {
    volume.value = clamp(value, 0, 1)
    if (gainNode) gainNode.gain.value = volume.value
  }

  /**
   * 停止接受新的觸發並釋放音量節點。
   *
   * 不關閉共用的 AudioContext，而且會等已排定的聲音播完才斷開，
   * 所以元件在最後一聲還在響的時候卸載，那一聲仍然會完整播完。
   */
  function destroy() {
    if (isDestroyed) return
    isDestroyed = true
    isReady.value = false
    stopLoop()
    currentVoice = null
    voiceBusyUntil = 0

    const ctx = sharedCtx
    const gain = gainNode
    gainNode = null
    buffer = null
    if (!ctx || !gain) return

    const remainMs = Math.max(0, voicesEndAt - ctx.currentTime) * 1000
    if (remainMs <= 0) {
      gain.disconnect()
      return
    }
    // 多留一點餘裕，確保尾音完全送出去才斷開
    setTimeout(() => gain.disconnect(), remainMs + 100)
  }

  onUnmounted(destroy)

  return {
    // 狀態
    isReady,
    error,
    activeVoices,
    volume,
    // 操作
    preload,
    unlock,
    play,
    startLoop,
    stopLoop,
    setVolume,
    destroy,
  }
}

/** 把數值夾在區間內 */
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

/** Composable 的回傳型別，方便外部標註 */
export type UseSfxReturn = ReturnType<typeof useSfx>
