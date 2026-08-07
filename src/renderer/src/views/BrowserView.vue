<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import ProgressBar from 'primevue/progressbar'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import { useConnectionStore } from '../stores/connection'
import { suffixLabel, useFilesStore, type FileRow } from '../stores/files'
import type { SyncStatus } from '../../../shared/types'

const router = useRouter()
const conn = useConnectionStore()
const files = useFilesStore()
const filter = computed({
  get: () => files.listUi.filter,
  set: (v: string) => {
    files.listUi.filter = v
    files.listUi.first = 0
  }
})
const monthFilter = computed({
  get: () => files.listUi.month,
  set: (v: string | null) => {
    files.listUi.month = v ?? ''
    files.listUi.first = 0
  }
})
const selection = ref<FileRow[]>([])
const busyRow = ref<string | null>(null)
const deleteTargets = ref<FileRow[]>([])
const showPostUpload = ref(false)

const rows = computed(() => {
  const q = filter.value.trim().toLowerCase()
  const month = monthFilter.value
  return files.rows.filter(
    (f) =>
      (!month || f.yyyymm === month) &&
      (!q || f.name.toLowerCase().includes(q) || f.description?.toLowerCase().includes(q))
  )
})

function formatMonthLong(yyyymm: string): string {
  return new Date(Number(yyyymm.slice(0, 4)), Number(yyyymm.slice(4)) - 1).toLocaleString(
    undefined,
    { month: 'long', year: 'numeric' }
  )
}

const monthOptions = computed(() => {
  const months = [...new Set(files.rows.map((f) => f.yyyymm))].sort().reverse()
  return months.map((m) => ({ label: formatMonthLong(m), value: m }))
})

const STATUS_LABEL: Record<SyncStatus, { label: string; severity: string }> = {
  'only-remote': { label: 'Not downloaded', severity: 'secondary' },
  'only-local': { label: 'Only local', severity: 'contrast' },
  same: { label: 'Downloaded', severity: 'success' },
  'remote-newer': { label: 'Newer on Miniserver', severity: 'info' },
  'local-newer': { label: 'Local changes', severity: 'warn' }
}

function formatMonth(yyyymm: string): string {
  return `${yyyymm.slice(0, 4)}-${yyyymm.slice(4)}`
}
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : '—'
}

async function downloadOne(row: FileRow): Promise<void> {
  busyRow.value = row.name
  await files.download([row])
  busyRow.value = null
}

async function openEditor(row: FileRow): Promise<void> {
  if (row.status === 'only-remote') {
    busyRow.value = row.name
    const ok = await files.download([row])
    busyRow.value = null
    if (!ok) return
  }
  router.push(`/editor/${row.name}`)
}

async function downloadSelected(): Promise<void> {
  await files.download(selection.value)
  selection.value = []
}

const uploadableSelected = computed(() =>
  selection.value.filter((r) => r.status === 'local-newer' || r.status === 'only-local')
)

async function uploadOne(row: FileRow): Promise<void> {
  busyRow.value = row.name
  if (await files.upload([row.name])) showPostUpload.value = true
  busyRow.value = null
}

async function uploadSelected(): Promise<void> {
  const names = uploadableSelected.value.map((r) => r.name)
  selection.value = []
  if (await files.upload(names)) showPostUpload.value = true
}

async function confirmDelete(): Promise<void> {
  const names = deleteTargets.value.filter((r) => r.remote).map((r) => r.name)
  deleteTargets.value = []
  await files.remove(names)
}

async function disconnect(): Promise<void> {
  await conn.disconnect()
  router.push('/connect')
}

function openCacheFolder(): void {
  window.api.cache.openFolder()
}

const backupPath = ref<string | null>(null)
async function backup(): Promise<void> {
  backupPath.value = await files.backupZip()
}

const transferPercent = computed(() => {
  if (!files.transfer) return 0
  const { index, total, bytes, bytesTotal } = files.transfer
  const fileFraction = bytesTotal > 0 ? bytes / bytesTotal : 0
  return Math.round(((index + fileFraction) / total) * 100)
})

