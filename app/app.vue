
<template>
  <div class="min-h-screen bg-slate-50 flex flex-col">
    <header class="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav class="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <p class="text-sm font-semibold text-slate-800">Nuxt Playground</p>
        <div class="flex items-center gap-2">
          <NuxtLink
            to="/"
            class="rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            active-class="bg-slate-800 text-white hover:bg-slate-800"
            exact-active-class="bg-slate-800 text-white hover:bg-slate-800"
          >
            一般編輯
          </NuxtLink>
          <NuxtLink
            to="/name-sticker"
            class="rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            active-class="bg-slate-800 text-white hover:bg-slate-800"
            exact-active-class="bg-slate-800 text-white hover:bg-slate-800"
          >
            姓名貼編輯
          </NuxtLink>
          <NuxtLink
            to="/diy-frame"
            class="rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            active-class="bg-slate-800 text-white hover:bg-slate-800"
            exact-active-class="bg-slate-800 text-white hover:bg-slate-800"
          >
            DIY 套框
          </NuxtLink>
        </div>
      </nav>
    </header>

    <main class="flex-1 flex flex-col">
      <NuxtPage class="flex-1" />
    </main>
  </div>
</template>
  <script setup lang="ts">
  import "@/assets/fonts.css";
  </script>
