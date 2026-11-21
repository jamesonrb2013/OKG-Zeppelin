<template>
  <section class="space-y-5">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div><p class="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Owner-only · Developer Center</p><h2 class="mt-1 text-2xl font-bold text-white">Full Console</h2><p class="mt-1 text-sm text-gray-400">Live bot/API output, log history, system health, and diagnostic commands.</p></div>
      <button class="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800" @click="refreshAll">Refresh</button>
    </header>
    <nav class="flex flex-wrap gap-2 border-b border-gray-800 pb-3">
      <button v-for="tab in tabs" :key="tab" class="rounded-lg px-3 py-2 text-sm" :class="activeTab === tab ? 'bg-indigo-600 text-white' : 'bg-gray-900 text-gray-300 hover:bg-gray-800'" @click="activeTab = tab">{{ tab }}</button>
    </nav>
    <section v-if="activeTab === 'Console' || activeTab === 'Monitoring'" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article v-for="item in statusCards" :key="item.label" class="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <p class="text-xs uppercase tracking-wider text-gray-500">{{ item.label }}</p><p class="mt-2 text-lg font-semibold" :class="statusColor(item.status)">{{ item.status }}</p><p class="mt-1 text-xs text-gray-500">{{ item.detail }}</p>
      </article>
    </section>
    <section v-if="activeTab === 'Console' || activeTab === 'Logs'" class="overflow-hidden rounded-xl border border-gray-800 bg-gray-950">
      <div class="flex flex-wrap items-center gap-2 border-b border-gray-800 bg-gray-900 p-3">
        <strong class="mr-auto text-sm text-white">{{ activeTab === 'Console' ? 'Live console' : 'Log explorer' }}</strong>
        <input v-model="search" placeholder="Search…" class="min-w-[120px] rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-white">
        <select v-model="level" class="rounded-lg border border-gray-700 bg-gray-950 px-2 py-2 text-xs text-white"><option>ALL</option><option>DEBUG</option><option>INFO</option><option>WARN</option><option>ERROR</option></select>
        <select v-model="source" class="rounded-lg border border-gray-700 bg-gray-950 px-2 py-2 text-xs text-white"><option value="all">All</option><option value="bot">Bot</option><option value="api">API</option></select>
        <label class="flex items-center gap-1 text-xs text-gray-400"><input v-model="autoRefresh" type="checkbox" class="accent-indigo-500"> Live</label>
      </div>
      <div class="max-h-[480px] min-h-[220px] overflow-auto p-3 font-mono text-xs">
        <div v-for="entry in logs" :key="entry.id" class="grid grid-cols-[125px_48px_36px_minmax(0,1fr)] gap-2 border-b border-gray-900 py-1.5">
          <time class="text-gray-500">{{ formatTime(entry.timestamp) }}</time><span :class="levelColor(entry.level)">{{ entry.level }}</span><span class="text-indigo-300">{{ entry.source }}</span><pre class="whitespace-pre-wrap break-words text-gray-300">{{ entry.message }}</pre>
        </div>
        <p v-if="!logs.length" class="py-8 text-center text-gray-500">No matching log entries.</p>
      </div>
      <footer class="border-t border-gray-800 px-4 py-2 text-xs text-gray-500">Showing {{ logs.length }} · Retained {{ retained }} / 1,000 entries · Newest first</footer>
    </section>
    <section v-if="activeTab === 'Console'" class="overflow-hidden rounded-xl border border-gray-800 bg-gray-950">
      <header class="border-b border-gray-800 bg-gray-900 px-4 py-3"><h3 class="font-semibold text-white">Developer command terminal</h3><p class="text-xs text-gray-500">Allowlisted diagnostic commands · every execution is audited</p></header>
      <pre class="min-h-20 whitespace-pre-wrap break-words p-4 font-mono text-xs text-emerald-300">{{ terminalOutput }}</pre>
      <form class="flex gap-2 border-t border-gray-800 p-3" @submit.prevent="runCommand">
        <span class="py-2 font-mono text-indigo-300">›</span><input v-model="command" autocomplete="off" class="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 font-mono text-sm text-white outline-none focus:border-indigo-500" placeholder="/help">
        <button class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="commandBusy || !command.trim()">Run</button>
      </form>
    </section>
    <section v-if="activeTab === 'Commands'" class="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h3 class="text-lg font-semibold text-white">Available commands</h3><p class="mt-1 text-sm text-gray-400">Only explicitly allowlisted commands are accepted. Arbitrary shell execution is disabled.</p>
      <div class="mt-4 space-y-3 font-mono text-sm">
        <p><code>/help</code> <span class="font-sans text-gray-400">Command reference</span></p><p><code>/bot status</code> <span class="font-sans text-gray-400">Bot worker heartbeat</span></p><p><code>/database health</code> <span class="font-sans text-gray-400">Database connectivity check</span></p><p><code>/redis health</code> <span class="font-sans text-gray-400">Redis connectivity check</span></p><p><code>/logs tail [1-100]</code> <span class="font-sans text-gray-400">Fetch recent console entries</span></p>
      </div>
    </section>
    <p v-if="error" class="rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{{ error }}</p>
    <p class="text-xs text-gray-600">Recent logs are retained in Redis. Common secret formats are redacted before storage. Console commands are recorded in the platform audit history.</p>
  </section>
