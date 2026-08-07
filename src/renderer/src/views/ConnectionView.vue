<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Password from 'primevue/password'
import Select from 'primevue/select'
import type { ConnMeta, TlsPref } from '../../../shared/types'
import { useConnectionStore } from '../stores/connection'

const router = useRouter()
const conn = useConnectionStore()

const form = reactive({
  host: '',
  port: 21,
  user: 'admin',
  password: '',
  tls: 'auto' as TlsPref,
  save: false,
  name: ''
})

const tlsOptions = [
  { label: 'Auto-detect', value: 'auto' },
  { label: 'FTPS (TLS)', value: 'ftps' },
  { label: 'Plain FTP', value: 'plain' }
]

const busy = ref(false)

async function submit(): Promise<void> {
  busy.value = true
  const ok = await conn.connect(
    { host: form.host, port: form.port, user: form.user, password: form.password, tls: form.tls },
    form.save ? form.name || form.host : undefined
  )
  busy.value = false
  if (ok) router.push('/browser')
}

async function useSaved(meta: ConnMeta): Promise<void> {
  busy.value = true
  const result = await conn.connectSaved(meta)
  busy.value = false
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
    <div class="panel">
      <h1>Loxone DataManager</h1>
      <p class="subtitle">Connect to your Miniserver to view and edit statistics</p>

      <div v-if="conn.saved.length" class="saved">
        <h2>Saved connections</h2>
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
          <label>Host</label>
          <InputText v-model="form.host" placeholder="192.168.11.23" required autofocus />
        </div>
        <div class="row">
          <label>Port</label>
          <InputNumber v-model="form.port" :use-grouping="false" :min="1" :max="65535" />
        </div>
        <div class="row">
          <label>User</label>
          <InputText v-model="form.user" required />
        </div>
        <div class="row">
          <label>Password</label>
          <Password v-model="form.password" :feedback="false" toggle-mask required />
        </div>
        <div class="row">
          <label>Encryption</label>
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
            <label for="save">Save connection</label>
            <InputText
              v-model="form.name"
              placeholder="Name (optional)"
              :style="{ visibility: form.save ? 'visible' : 'hidden' }"
            />
          </div>
        </div>
        <Button
          type="submit"
          label="Connect"
          icon="pi pi-arrow-right"
          :loading="busy || conn.status === 'connecting'"
        />
      </form>

      <Message v-if="conn.error" severity="error" :closable="false">
        {{ conn.error.message }}
      </Message>
      <Message v-if="conn.error?.code === 'FTP_REFUSED'" severity="warn" :closable="false">
        <b>Is FTP enabled on your Miniserver?</b> Since firmware 16.1 the FTP server is disabled by
        default. In Loxone Config, open your Miniserver's network settings and set FTP to "Enabled"
        or "Enabled – TLS only", then save to the Miniserver and try again.
      </Message>
    </div>
  </main>
</template>

<style scoped>
.connect {
  align-items: center;
  justify-content: center;
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
