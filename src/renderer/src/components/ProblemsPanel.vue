<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Problem } from '../../../shared/types'

defineProps<{ problems: Problem[] }>()
defineEmits<{ goto: [row: number] }>()
const { t, te } = useI18n()

function text(p: Problem): string {
  if (p.rule === 'timestamp-outside-month') {
    const isLast = p.severity === 'warning'
    return t(`problem.timestamp-outside-month-${isLast ? 'last' : 'mid'}`)
  }
  return te(`problem.${p.rule}`) ? t(`problem.${p.rule}`) : p.message
}
</script>

<template>
  <div class="problems">
    <div
      v-for="(p, i) in problems"
      :key="i"
      class="problem"
      :class="p.severity"
      role="button"
      @click="p.row !== null && $emit('goto', p.row)"
    >
      <i :class="p.severity === 'error' ? 'pi pi-times-circle' : 'pi pi-exclamation-triangle'" />
      <span v-if="p.row !== null" class="row">#{{ p.row + 1 }}</span>
      <span>{{ text(p) }}</span>
    </div>
    <div v-if="!problems.length" class="ok">
      <i class="pi pi-check-circle" /> {{ t('editor.noProblems') }}
    </div>
  </div>
</template>

<style scoped>
.problems {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  overflow-y: auto;
}
.problem {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}
.problem:hover {
  background: var(--p-content-hover-background);
}
.problem.error i {
  color: var(--p-red-500);
}
.problem.warning i {
  color: var(--p-amber-500);
}
.row {
  font-family: ui-monospace, Menlo, monospace;
  color: var(--p-text-muted-color);
}
.ok {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--p-green-600);
  font-size: 0.9rem;
  padding: 0.35rem 0.5rem;
}
</style>
