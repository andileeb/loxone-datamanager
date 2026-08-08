<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Password from 'primevue/password'
import Select from 'primevue/select'
import type { ConnMeta, TlsPref } from '../../../shared/types'
import AppControls from '../components/AppControls.vue'
import { useConnectionStore } from '../stores/connection'
import { errorText } from '../i18n'

const router = useRouter()
const conn = useConnectionStore()
const { t } = useI18n()

const form = reactive({
  host: '',
  port: 21,
  user: 'admin',
  password: '',
  tls: 'auto' as TlsPref,
  save: false,
  name: ''
})

const tlsOptions = computed(() => [
  { label: t('connect.tlsAuto'), value: 'auto' },
  { label: t('connect.tlsFtps'), value: 'ftps' },
  { label: t('connect.tlsPlain'), value: 'plain' }
])

const busy = ref(false)
const slow = ref(false) // attempt has been running > 2s → offer to cancel
const cancelled = ref(false)

async function withBusy<T>(fn: () => Promise<T>): Promise<T> {
  busy.value = true
  cancelled.value = false
  const timer = setTimeout(() => (slow.value = true), 2000)
  try {
    return await fn()
  } finally {
    clearTimeout(timer)
    busy.value = false
    slow.value = false
    if (cancelled.value) {
      conn.error = null // the failure was self-inflicted, don't alarm the user
      await conn.disconnect() // in case cancel raced a connect that just succeeded
    }
  }
}

async function cancel(): Promise<void> {
  cancelled.value = true
  await conn.disconnect() // closes the pending client in main → connect() rejects
}

async function submit(): Promise<void> {
  const ok = await withBusy(() =>
    conn.connect(
      { host: form.host, port: form.port, user: form.user, password: form.password, tls: form.tls },
      form.save ? form.name || form.host : undefined
    )
  )
  if (ok && !cancelled.value) router.push('/browser')
}

async function useSaved(meta: ConnMeta): Promise<void> {
  const result = await withBusy(() => conn.connectSaved(meta))
  if (cancelled.value) return
  if (result === true) {
    router.push('/browser')
  } else if (result === 'needs-password') {
    // no stored password (no OS keychain) — prefill the form instead
    form.host = meta.host
    form.port = meta.port
    form.user = meta.user
    form.tls = meta.tls
    conn.error = { code: 'NO_PASSWORD', message: 'Enter the password for this connection' }
  }
}

onMounted(() => conn.loadSaved())
</script>

<template>
  <main class="view connect">
    <AppControls class="corner" />
    <div class="panel">
      <h1>{{ t('connect.title') }}</h1>
      <p class="subtitle">{{ t('connect.subtitle') }}</p>

      <div v-if="conn.saved.length" class="saved">
        <h2>{{ t('connect.savedConnections') }}</h2>
        <div v-for="meta in conn.saved" :key="meta.id" class="saved-row">
          <Button
            class="saved-main"
            severity="secondary"
            :label="`${meta.name} (${meta.user}@${meta.host})`"
            icon="pi pi-server"
            :disabled="busy"
            @click="useSaved(meta)"
          />
          <Button
            icon="pi pi-trash"
            severity="danger"
            text
            :disabled="busy"
            @click="conn.removeSaved(meta.id)"
          />
        </div>
      </div>

      <form class="form" @submit.prevent="submit">
        <div class="row">
          <label>{{ t('connect.host') }}</label>
          <InputText v-model="form.host" placeholder="192.168.11.23" required autofocus />
        </div>
        <div class="row">
          <label>{{ t('connect.port') }}</label>
          <InputNumber v-model="form.port" :use-grouping="false" :min="1" :max="65535" />
        </div>
        <div class="row">
          <label>{{ t('connect.user') }}</label>
          <InputText v-model="form.user" required />
        </div>
        <div class="row">
          <label>{{ t('connect.password') }}</label>
          <Password v-model="form.password" :feedback="false" toggle-mask required />
        </div>
        <div class="row">
          <label>{{ t('connect.encryption') }}</label>
          <Select
            v-model="form.tls"
            :options="tlsOptions"
            option-label="label"
            option-value="value"
          />
        </div>
        <div class="row">
          <label></label>
          <div class="save-opts">
            <Checkbox v-model="form.save" binary input-id="save" />
            <label for="save">{{ t('connect.saveConnection') }}</label>
            <InputText
              v-model="form.name"
              :placeholder="t('connect.namePlaceholder')"
              :style="{ visibility: form.save ? 'visible' : 'hidden' }"
            />
          </div>
        </div>
        <div class="actions">
          <Button
            type="submit"
            :label="t('connect.connect')"
            icon="pi pi-arrow-right"
            :loading="busy || conn.status === 'connecting'"
          />
          <Button
            v-tooltip="t('connect.cancel')"
            type="button"
            class="cancel"
            :class="{ show: slow }"
            icon="pi pi-times"
            severity="danger"
            text
            :aria-label="t('connect.cancel')"
            @click="cancel"
          />
        </div>
      </form>

      <Message v-if="conn.error" severity="error" :closable="false">
        {{ errorText(conn.error) }}
      </Message>
      <Message v-if="conn.error?.code === 'FTP_REFUSED'" severity="warn" :closable="false">
        <!-- eslint-disable-next-line vue/no-v-html -->
        <span v-html="t('connect.ftpHint')"></span>
      </Message>
    </div>
  </main>
</template>

<style scoped>
.connect {
  align-items: center;
  justify-content: center;
  position: relative;
}
.corner {
  position: absolute;
  top: 1rem;
  right: 1rem;
}
.panel {
  width: 100%;
  max-width: 30rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.subtitle {
  color: var(--p-text-muted-color);
}
.saved {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.saved-row {
  display: flex;
  gap: 0.25rem;
}
.saved-main {
  flex: 1;
  justify-content: flex-start;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.actions :deep(.p-button[type='submit']) {
  flex: 1;
}
/* collapsed until slow — the connect button (flex:1) shrinks as this grows */
.cancel {
  overflow: hidden;
  transition:
    width 0.2s,
    padding 0.2s,
    opacity 0.2s;
}
.cancel:not(.show) {
  width: 0;
  padding: 0;
  opacity: 0;
  visibility: hidden;
}
.row {
  display: grid;
  grid-template-columns: 7rem 1fr;
  align-items: center;
  gap: 0.5rem;
}
.row :deep(.p-inputtext),
.row :deep(.p-password),
.row :deep(.p-inputnumber),
.row :deep(.p-select) {
  width: 100%;
}
.save-opts {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.save-opts :deep(.p-inputtext) {
  flex: 1;
}
</style>
