
<template>
  <div class="flex h-screen flex-col overflow-hidden bg-slate-50">
    <header class="z-20 shrink-0 border-b border-slate-200 bg-white">
      <nav class="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <p class="text-sm font-semibold text-slate-800">Nuxt Playground</p>
        <div class="flex items-center gap-2">
          <NuxtLink
            to="/"
            class="rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            active-class="bg-slate-800 text-white hover:bg-slate-800"
            exact-active-class="bg-slate-800 text-white hover:bg-slate-800"
          >
            圖框
          </NuxtLink>
          <NuxtLink
            to="/name-sticker"
            class="rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            active-class="bg-slate-800 text-white hover:bg-slate-800"
            exact-active-class="bg-slate-800 text-white hover:bg-slate-800"
          >
            姓名貼
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

    <main class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <NuxtPage class="h-full min-h-0 flex-1 overflow-hidden" />
    </main>
  </div>
</template>
  <script setup lang="ts">
  import "@/assets/fonts.css";
  </script>

<style>
html,
body,
#__nuxt {
  width: 100%;
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
}
</style>
