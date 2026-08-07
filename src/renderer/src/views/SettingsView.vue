<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { setLocale, type AppLocale } from '../i18n'
import { isDark, toggleDark } from '../theme'
import { formatDateTime, prefs } from '../prefs'

const router = useRouter()
const { t, locale } = useI18n()

const localeModel = computed({
  get: () => locale.value as AppLocale,
  set: (v: AppLocale) => setLocale(v)
})

const themeModel = computed({
  get: () => (isDark.value ? 'dark' : 'light'),
  set: (v: string) => {
    if ((v === 'dark') !== isDark.value) toggleDark()
  }
})

const languageOptions = [
  { label: 'English', value: 'en' },
  { label: 'Deutsch', value: 'de' }
]
const themeOptions = computed(() => [
  { label: t('settings.themeLight'), value: 'light' },
  { label: t('settings.themeDark'), value: 'dark' }
])
const dateFormatOptions = ['DD.MM.YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].map((f) => ({
  label: f,
  value: f
}))
const timeFormatOptions = computed(() => [
  { label: t('settings.time24'), value: '24h' },
  { label: t('settings.time12'), value: '12h' }
])

const example = computed(() => {
  void prefs.dateFormat
  void prefs.timeFormat
  return formatDateTime(new Date(2026, 4, 31, 17, 45, 9))
})
</script>

<template>
  <main class="view settings">
    <div class="panel">
      <div class="head">
        <Button
          v-tooltip.bottom="t('editor.back')"
          icon="pi pi-arrow-left"
          text
          severity="secondary"
          aria-label="Back"
          @click="router.back()"
        />
        <h1>{{ t('settings.title') }}</h1>
      </div>

      <div class="row">
        <label>{{ t('settings.language') }}</label>
        <Select
          v-model="localeModel"
          :options="languageOptions"
          option-label="label"
          option-value="value"
        />
      </div>

      <div class="row">
        <label>{{ t('settings.theme') }}</label>
        <SelectButton
          v-model="themeModel"
          :options="themeOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
      </div>

      <div class="row">
        <label>{{ t('settings.dateFormat') }}</label>
        <Select
          v-model="prefs.dateFormat"
          :options="dateFormatOptions"
          option-label="label"
          option-value="value"
        />
      </div>

      <div class="row">
        <label>{{ t('settings.timeFormat') }}</label>
        <SelectButton
          v-model="prefs.timeFormat"
          :options="timeFormatOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
      </div>

      <p class="example">{{ t('settings.example', { example }) }}</p>
      <p class="hint">{{ t('settings.shortcutHint') }}</p>
    </div>
  </main>
</template>

<style scoped>
.settings {
  align-items: center;
}
.panel {
  width: 100%;
  max-width: 34rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 1rem;
}
.head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.row {
  display: grid;
  grid-template-columns: 10rem 1fr;
  align-items: center;
  gap: 0.75rem;
}
.row :deep(.p-select) {
  width: 100%;
  max-width: 16rem;
}
.example {
  color: var(--p-text-muted-color);
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.9rem;
}
.hint {
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}
</style>