function scrollContainer(): HTMLElement | null {
  return document.querySelector('.table .p-datatable-table-container')
}

let unsubscribe: (() => void) | null = null
onMounted(async () => {
  unsubscribe = window.api.onTransferProgress((p) => {
    if (files.transfer) files.transfer = p
  })
  if (!files.remote.length) files.refresh()
  await nextTick()
  const el = scrollContainer()
  if (el) el.scrollTop = files.listUi.scrollTop
})
onBeforeUnmount(() => {
  files.listUi.scrollTop = scrollContainer()?.scrollTop ?? 0
  unsubscribe?.()
})
</script>

<template>
  <main class="view">
    <div class="toolbar">
      <div class="title">
        <h1>{{ conn.activeLabel }}</h1>
        <Tag
          :value="conn.tlsMode === 'ftps' ? 'FTPS' : 'FTP'"
          :severity="conn.tlsMode === 'ftps' ? 'success' : 'warn'"
        />
      </div>
      <div class="actions">
        <Button
          v-if="selection.length"
          :label="`Download ${selection.length} selected`"
          icon="pi pi-download"
          :disabled="!!files.transfer"
          @click="downloadSelected"
        />
        <Button
          v-if="uploadableSelected.length"
          :label="`Upload ${uploadableSelected.length} selected`"
          icon="pi pi-cloud-upload"
          severity="warn"
          :disabled="!!files.transfer"
          @click="uploadSelected"
        />
        <InputText v-model="filter" placeholder="Filter files…" />
        <Select
          v-model="monthFilter"
          :options="monthOptions"
          option-label="label"
          option-value="value"
          placeholder="All months"
          show-clear
          class="month-select"
        />
        <Button
          v-tooltip.bottom="'Refresh file list'"
          icon="pi pi-refresh"
          severity="secondary"
          :loading="files.loading"
          aria-label="Refresh"
          @click="files.refresh()"
        />
        <Button
          v-tooltip.bottom="'Open local download folder'"
          icon="pi pi-folder-open"
          severity="secondary"
          aria-label="Open local folder"
          @click="openCacheFolder"
        />
        <Button
          v-tooltip.bottom="'Download all stats from the Miniserver into a zip file'"
          icon="pi pi-file-export"
          label="Backup"
          severity="secondary"
          :disabled="!!files.transfer"
          @click="backup"
        />
        <Button icon="pi pi-sign-out" label="Disconnect" severity="secondary" @click="disconnect" />
      </div>
    </div>

    <Message v-if="files.error" severity="error" :closable="false">
      {{ files.error.message }}
    </Message>

    <Message v-if="backupPath" severity="success" closable @close="backupPath = null">
      Backup saved to {{ backupPath }}
    </Message>

    <div v-if="files.transfer" class="transfer">
      <span class="mono">{{ files.transfer.file }}</span>
      <ProgressBar :value="transferPercent" style="flex: 1" />
    </div>

    <DataTable
      v-model:selection="selection"
      v-model:first="files.listUi.first"
      v-model:rows="files.listUi.rows"
      :value="rows"
      :loading="files.loading"
      data-key="name"
      sort-field="name"
      :sort-order="1"
      paginator
      :rows-per-page-options="[25, 50, 100]"
      scrollable
      scroll-height="flex"
      class="table"
    >
      <Column selection-mode="multiple" header-style="width: 3rem" />
      <Column field="name" header="File" sortable>
        <template #body="{ data }">
          <span class="mono">{{ data.name }}</span>
        </template>
      </Column>
      <Column field="description" header="Description" sortable>
        <template #body="{ data }">
          <span class="desc">
            <span v-if="data.description">{{ data.description }}</span>
            <span
              v-else
              class="muted"
              title="No stat name found in this control's file headers yet — its files may be empty or their download failed. Refreshing retries other months."
              >unknown</span
            >
            <Tag
              v-if="suffixLabel(data.suffix)"
              :value="suffixLabel(data.suffix)!"
              severity="secondary"
              class="suffix-tag"
            />
          </span>
        </template>
      </Column>
      <Column field="yyyymm" header="Month" sortable>
        <template #body="{ data }">{{ formatMonth(data.yyyymm) }}</template>
      </Column>
      <Column field="size" header="Size" sortable>
        <template #body="{ data }">{{ formatSize(data.size) }}</template>
      </Column>
      <Column field="modifiedAt" header="Modified" sortable>
        <template #body="{ data }">{{ formatDate(data.modifiedAt) }}</template>
      </Column>
      <Column field="status" header="Status" sortable>
        <template #body="{ data }">
          <Tag
            :value="STATUS_LABEL[data.status as SyncStatus].label"
            :severity="STATUS_LABEL[data.status as SyncStatus].severity"
          />
        </template>
      </Column>
      <Column header-style="width: 11rem">
        <template #body="{ data }">
          <div class="row-actions">
            <Button
              v-tooltip.left="'Download to this computer'"
              icon="pi pi-download"
              text
              severity="secondary"
              aria-label="Download"
              :disabled="!data.remote || !!files.transfer"
              :loading="busyRow === data.name"
              @click="downloadOne(data)"
            />
            <Button
              v-tooltip.left="'Open chart & editor'"
              icon="pi pi-chart-line"
              text
              aria-label="Open"
              :disabled="!!files.transfer"
              @click="openEditor(data)"
            />
            <Button
              v-tooltip.left="'Upload local copy to the Miniserver'"
              icon="pi pi-cloud-upload"
              text
              severity="warn"
              aria-label="Upload"
              :disabled="
                (data.status !== 'local-newer' && data.status !== 'only-local') || !!files.transfer
              "
              @click="uploadOne(data)"
            />
            <Button
              v-tooltip.left="'Delete from the Miniserver'"
              icon="pi pi-trash"
              text
              severity="danger"
              aria-label="Delete"
              :disabled="!data.remote || !!files.transfer"
              @click="deleteTargets = [data]"
            />
          </div>
        </template>
      </Column>
      <template #empty>
        <span v-if="!files.loading">No statistics files found in /stats.</span>
      </template>
    </DataTable>

    <Dialog
      :visible="!!deleteTargets.length"
      header="Delete from Miniserver?"
      modal
      :style="{ width: '28rem' }"
      @update:visible="deleteTargets = []"
    >
      <p>This permanently deletes the file from the Miniserver (a local copy, if any, is kept):</p>
      <ul class="delete-list">
        <li v-for="t in deleteTargets" :key="t.name" class="mono">{{ t.name }}</li>
      </ul>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="deleteTargets = []" />
        <Button label="Delete" icon="pi pi-trash" severity="danger" @click="confirmDelete" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="showPostUpload"
      header="Uploaded — two steps left"
      modal
      :style="{ width: '28rem' }"
    >
      <p>The Miniserver only picks up edited statistics after:</p>
      <ol class="checklist">
        <li><b>Restart the Miniserver</b> (Loxone Config or power cycle).</li>
        <li>
          <b>Clear the Loxone app cache</b> (or remove and re-add the Miniserver in the app) so
          cached statistics are refreshed.
        </li>
      </ol>
      <template #footer>
        <Button label="Got it" @click="showPostUpload = false" />
      </template>
    </Dialog>
  </main>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.actions {
  display: flex;
  gap: 0.5rem;
}
.month-select {
  min-width: 11rem;
}
.transfer {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.table {
  flex: 1;
  min-height: 0;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85rem;
}
.muted {
  color: var(--p-text-muted-color);
  font-style: italic;
  font-size: 0.85rem;
}
.row-actions {
  display: flex;
}
.desc {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.suffix-tag {
  font-size: 0.7rem;
}
.delete-list {
  margin: 0.5rem 0 0 1.25rem;
}
.checklist {
  margin: 0.5rem 0 0 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
