import { defineStore } from 'pinia'
import type { ApiError, StatFileData, StatRecord } from '../../../shared/types'
import { useFilesStore } from './files'

let validateTimer: ReturnType<typeof setTimeout> | null = null

/** Vue reactive proxies can't cross the contextBridge — send plain clones */
function plain(records: StatRecord[]): StatRecord[] {
  return records.map((r) => ({ ts: r.ts, values: [...r.values] }))
}

export const useEditorStore = defineStore('editor', {
  state: () => ({
    data: null as StatFileData | null,
    loading: false,
    saving: false,
    dirty: false,
    error: null as ApiError | null,
    selectedIndex: null as number | null,
    /** bumped after in-place cell edits so the chart refreshes */
    chartVersion: 0
  }),
  actions: {
    async load(name: string) {
      this.loading = true
      this.error = null
      this.data = null
      this.dirty = false
      this.selectedIndex = null
      const r = await window.api.stat.parse(name)
      this.loading = false
      if (r.ok) this.data = r.data
      else this.error = r.error
    },

    touch() {
      this.dirty = true
      this.chartVersion++
      if (validateTimer) clearTimeout(validateTimer)
      validateTimer = setTimeout(() => this.revalidate(), 400)
    },

    async revalidate() {
      if (!this.data) return
      const r = await window.api.stat.validate(this.data.fileName, plain(this.data.records))
      if (r.ok && this.data) this.data.problems = r.data
    },

    setValue(index: number, valueIdx: number, value: number) {
      if (!this.data) return
      this.data.records[index].values[valueIdx] = value
      this.touch()
    },

    setTimestamp(index: number, ts: number) {
      if (!this.data) return
      this.data.records[index].ts = ts
      this.touch()
    },

    /** dominant recording interval = most frequent timestamp delta */
    dominantInterval(): number {
      const counts = new Map<number, number>()
      const records = this.data?.records ?? []
      for (let i = 1; i < records.length; i++) {
        const d = records[i].ts - records[i - 1].ts
        if (d > 0) counts.set(d, (counts.get(d) ?? 0) + 1)
      }
      let best = 600
      let bestCount = 0
      for (const [d, c] of counts) {
        if (c > bestCount) {
          best = d
          bestCount = c
        }
      }
      return best
    },

    insertRow(index: number, where: 'above' | 'below') {
      if (!this.data) return
      const records = this.data.records
      const at = where === 'above' ? index : index + 1
      const prev = records[at - 1]
      const next = records[at]
      const interval = this.dominantInterval()
      const ts =
        prev && next
          ? Math.round((prev.ts + next.ts) / 2)
          : prev
            ? prev.ts + interval
            : next
              ? next.ts - interval
              : 0
      const template = records[index] ?? { values: new Array(this.data.valueCount).fill(0) }
      records.splice(at, 0, { ts, values: [...template.values] })
      this.data.records = [...records]
      this.touch()
    },

    deleteRows(indices: number[]) {
      if (!this.data || !indices.length) return
      const drop = new Set(indices)
      this.data.records = this.data.records.filter((_, i) => !drop.has(i))
      this.selectedIndex = null
      this.touch()
    },

    /** insert linearly interpolated rows into gaps > 1.5× the dominant interval */
    fillGaps(): number {
      if (!this.data) return 0
      const interval = this.dominantInterval()
      const out: StatRecord[] = []
      let inserted = 0
      const records = this.data.records
      for (let i = 0; i < records.length; i++) {
        if (i > 0) {
          const prev = records[i - 1]
          const cur = records[i]
          const gap = cur.ts - prev.ts
          if (gap > interval * 1.5) {
            const steps = Math.round(gap / interval) - 1
            for (let s = 1; s <= steps; s++) {
              const f = s / (steps + 1)
              out.push({
                ts: prev.ts + Math.round(gap * f),
                values: prev.values.map((v, vi) => v + (cur.values[vi] - v) * f)
              })
              inserted++
            }
          }
        }
        out.push(records[i])
      }
      if (inserted) {
        this.data.records = out
        this.touch()
      }
      return inserted
    },

    applyFormula(fn: (v: number) => number, valueIdx: number | 'all', indices: number[]) {
      if (!this.data) return
      const cols = valueIdx === 'all' ? [...Array(this.data.valueCount).keys()] : [valueIdx]
      for (const i of indices) {
        const r = this.data.records[i]
        if (!r) continue
        for (const c of cols) r.values[c] = fn(r.values[c])
      }
      this.touch()
    },

    async save(): Promise<boolean> {
      if (!this.data) return false
      this.saving = true
      this.error = null
      const r = await window.api.stat.serialize(this.data.fileName, plain(this.data.records))
      this.saving = false
      if (!r.ok) {
        this.error = r.error
        return false
      }
      this.data.problems = r.data
      this.dirty = false
      useFilesStore().refreshCache()
      return true
    },

    /** saves if needed, then uploads the file to the Miniserver */
    async upload(): Promise<boolean> {
      if (!this.data) return false
      if (this.dirty && !(await this.save())) return false
      this.saving = true
      this.error = null
      const r = await window.api.ftp.upload([this.data.fileName])
      this.saving = false
      if (!r.ok) {
        this.error = r.error
        return false
      }
      useFilesStore().refresh()
      return true
    }
  }
})
