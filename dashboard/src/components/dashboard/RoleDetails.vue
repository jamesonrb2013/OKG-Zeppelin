<template>
  <section class="max-w-7xl">
    <router-link class="text-sm text-gray-400 transition hover:text-white" :to="'/dashboard/features/' + guildId">← Server features</router-link>

    <header class="mb-6 mt-4 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Server management / Roles</p>
        <h1 class="mt-2 text-3xl font-bold tracking-tight text-white">Role details</h1>
        <p class="mt-2 max-w-2xl text-sm text-gray-400">Explore role membership, permissions, hierarchy, and creation dates using live Discord server data.</p>
      </div>
      <button class="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-200 transition hover:bg-gray-700 disabled:opacity-50" :disabled="loading" @click="loadRoles">Refresh roles</button>
    </header>

    <div v-if="error" class="mb-5 rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-200">{{ error }}</div>
    <div v-if="loading && roles.length === 0" class="rounded-xl border border-gray-800 bg-gray-900 p-8 text-sm text-gray-400">Loading roles and counting members…</div>

    <div v-else class="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.6fr)]">
      <aside class="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
        <div class="border-b border-gray-800 p-4">
          <div class="flex items-center justify-between gap-3">
            <h2 class="font-semibold text-white">Server roles</h2>
            <span class="rounded-full bg-gray-800 px-2.5 py-1 text-xs text-gray-300">{{ roles.length }}</span>
          </div>
          <input v-model="search" type="search" placeholder="Search roles…" class="mt-3 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-indigo-500" />
        </div>
        <div class="max-h-[620px] overflow-y-auto divide-y divide-gray-800">
          <button v-for="role in filteredRoles" :key="role.id" class="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-800/70" :class="{ 'bg-indigo-950/50 ring-1 ring-inset ring-indigo-500/50': selectedRole?.id === role.id }" @click="selectedRoleId = role.id">
            <span class="h-3.5 w-3.5 flex-none rounded-full ring-1 ring-white/10" :style="{ backgroundColor: role.color ? '#' + role.color.toString(16).padStart(6, '0') : '#64748b' }"></span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium text-white">{{ role.name }}</span>
              <span class="block text-xs text-gray-500">{{ formatNumber(role.memberCount) }} members · position {{ role.position }}</span>
            </span>
            <span v-if="role.managed" class="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400">Managed</span>
          </button>
          <p v-if="filteredRoles.length === 0" class="p-5 text-sm text-gray-500">No roles match that search.</p>
        </div>
      </aside>

      <main v-if="selectedRole" class="min-w-0 space-y-5">
        <section class="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="flex min-w-0 items-center gap-3">
              <span class="h-10 w-10 flex-none rounded-xl ring-1 ring-white/10" :style="{ backgroundColor: selectedRole.color ? '#' + selectedRole.color.toString(16).padStart(6, '0') : '#64748b' }"></span>
              <div class="min-w-0">
                <p class="text-xs uppercase tracking-widest text-gray-500">Selected role</p>
                <h2 class="break-words text-2xl font-bold text-white">{{ selectedRole.name }}</h2>
                <p class="mt-1 break-all font-mono text-xs text-gray-500">{{ selectedRole.id }}</p>
              </div>
            </div>
            <span class="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200">Position {{ selectedRole.position }}</span>
          </div>

          <div class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="rounded-xl border border-gray-800 bg-gray-950 p-4">
              <p class="text-xs font-medium uppercase tracking-wider text-gray-500">Members with this role</p>
              <p class="mt-2 text-3xl font-bold tabular-nums text-white">{{ formatNumber(selectedRole.memberCount) }}</p>
              <p class="mt-1 text-xs text-gray-500">Current Discord membership count</p>
            </div>
            <div class="rounded-xl border border-gray-800 bg-gray-950 p-4">
              <p class="text-xs font-medium uppercase tracking-wider text-gray-500">Created</p>
              <p class="mt-2 text-lg font-semibold text-white">{{ formatDate(selectedRole.createdAt) }}</p>
              <p class="mt-1 text-xs text-gray-500">Decoded from the Discord role ID</p>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div class="rounded-lg bg-gray-800/70 px-3 py-2"><p class="text-xs text-gray-500">Hoisted</p><p class="mt-1 text-sm font-medium text-gray-200">{{ selectedRole.hoist ? 'Yes' : 'No' }}</p></div>
            <div class="rounded-lg bg-gray-800/70 px-3 py-2"><p class="text-xs text-gray-500">Mentionable</p><p class="mt-1 text-sm font-medium text-gray-200">{{ selectedRole.mentionable ? 'Yes' : 'No' }}</p></div>
            <div class="rounded-lg bg-gray-800/70 px-3 py-2"><p class="text-xs text-gray-500">Managed</p><p class="mt-1 text-sm font-medium text-gray-200">{{ selectedRole.managed ? 'Yes · integration' : 'No' }}</p></div>
          </div>
        </section>

        <section class="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 p-5">
            <div>
              <h3 class="text-lg font-semibold text-white">Permissions</h3>
              <p class="mt-1 text-xs text-gray-500">All permissions currently granted to this role.</p>
            </div>
            <span class="rounded-full bg-gray-800 px-2.5 py-1 text-xs text-gray-300">{{ selectedRole.permissions.length }} enabled</span>
          </div>
          <div v-if="selectedRole.permissions.includes('Administrator')" class="border-b border-red-900/70 bg-red-950/40 px-5 py-3 text-sm font-medium text-red-200">Administrator is enabled. This role bypasses most server-level permission checks.</div>
          <div v-if="selectedRole.permissions.length" class="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2">
            <div v-for="permission in selectedRole.permissions" :key="permission" class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" :class="isSensitive(permission) ? 'border-amber-700/50 bg-amber-950/20 text-amber-200' : 'border-gray-800 bg-gray-950 text-gray-300'">
              <span class="text-emerald-400">✓</span>
              <span class="min-w-0 break-words">{{ permissionLabel(permission) }}</span>
              <span v-if="isSensitive(permission)" class="ml-auto flex-none text-[10px] uppercase tracking-wide text-amber-400">Powerful</span>
            </div>
          </div>
          <p v-else class="p-5 text-sm text-gray-500">This role has no explicit permissions.</p>
        </section>
      </main>
      <main v-else-if="roles.length" class="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-gray-800 bg-gray-900/50 p-8 text-center text-sm text-gray-500">Choose a role to inspect its details.</main>
    </div>

    <p v-if="roles.length" class="mt-4 text-xs text-gray-500">Member counts are calculated from Discord's paginated server-member data and cached for up to one minute to keep refreshes efficient.</p>
  </section>
