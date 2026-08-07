<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import RadioButton from 'primevue/radiobutton'
import Select from 'primevue/select'
import { compileFormula } from '../lib/formula'

const props = defineProps<{
  valueCount: number
  hasSelection: boolean
}>()
const emit = defineEmits<{
  apply: [
    fn: (v: number) => number,
    valueIdx: number | 'all',
    scope: 'selected' | 'downwards' | 'all'
  ]
}>()

const visible = defineModel<boolean>('visible', { required: true })
const expression = ref('v * 1000')
const column = ref<number | 'all'>(props.valueCount > 1 ? 'all' : 0)
const scope = ref<'selected' | 'downwards' | 'all'>(props.hasSelection ? 'selected' : 'all')

const columnOptions = computed(() => [
  ...(props.valueCount > 1 ? [{ label: 'All values', value: 'all' as const }] : []),
  ...Array.from({ length: props.valueCount }, (_, i) => ({ label: `Value ${i + 1}`, value: i }))
])

const compiled = computed(() => compileFormula(expression.value))
const preview = computed(() => {
  if (!compiled.value) return null
  return [1, 21.5].map((v) => `${v} → ${Number(compiled.value!(v).toPrecision(10))}`).join(',  ')
})

function apply(): void {
  if (!compiled.value) return
  emit('apply', compiled.value, column.value, scope.value)
  visible.value = false
}
</script>

<template>
  <Dialog v-model:visible="visible" header="Calculate values" modal :style="{ width: '26rem' }">
    <div class="body">
      <label>Formula (v = current value)</label>
      <InputText v-model="expression" placeholder="v * 1000" :invalid="!compiled" autofocus />
      <small v-if="preview" class="preview">{{ preview }}</small>
      <small v-else class="invalid">Invalid formula — use numbers, v, + - * / ( )</small>

      <label>Apply to column</label>
      <Select v-model="column" :options="columnOptions" option-label="label" option-value="value" />

      <label>Rows</label>
      <div class="scopes">
        <div v-for="opt in ['selected', 'downwards', 'all'] as const" :key="opt" class="scope">
          <RadioButton
            v-model="scope"
            :input-id="`scope-${opt}`"
            :value="opt"
            :disabled="opt !== 'all' && !hasSelection"
          />
          <label :for="`scope-${opt}`">
            {{
              opt === 'selected'
                ? 'Selected rows'
                : opt === 'downwards'
                  ? 'First selected row and below'
                  : 'All rows'
            }}
          </label>
        </div>
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="visible = false" />
      <Button label="Apply" :disabled="!compiled" @click="apply" />
    </template>
  </Dialog>
</template>

<style scoped>
.body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.body > label {
  font-weight: 600;
  font-size: 0.85rem;
  margin-top: 0.5rem;
}
.preview {
  color: var(--p-text-muted-color);
  font-family: ui-monospace, Menlo, monospace;
}
.invalid {
  color: var(--p-red-500);
}
.scopes {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.scope {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
