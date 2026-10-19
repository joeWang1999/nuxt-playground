<template>
  <div class="min-h-screen bg-[#dbe9fb] p-6 flex flex-col gap-10 items-center">
    <div class="w-full max-w-[600px]">
      <PixelDialog ref="dialog" title="店員嘟嘟" @finished="onFinished">
        今年您一共在全家消費 <span class="highlight">{{ count }}</span> 次<br>
        贏過 <span class="highlight">{{ percent }}%</span> 的全家人
      </PixelDialog>
    </div>

    <div class="w-full max-w-[600px]">
      <PixelDialog title="無動畫" :animated="false">
        這個對話框關閉了逐字動畫，文字會直接顯示。
      </PixelDialog>
    </div>

    <div class="flex gap-3">
      <button class="px-4 py-2 bg-black text-white" @click="dialog.replay()">重播</button>
      <button class="px-4 py-2 bg-black text-white" @click="dialog.skip()">跳過</button>
      <button class="px-4 py-2 bg-black text-white" @click="count += 10">改內容</button>
    </div>
    <p class="text-sm text-gray-600">{{ status }}</p>
  </div>
</template>

<script setup>
const dialog = ref(null)
const count = ref(250)
const percent = ref(80)
const status = ref('打字中…')

function onFinished () {
  status.value = '文字顯示完畢'
}
</script>

<style scoped>
.highlight {
  color: #2f78c8;
  font-size: 2.6em;
  font-weight: 500;
  line-height: 1;
  vertical-align: -0.12em;
  margin: 0 0.1em;
}
</style>
