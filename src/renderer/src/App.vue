<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// Cmd+, (macOS) / Ctrl+, (Windows/Linux) opens the settings, like native apps
function onKeydown(e: KeyboardEvent): void {
  if ((e.metaKey || e.ctrlKey) && e.key === ',') {
    e.preventDefault()
    if (router.currentRoute.value.path !== '/settings') router.push('/settings')
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <router-view />
</template>