</template>

<script lang="ts">
import { get, post } from "../../api";
type LogEntry = { id: string; timestamp: string; level: string; source: string; message: string };
type ConsoleStatus = { api?: { status: string; uptimeSeconds: number; memoryBytes: number }; bot?: { status: string; lastSeen: string | null }; redis?: { status: string }; database?: { status: string }; checkedAt?: string };
export default {
  data() {
    return { tabs: ["Console", "Logs", "Monitoring", "Commands"], activeTab: "Console", logs: [] as LogEntry[], status: {} as ConsoleStatus, retained: 0, search: "", level: "ALL", source: "all", autoRefresh: true, error: "", command: "", commandBusy: false, terminalOutput: "OKG Developer Console ready. Run /help.", timer: null as ReturnType<typeof setInterval> | null };
  },
  computed: {
    statusCards(): Array<{ label: string; status: string; detail: string }> {
      return [
        { label: "Bot worker", status: this.status.bot?.status || "checking", detail: this.status.bot?.lastSeen ? `Last heartbeat ${this.formatTime(this.status.bot.lastSeen)}` : "Waiting for bot heartbeat" },
        { label: "Dashboard API", status: this.status.api?.status || "checking", detail: `Uptime ${this.formatDuration(this.status.api?.uptimeSeconds || 0)}` },
        { label: "Database", status: this.status.database?.status || "checking", detail: "Live SELECT 1 check" },
        { label: "Redis", status: this.status.redis?.status || "checking", detail: "Shared log/heartbeat store" },
      ];
    },
  },
  async mounted() { await this.refreshAll(); this.timer = setInterval(() => { if (this.autoRefresh && ["Console", "Logs", "Monitoring"].includes(this.activeTab)) void this.refreshAll(); }, 3000); },
  beforeUnmount() { if (this.timer) clearInterval(this.timer); },
  watch: { activeTab() { this.error = ""; void this.refreshAll(); } },
  methods: {
    async refreshAll() { await Promise.all([this.loadStatus(), this.loadLogs()]); },
    async loadStatus() { try { this.status = await get("owner/console/status"); } catch (error: any) { this.error = error?.body?.error || error?.message || "Unable to load system status."; } },
    async loadLogs() {
      try { const result = await get("owner/console/logs", { limit: "500", level: this.level, source: this.source, search: this.search }); this.logs = Array.isArray(result?.entries) ? result.entries : []; this.retained = Number(result?.retained || 0); }
      catch (error: any) { this.error = error?.body?.error || error?.message || "Unable to load console logs."; }
    },
    async runCommand() {
      const command = this.command.trim(); if (!command || this.commandBusy) return;
      this.commandBusy = true; this.command = "";
      try { const result = await post("owner/console/execute", { command }); this.terminalOutput = `> ${command}\n${result?.output || "Command completed."}`; if (Array.isArray(result?.logs)) this.logs = result.logs; await this.loadLogs(); }
      catch (error: any) { this.terminalOutput = `> ${command}\nERROR: ${error?.body?.error || error?.message || "Command failed."}`; }
      finally { this.commandBusy = false; }
    },
    statusColor(value: string) { return value === "online" ? "text-emerald-300" : value === "error" || value === "offline" ? "text-red-300" : "text-amber-300"; },
    levelColor(value: string) { return value === "ERROR" ? "text-red-400" : value === "WARN" ? "text-amber-300" : value === "DEBUG" ? "text-gray-500" : "text-emerald-300"; },
    formatTime(value?: string) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString(); },
    formatDuration(value: number) { const s = Math.max(0, Math.floor(value)); return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ${s % 60}s`; },
  },
};
</script>
