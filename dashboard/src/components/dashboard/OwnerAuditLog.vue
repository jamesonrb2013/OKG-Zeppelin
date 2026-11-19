<template>
  <section class="rounded-2xl border border-gray-800 bg-gray-900">
    <header class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 p-5">
      <div><h2 class="text-xl font-semibold text-white">Platform audit history</h2><p class="mt-1 text-sm text-gray-400">Append-only dashboard records across authorized servers and owner tools.</p></div>
      <button class="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm hover:bg-gray-700 disabled:opacity-50" :disabled="loading" @click="load">Refresh</button>
    </header>
    <p v-if="error" class="m-4 rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{{ error }}</p>
    <p v-if="loading" class="p-5 text-sm text-gray-400">Loading audit history…</p>
    <p v-else-if="entries.length === 0" class="p-5 text-sm text-gray-400">No audit events have been recorded yet.</p>
    <div v-else class="divide-y divide-gray-800">
      <article v-for="entry in entries" :key="entry.id" class="p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <strong class="text-sm text-white">{{ readableType(entry.event_type) }}</strong>
          <time class="text-xs text-gray-500">{{ formatDate(entry.created_at) }}</time>
        </div>
        <p class="mt-1 text-xs text-gray-400">Server: <code>{{ entry.guild_id }}</code> · Actor: <code>{{ entry.author_id }}</code> · #{{ entry.id }}</p>
        <pre v-if="entry.event_data && Object.keys(entry.event_data).length" class="mt-3 overflow-x-auto rounded-lg bg-gray-950 p-3 text-xs text-gray-300">{{ JSON.stringify(entry.event_data, null, 2) }}</pre>
      </article>
    </div>
    <p class="border-t border-gray-800 p-4 text-xs text-gray-500">Read-only. There are no dashboard controls or API routes to edit or delete audit entries. Discord log-message deletion does not erase these records.</p>
  </section>
</template>
<script lang="ts">
import { get } from "../../api";
type Entry = { id: number; guild_id: string; author_id: string; event_type: string; event_data: Record<string, unknown>; created_at: string };
export default {
  data() { return { entries: [] as Entry[], loading: true, error: "" }; },
  async mounted() { await this.load(); },
  methods: {
    async load() {
      this.loading = true; this.error = "";
      try {
        const result = await get("owner/audit-log", { limit: "500" });
        this.entries = Array.isArray(result?.entries) ? result.entries : [];
      } catch (error: any) {
        this.error = error?.body?.error || error?.message || "Could not load platform audit history.";
      } finally { this.loading = false; }
    },
    readableType(value: string) { return String(value || "Unknown event").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); },
    formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString(); },
  },
};
</script>
