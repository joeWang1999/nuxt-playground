<template>
    <div class="flex justify-center items-center min-h-screen">
        <SlotGame3s @result="onResult" />
    </div>
</template>

<script setup lang="ts">
import SlotGame3s from '~/components/game/slotGame/SlotGame3s.vue'

interface SlotResult {
    gifts: string[]
    isWin: boolean
}

// 彈窗跳出時一併把結果拋上來，方便接後端或記錄
function onResult(result: SlotResult) {
    console.log('結果：', result.gifts, result.isWin ? '中獎' : '未中獎')
}
</script>
