<template>
  <section class="max-w-3xl">
    <router-link class="text-sm text-indigo-300 hover:underline" :to="'/dashboard/features/' + guildId">← Back to features</router-link>
    <div class="mt-4 rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-xl">
      <div class="flex items-center gap-3">
        <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-2xl">💰</div>
        <div>
          <p class="text-xs uppercase tracking-widest text-emerald-300">Server integration</p>
          <h1 class="text-2xl font-bold">UnbelievaBoat</h1>
        </div>
      </div>
      <p class="mt-4 text-gray-300">Connect this Discord server's own UnbelievaBoat API token to pay cash prizes from OKG Manager giveaways and raffles. Every server stores its credential separately.</p>
      <div class="mt-5 rounded-xl border border-gray-700 bg-gray-950 p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="font-semibold">Connection status</span>
          <span v-if="loading" class="text-sm text-gray-400">Checking…</span>
          <span v-else-if="connected" class="rounded-full bg-emerald-500/15 px-3 py-1 text-sm text-emerald-300">● Connected</span>
          <span v-else class="rounded-full bg-gray-700 px-3 py-1 text-sm text-gray-300">○ Not connected</span>
        </div>
        <p class="mt-2 text-sm text-gray-400">Your token is encrypted before it is saved. It is never displayed again after saving.</p>
      </div>
      <form class="mt-6 space-y-3" @submit.prevent="connect">
        <label class="block text-sm font-medium" for="ub-token">UnbelievaBoat API token</label>
        <input id="ub-token" v-model="token" type="password" autocomplete="new-password" spellcheck="false" placeholder="Paste your server's API token" class="w-full rounded-lg border border-gray-600 bg-gray-950 px-4 py-3 text-white outline-none focus:border-indigo-400" />
        <p class="text-xs text-gray-500">Create or copy your token from <a href="https://unbelievaboat.com/applications" target="_blank" rel="noopener noreferrer" class="text-indigo-300 hover:underline">UnbelievaBoat Applications</a>. Make sure the token has access to this server.</p>
        <div class="flex flex-wrap gap-3 pt-2">
          <button type="submit" :disabled="busy || token.trim().length < 20" class="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">{{ busy ? "Testing and connecting…" : connected ? "Replace token & connect" : "Test & connect" }}</button>
          <button v-if="connected" type="button" :disabled="busy" @click="disconnect" class="rounded-lg border border-red-500/50 px-5 py-2.5 font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50">Disconnect</button>
        </div>
      </form>
      <p v-if="message" class="mt-4 rounded-lg border border-gray-700 bg-gray-950 p-3 text-sm" :class="error ? 'text-red-300' : 'text-emerald-300'">{{ message }}</p>
      <div class="mt-6 border-t border-gray-700 pt-4 text-sm text-gray-400">
        <p class="font-semibold text-gray-300">What this enables</p>
        <ul class="mt-2 list-disc space-y-1 pl-5">
          <li>Cash prizes on /giveaway create</li>
          <li>Automatic payouts when a giveaway or raffle ends</li>
          <li>Separate credentials and payouts for every Discord server</li>
          <li>Regular giveaways continue working without this integration</li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import { get, post } from "../../api";

export default {
  data() {
    return { connected: false, loading: true, busy: false, token: "", message: "", error: false };
  },
  computed: {
    guildId(): string { return String(this.$route.params.guildId); },
  },
  async mounted() { await this.refreshStatus(); },
  methods: {
    async refreshStatus() {
      this.loading = true;
      try {
        const result = await get("guilds/" + this.guildId + "/unbelievaboat");
        this.connected = result.connected === true;
      } catch {
        this.message = "Could not load the integration status. Check that you have access to this server.";
        this.error = true;
      } finally { this.loading = false; }
    },
    async connect() {
      this.busy = true; this.message = ""; this.error = false;
      try {
        await post("guilds/" + this.guildId + "/unbelievaboat/connect", { token: this.token.trim() });
        this.token = ""; this.connected = true;
        this.message = "Connected! The token was verified for this server and saved securely.";
      } catch (e: any) {
        this.message = e?.body?.error || "Connection failed. Check the token and try again.";
        this.error = true;
      } finally { this.busy = false; }
    },
    async disconnect() {
      if (!window.confirm("Disconnect UnbelievaBoat for this server? Existing cash-prize payouts will stop until it is reconnected.")) return;
      this.busy = true; this.message = ""; this.error = false;
      try {
        await post("guilds/" + this.guildId + "/unbelievaboat/disconnect", {});
        this.connected = false; this.message = "UnbelievaBoat has been disconnected for this server.";
      } catch (e: any) {
        this.message = e?.body?.error || "Could not disconnect UnbelievaBoat.";
        this.error = true;
      } finally { this.busy = false; }
    },
  },
};
</script>