</template>

<script lang="ts">
import { get } from "../../api";

type RoleInfo = {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  managed: boolean;
  mentionable: boolean;
  position: number;
  createdAt: string;
  permissions: string[];
  memberCount: number;
};

const sensitivePermissions = new Set([
  "Administrator", "ManageGuild", "ManageRoles", "ManageChannels", "ManageWebhooks",
  "ManageMessages", "ManageThreads", "ManageEvents", "ManageGuildExpressions",
  "BanMembers", "KickMembers", "ModerateMembers", "MentionEveryone", "ManageNicknames",
  "ViewAuditLog", "ManageEmojisAndStickers",
]);

export default {
  data() {
    return {
      roles: [] as RoleInfo[],
      selectedRoleId: "",
      search: "",
      loading: true,
      error: "",
    };
  },
  computed: {
    guildId(): string { return String(this.$route.params.guildId); },
    filteredRoles(): RoleInfo[] {
      const query = this.search.trim().toLowerCase();
      return query ? this.roles.filter((role) => role.name.toLowerCase().includes(query) || role.id.includes(query)) : this.roles;
    },
    selectedRole(): RoleInfo | undefined {
      return this.roles.find((role) => role.id === this.selectedRoleId) || this.filteredRoles[0];
    },
  },
  watch: {
    guildId() { this.selectedRoleId = ""; void this.loadRoles(); },
  },
  async mounted() { await this.loadRoles(); },
  methods: {
    async loadRoles() {
      this.loading = true;
      this.error = "";
      try {
        const result = await get("guilds/" + this.guildId + "/roles");
        this.roles = Array.isArray(result?.roles) ? result.roles : [];
        if (!this.roles.some((role) => role.id === this.selectedRoleId)) this.selectedRoleId = this.roles[0]?.id || "";
      } catch (error: any) {
        this.error = error?.body?.error || error?.message || "Could not load role details.";
      } finally {
        this.loading = false;
      }
    },
    formatNumber(value: number) { return new Intl.NumberFormat().format(value); },
    formatDate(value: string) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
    },
    permissionLabel(value: string) {
      return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^Use /, "Use ");
    },
    isSensitive(value: string) { return sensitivePermissions.has(value); },
  },
};
</script>
