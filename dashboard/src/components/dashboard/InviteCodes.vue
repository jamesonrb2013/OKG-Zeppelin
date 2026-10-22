<template>
  <section class="max-w-5xl mx-auto">
    <div class="flex items-start justify-between flex-wrap gap-4 mb-6">
      <div>
        <p class="uppercase tracking-widest text-xs text-indigo-300 font-semibold">OKG Manager · Owner tools</p>
        <h1 class="text-3xl font-bold mt-2">Invite codes</h1>
        <p class="text-gray-400 mt-2 max-w-2xl">Create private invitations for approved people. Codes are stored as hashes, shown in full only once, and can be revoked at any time.</p>
      </div>
      <button class="rounded bg-gray-700 hover:bg-gray-600 px-4 py-2" :disabled="loading" @click="loadCodes">Refresh</button>
    </div>

    <div v-if="error" class="rounded border border-red-700 bg-red-950/40 text-red-200 p-3 mb-4" role="alert">{{ error }}</div>
    <div v-if="notice" class="rounded border border-emerald-700 bg-emerald-950/40 text-emerald-200 p-3 mb-4" role="status">{{ notice }}</div>

    <div class="rounded-lg border border-gray-700 bg-gray-800 p-5 mb-8">
      <h2 class="text-xl font-semibold mb-4">Create an invitation</h2>
      <form class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end" @submit.prevent="createCode">
        <label class="block text-sm">Maximum uses
          <input v-model.number="maxUses" class="block w-full mt-1 rounded bg-gray-900 border border-gray-600 px-3 py-2" type="number" min="1" max="100" required>
          <span class="block text-xs text-gray-400 mt-1">Use 1 for a single-use code.</span>
        </label>
        <label class="block text-sm">Expires in
          <select v-model.number="expiresInDays" class="block w-full mt-1 rounded bg-gray-900 border border-gray-600 px-3 py-2">
            <option :value="1">1 day</option><option :value="7">7 days</option><option :value="30">30 days</option><option :value="90">90 days</option><option :value="365">365 days</option><option :value="0">Never</option>
          </select>
        </label>
        <button class="rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 font-semibold" type="submit" :disabled="creating"> {{ creating ? "Creating…" : "Generate code" }} </button>
      </form>
      <div v-if="newCode" class="mt-5 rounded border border-indigo-500 bg-gray-900 p-4">
        <p class="font-semibold">Copy this code now — it will not be shown again.</p>
        <div class="flex flex-wrap items-center gap-3 mt-3">
          <code class="text-lg font-bold tracking-wider break-all">{{ newCode.code }}</code>
          <button class="rounded bg-gray-700 hover:bg-gray-600 px-3 py-2" @click="copyCode">Copy code</button>
        </div>
        <p class="text-sm text-gray-400 mt-2">Uses allowed: {{ newCode.maxUses }} · Expires: {{ newCode.expiresAt ? formatDate(newCode.expiresAt) : "Never" }}</p>
      </div>
    </div>

    <div class="rounded-lg border border-gray-700 bg-gray-800 p-5">
      <div class="flex items-center justify-between gap-3 mb-4">
        <h2 class="text-xl font-semibold">Existing codes</h2>
        <span class="text-sm text-gray-400">{{ codes.length }} shown</span>
      </div>
      <p v-if="loading" class="text-gray-400">Loading invitations…</p>
      <p v-else-if="codes.length === 0" class="text-gray-400">No invitation codes yet. Create one above to get started.</p>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-gray-400 border-b border-gray-700"><tr><th class="py-3 pr-4">Code</th><th class="py-3 pr-4">Uses</th><th class="py-3 pr-4">Expires</th><th class="py-3 pr-4">Status</th><th class="py-3">Action</th></tr></thead>
          <tbody>
            <tr v-for="code in codes" :key="code.id" class="border-b border-gray-700/70">
              <td class="py-3 pr-4 font-mono">{{ code.codeHint }}</td>
              <td class="py-3 pr-4">{{ code.usedCount }} / {{ code.maxUses }}</td>
              <td class="py-3 pr-4">{{ code.expiresAt ? formatDate(code.expiresAt) : "Never" }}</td>
              <td class="py-3 pr-4"><span :class="statusClass(code)">{{ statusText(code) }}</span></td>
              <td class="py-3"><button v-if="!code.revokedAt && code.usedCount < code.maxUses" class="rounded bg-red-900 hover:bg-red-800 px-3 py-1.5 disabled:opacity-50" :disabled="revoking === code.id" @click="revokeCode(code)">{{ revoking === code.id ? "Revoking…" : "Revoke" }}</button><span v-else class="text-gray-500">—</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <p class="text-xs text-gray-500 mt-4">Code management is restricted to configured OKG dashboard staff. A successful code redemption is counted once, and expired, exhausted, or revoked codes are rejected.</p>
  </section>
</template>

<script lang="ts">
import { get, post } from "../../api";

type InviteCode = {
  id: number;
  codeHint: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};
type NewInviteCode = { code: string; maxUses: number; expiresAt: string | null };

export default {
  data() {
    return {
      loading: true,
      creating: false,
      revoking: 0 as number,
      maxUses: 1,
      expiresInDays: 30,
      codes: [] as InviteCode[],
      newCode: null as NewInviteCode | null,
      error: "",
      notice: "",
    };
  },
  async mounted() {
    await this.loadCodes();
  },
  methods: {
    async loadCodes() {
      this.loading = true;
      this.error = "";
      try {
        const result = await get("invite-codes");
        this.codes = result?.codes || [];
      } catch (error: any) {
        this.error = error?.body?.error || error?.message || "Could not load invite codes.";
      } finally {
        this.loading = false;
      }
    },
    async createCode() {
      this.creating = true;
      this.error = "";
      this.notice = "";
      this.newCode = null;
      try {
        const result = await post("invite-codes", { maxUses: String(this.maxUses), expiresInDays: String(this.expiresInDays) });
        this.newCode = result;
        this.notice = "Invitation created. Copy the full code now; it is only displayed once.";
        await this.loadCodes();
      } catch (error: any) {
        this.error = error?.body?.error || error?.message || "Could not create an invitation.";
      } finally {
        this.creating = false;
      }
    },
    async revokeCode(code: InviteCode) {
      if (!window.confirm("Revoke " + code.codeHint + "? Anyone who has not used it will no longer be able to redeem it.")) return;
      this.revoking = code.id;
      this.error = "";
      this.notice = "";
      try {
        await post("invite-codes/" + code.id + "/revoke");
        this.notice = "Invitation revoked.";
        await this.loadCodes();
      } catch (error: any) {
        this.error = error?.body?.error || error?.message || "Could not revoke this invitation.";
      } finally {
        this.revoking = 0;
      }
    },
    async copyCode() {
      if (!this.newCode?.code) return;
      try {
        await navigator.clipboard.writeText(this.newCode.code);
        this.notice = "Code copied to clipboard.";
      } catch {
        this.error = "Clipboard access was blocked. Select and copy the code manually.";
      }
    },
    formatDate(value: string) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
    },
    statusText(code: InviteCode) {
      if (code.revokedAt) return "Revoked";
      if (code.expiresAt && new Date(code.expiresAt).getTime() <= Date.now()) return "Expired";
      if (code.usedCount >= code.maxUses) return "Used up";
      return "Active";
    },
    statusClass(code: InviteCode) {
      const status = this.statusText(code);
      return status === "Active" ? "text-emerald-300" : "text-gray-400";
    },
  },
};
</script>
