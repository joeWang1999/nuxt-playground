<template>
    <div class="flex justify-center items-center">
        <!-- 左上角音效開關 -->
        <button
            type="button"
            class="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60 active:scale-95"
            :aria-label="isAudible ? '關閉音樂' : '開啟音樂'"
            :title="isAudible ? '關閉音樂' : '開啟音樂'"
            @click="toggleSound"
        >
            <Volume2 v-if="isAudible" class="h-5 w-5" />
            <VolumeX v-else class="h-5 w-5" />
        </button>

        <SlotGame></SlotGame>
    </div>
</template>

<script setup lang="ts">
import { Volume2, VolumeX } from 'lucide-vue-next'
import SlotGame from '~/components/game/slotGame/SlotGame.vue';
import { useMusic } from '~/composables/useMusic'

// 背景音樂參數全部在此設定
// 循環之間的過場：前 1 秒漸強、最後 1 秒漸弱、中間靜默 1 秒
const { isAudible, toggleSound } = useMusic('/audio/game-bg-audio.mp3', {
    loop: true,
    volume: 0.5,
    playbackRate: 1,
    autoplay: true,
    fadeIn: 1,
    fadeOut: 1,
    loopGap: 1,
})
</script>
