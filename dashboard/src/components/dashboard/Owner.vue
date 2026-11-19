<template>
  <section class="max-w-6xl">
    <header class="mb-6">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">OKG Manager · Platform controls</p>
      <h1 class="mt-2 text-3xl font-bold text-white">Owner</h1>
      <p class="mt-2 max-w-2xl text-sm text-gray-400">Centralized controls for invitations, bot presence, and platform administration.</p>
    </header>
    <nav class="mb-6 flex flex-wrap gap-2 border-b border-gray-800 pb-3">
      <button v-for="tab in tabs" :key="tab.id" class="rounded-lg px-4 py-2 text-sm font-medium transition"
        :class="activeTab === tab.id ? 'bg-indigo-600 text-white' : 'bg-gray-900 text-gray-300 hover:bg-gray-800'"
        @click="setTab(tab.id)">{{ tab.label }}</button>
    </nav>
    <InviteCodes v-if="activeTab === 'invites'" />
    <section v-else-if="activeTab === 'presence'" class="max-w-3xl rounded-2xl border border-gray-800 bg-gray-900 p-6">
      <p class="text-xs font-semibold uppercase tracking-widest text-indigo-300">Discord bot profile</p>
      <h2 class="mt-2 text-xl font-semibold text-white">Custom status</h2>
      <p class="mt-2 text-sm leading-6 text-gray-400">The bot keeps its current Playing version activity. This text is added as a separate custom activity.</p>
      <label class="mt-6 block text-sm font-medium text-gray-200" for="custom-status">Status text</label>
      <textarea id="custom-status" v-model="statusText" maxlength="128" rows="3"
        class="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-3 text-white outline-none focus:border-indigo-500"
        placeholder="Example: Building the future of OKG ✨"></textarea>
      <div class="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>Leave blank to show only the version activity.</span><span>{{ statusText.length }}/128</span>
      </div>
      <p v-if="error" class="mt-4 rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{{ error }}</p>
      <p v-if="notice" class="mt-4 rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-200">{{ notice }}</p>
      <div class="mt-5 flex flex-wrap items-center gap-3">
        <button class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          :disabled="saving || loading" @click="savePresence">{{ saving ? 'Saving…' : 'Save custom status' }}</button>
        <button class="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
          :disabled="loading || saving" @click="loadPresence">Reset</button>
      </div>
      <p class="mt-5 text-xs text-gray-500">Changes are saved to the database and synchronized by the bot within about one minute.</p>
    </section>
  </section>
</template>
<script lang="ts">
import { get, post } from "../../api";
import InviteCodes from "./InviteCodes.vue";
export default {
  components: { InviteCodes },
  data() {
    return {
      tabs: [{ id: "invites", label: "Invite codes" }, { id: "presence", label: "Bot status" }],
      activeTab: "invites",
      statusText: "",
      loading: false,
      saving: false,
      error: "",
      notice: "",
    };
  },
  async mounted() {
    const requested = String(this.$route.query.tab || "");
    if (this.tabs.some((tab) => tab.id === requested)) this.activeTab = requested;
    if (this.activeTab === "presence") await this.loadPresence();
  },
  watch: {
    activeTab(value: string) {
      if (value === "presence") void this.loadPresence();
      this.$router.replace({ query: value === "invites" ? {} : { tab: value } });
    },
  },
  methods: {
    setTab(value: string) { this.activeTab = value; },
    async loadPresence() {
      this.loading = true;
      this.error = "";
      try {
        const result = await get("owner/presence");
        this.statusText = String(result?.statusText || "");
      } catch (error: any) {
        this.error = error?.body?.error || error?.message || "Could not load bot status settings.";
      } finally { this.loading = false; }
    },
    async savePresence() {
      this.saving = true;
      this.error = "";
      this.notice = "";
      try {
        const result = await post("owner/presence", { statusText: this.statusText });
        this.statusText = String(result?.statusText || "");
        this.notice = "Custom status saved. The bot will update its profile shortly.";
      } catch (error: any) {
        this.error = error?.body?.error || error?.message || "Could not save bot status.";
      } finally { this.saving = false; }
    },
  },
};
</script>
