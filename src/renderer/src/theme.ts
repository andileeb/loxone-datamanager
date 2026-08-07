import { ref, watchEffect } from 'vue'

const STORAGE_KEY = 'ldm.dark'

const saved = localStorage.getItem(STORAGE_KEY)
export const isDark = ref(
  saved !== null ? saved === '1' : window.matchMedia('(prefers-color-scheme: dark)').matches
)

// PrimeVue's darkModeSelector points at this class (see main.ts)
watchEffect(() => {
  document.documentElement.classList.toggle('app-dark', isDark.value)
})

export function toggleDark(): void {
  isDark.value = !isDark.value
  localStorage.setItem(STORAGE_KEY, isDark.value ? '1' : '0')
}
