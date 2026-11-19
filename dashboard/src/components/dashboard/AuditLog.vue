<template>
  <section class="max-w-6xl">
    <router-link class="text-sm text-gray-400 hover:text-white" :to="'/dashboard/features/' + guildId">← Server features</router-link>
    <header class="mt-4 mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-xs font-semibold uppercase tracking-widest text-amber-300">Security &amp; accountability</p>
        <h1 class="mt-2 text-3xl font-bold text-white">Dashboard audit log</h1>
        <p class="mt-2 max-w-2xl text-sm text-gray-400">A read-only record of dashboard changes, stored separately from Discord log messages.</p>
      </div>
      <button class="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm hover:bg-gray-700 disabled:opacity-50" :disabled="loading" @click="load">Refresh</button>
    </header>
    <p v-if="error" class="mb-4 rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{{ error }}</p>
    <div class="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
      <div class="border-b border-gray-800 px-4 py-3 text-sm text-gray-400">{{ entries.length }} entries loaded · newest first · maximum 500</div>
      <div v-if="loading" class="p-6 text-sm text-gray-400">Loading audit history…</div>
      <div v-else-if="entries.length === 0" class="p-6 text-sm text-gray-400">No dashboard audit entries have been recorded yet.</div>
      <div v-else class="divide-y divide-gray-800">
        <article v-for="entry in entries" :key="entry.id" class="p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="font-semibold text-white">{{ readableType(entry.event_type) }}</span>
            <time class="text-xs text-gray-500">{{ formatDate(entry.created_at) }}</time>
          </div>
          <p class="mt-1 text-xs text-gray-400">Actor: <code class="text-gray-300">{{ entry.author_id }}</code> · Record #{{ entry.id }}</p>
          <pre v-if="hasData(entry.event_data)" class="mt-3 overflow-x-auto rounded-lg bg-gray-950 p-3 text-xs text-gray-300">{{ prettyData(entry.event_data) }}</pre>
        </article>
      </div>
    </div>
    <p class="mt-3 text-xs text-gray-500">This screen has no delete or edit controls. Removing a Discord log message does not remove these database records.</p>
  </section>
</template>

<script lang="ts">
import { get } from "../../api";

type AuditEntry = {
  id: number;
  guild_id: string;
  author_id: string;
  event_type: string;
  event_data: unknown;
  created_at: string;
};

export default {
  data() {
    return { entries: [] as AuditEntry[], loading: true, error: "" };
  },
  computed: {
    guildId(): string { return String(this.$route.params.guildId); },
  },
  async mounted() { await this.load(); },
  methods: {
    async load() {
      this.loading = true;
      this.error = "";
      try {
        const result = await get("guilds/" + this.guildId + "/audit-log", { limit: "500" });
        this.entries = Array.isArray(result?.entries) ? result.entries : [];
      } catch (error: any) {
        this.error = error?.body?.error || error?.message || "Could not load the audit log.";
      } finally {
        this.loading = false;
      }
    },
    readableType(value: string) {
      return String(value || "Unknown event").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
    },
    formatDate(value: string) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
    },
    hasData(value: unknown) {
      return value != null && (typeof value !== "object" || Object.keys(value as object).length > 0);
    },
    prettyData(value: unknown) {
      try { return JSON.stringify(value, null, 2); } catch { return String(value); }
    },
  },
};
</script>
