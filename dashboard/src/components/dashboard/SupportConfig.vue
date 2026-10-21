<template>
  <div v-if="loading" class="text-gray-400 py-8">Loading support settings…</div>
  <div v-else class="max-w-4xl">
    <router-link class="text-sm text-indigo-300 hover:underline" :to="'/dashboard/features/' + $route.params.guildId">← Back to Features</router-link>
    <div class="flex flex-wrap items-end justify-between gap-4 mt-3 mb-6">
      <div>
        <p class="text-xs uppercase tracking-widest text-indigo-300 font-semibold">OKG Manager · Features</p>
        <h1 class="text-3xl font-bold mt-1">Support tickets</h1>
        <p class="text-gray-400 mt-2">Set up a native Ticket Tool-style support workflow for {{ guild?.name }}.</p>
      </div>
      <button :disabled="saving" class="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-5 py-3 font-semibold" @click="save">
        {{ saving ? "Saving…" : saved ? "Saved ✓" : "Save settings" }}
      </button>
    </div>

    <div v-if="error" class="rounded-lg border border-red-500/40 bg-red-950/40 text-red-200 p-4 mb-5">{{ error }}</div>
    <div v-if="success" class="rounded-lg border border-emerald-500/40 bg-emerald-950/30 text-emerald-200 p-4 mb-5">{{ success }}</div>

    <form class="space-y-6" @submit.prevent="save">
      <section class="rounded-xl border border-gray-700 bg-gray-800 p-5 md:p-6">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold">Support system</h2>
            <p class="text-sm text-gray-400 mt-1">Enable or disable ticket creation in this server.</p>
          </div>
          <label class="flex items-center gap-3 cursor-pointer">
            <span class="text-sm">{{ enabled ? "Enabled" : "Disabled" }}</span>
            <input v-model="enabled" type="checkbox" class="w-5 h-5 accent-indigo-500" />
          </label>
        </div>
      </section>

      <section class="rounded-xl border border-gray-700 bg-gray-800 p-5 md:p-6 space-y-4">
        <div>
          <h2 class="text-lg font-semibold">Channels and staff</h2>
          <p class="text-sm text-gray-400 mt-1">Use Discord IDs. Enable Developer Mode in Discord, then right-click a channel/category/role and choose Copy ID.</p>
        </div>
        <div class="grid md:grid-cols-2 gap-4">
          <label class="block">
            <span class="block text-sm font-medium mb-2">Public panel channel ID</span>
            <input v-model.trim="panelChannelId" class="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2.5" placeholder="e.g. 123456789012345678" />
            <span class="text-xs text-gray-500 block mt-1">Where /support-panel posts the button for members.</span>
          </label>
          <label class="block">
            <span class="block text-sm font-medium mb-2">Ticket category ID <span class="text-red-300">*</span></span>
            <input v-model.trim="categoryId" class="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2.5" placeholder="Category ID" />
            <span class="text-xs text-gray-500 block mt-1">Private ticket channels are created inside this category.</span>
          </label>
          <label class="block md:col-span-2">
            <span class="block text-sm font-medium mb-2">Support role IDs</span>
            <input v-model="supportRoleIds" class="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2.5" placeholder="Role ID 1, Role ID 2, …" />
            <span class="text-xs text-gray-500 block mt-1">Comma-separated. These roles can view, claim, close, reopen, and delete tickets.</span>
          </label>
          <label class="block md:col-span-2">
            <span class="block text-sm font-medium mb-2">Transcript log channel ID</span>
            <input v-model.trim="logChannelId" class="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2.5" placeholder="Optional channel ID" />
            <span class="text-xs text-gray-500 block mt-1">When a ticket closes, the latest 100 messages are exported as a text transcript here.</span>
          </label>
        </div>
      </section>

      <section class="rounded-xl border border-gray-700 bg-gray-800 p-5 md:p-6 space-y-4">
        <div>
          <h2 class="text-lg font-semibold">Panel and ticket experience</h2>
          <p class="text-sm text-gray-400 mt-1">Customize what members see when opening a ticket.</p>
        </div>
        <label class="block">
          <span class="block text-sm font-medium mb-2">Panel title</span>
          <input v-model.trim="panelTitle" maxlength="256" class="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2.5" />
        </label>
        <label class="block">
          <span class="block text-sm font-medium mb-2">Panel description</span>
          <textarea v-model="panelDescription" rows="3" maxlength="4000" class="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2.5" />
        </label>
        <label class="block">
          <span class="block text-sm font-medium mb-2">Ticket welcome message</span>
          <textarea v-model="welcomeMessage" rows="4" maxlength="4000" class="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2.5" />
        </label>
        <div class="grid md:grid-cols-2 gap-4">
          <label class="block">
            <span class="block text-sm font-medium mb-2">Ticket channel prefix</span>
            <input v-model.trim="ticketPrefix" maxlength="12" class="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2.5" placeholder="ticket" />
          </label>
          <label class="block">
            <span class="block text-sm font-medium mb-2">Maximum open tickets per member</span>
            <input v-model.number="maxOpenTickets" type="number" min="1" max="10" class="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2.5" />
          </label>
        </div>
      </section>

      <div class="flex flex-wrap items-center gap-3">
        <button type="submit" :disabled="saving" class="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-5 py-3 font-semibold">
          {{ saving ? "Saving…" : "Save settings" }}
        </button>
        <button type="button" class="rounded-lg bg-gray-700 hover:bg-gray-600 px-5 py-3" @click="loadSettings">Reset unsaved changes</button>
      </div>
    </form>

    <section class="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-5 mt-6">
      <h2 class="font-semibold">Next step: publish your panel</h2>
      <p class="text-sm text-gray-300 mt-2">After saving, make sure the bot has Manage Channels, View Channels, Send Messages, Embed Links, and Read Message History permissions. Then run <code class="text-indigo-200">/support-panel</code> in your Discord server to post the public ticket panel.</p>
    </section>
  </div>
</template>

<script lang="ts">
import { mapState } from "vuex";
import jsYaml from "js-yaml";
import { ApiError, get } from "../../api";
import { GuildState } from "../../store/types";

const defaults = {
  panel_channel_id: "",
  category_id: "",
  support_role_ids: [] as string[],
  log_channel_id: "",
  ticket_prefix: "ticket",
  panel_title: "OKG Support Center",
  panel_description: "Need help? Open a private support ticket below and our team will assist you.",
  welcome_message: "Thanks for opening a ticket. Please describe what you need help with. A member of our team will be with you soon.",
  max_open_tickets: 1,
};

export default {
  async mounted() {
    try {
      await this.$store.dispatch("guilds/loadGuild", this.$route.params.guildId);
      await this.$store.dispatch("guilds/loadConfig", this.$route.params.guildId);
      await this.loadSettings();
    } catch (error) {
      if (error instanceof ApiError) {
        this.$router.push("/dashboard");
        return;
      }
      throw error;
    }
    this.loading = false;
  },
  data() {
    return {
      loading: true,
      saving: false,
      saved: false,
      error: "",
      success: "",
      enabled: true,
      panelChannelId: "",
      categoryId: "",
      supportRoleIds: "",
      logChannelId: "",
      ticketPrefix: defaults.ticket_prefix,
      panelTitle: defaults.panel_title,
      panelDescription: defaults.panel_description,
      welcomeMessage: defaults.welcome_message,
      maxOpenTickets: defaults.max_open_tickets,
    };
  },
  computed: {
    ...mapState("guilds", {
      guild(guilds: GuildState) {
        return guilds.available.get(this.$route.params.guildId);
      },
    }),
  },
  methods: {
    async loadSettings() {
      const response: any = await get("guilds/" + this.$route.params.guildId + "/config");
      const root: any = jsYaml.load(response?.config || "") || {};
      const plugin = root.plugins?.support || {};
      const config = plugin.config || {};
      this.enabled = plugin.enabled !== false;
      this.panelChannelId = config.panel_channel_id || "";
      this.categoryId = config.category_id || "";
      this.supportRoleIds = (config.support_role_ids || []).join(", ");
      this.logChannelId = config.log_channel_id || "";
      this.ticketPrefix = config.ticket_prefix || defaults.ticket_prefix;
      this.panelTitle = config.panel_title || defaults.panel_title;
      this.panelDescription = config.panel_description || defaults.panel_description;
      this.welcomeMessage = config.welcome_message || defaults.welcome_message;
      this.maxOpenTickets = Number(config.max_open_tickets || defaults.max_open_tickets);
      this.error = "";
      this.success = "";
    },
    async save() {
      if (this.saving) return;
      this.saving = true;
      this.saved = false;
      this.error = "";
      this.success = "";
      try {
        const response: any = await get("guilds/" + this.$route.params.guildId + "/config");
        const root: any = jsYaml.load(response?.config || "") || {};
        if (!root.plugins) root.plugins = {};
        root.plugins.support = {
          enabled: this.enabled,
          config: {
            panel_channel_id: this.panelChannelId || null,
            category_id: this.categoryId || null,
            support_role_ids: this.supportRoleIds.split(",").map((id: string) => id.trim()).filter(Boolean),
            log_channel_id: this.logChannelId || null,
            ticket_prefix: this.ticketPrefix || defaults.ticket_prefix,
            panel_title: this.panelTitle || defaults.panel_title,
            panel_description: this.panelDescription || defaults.panel_description,
            welcome_message: this.welcomeMessage || defaults.welcome_message,
            max_open_tickets: Math.max(1, Math.min(10, Number(this.maxOpenTickets) || 1)),
          },
        };
        await this.$store.dispatch("guilds/saveConfig", {
          guildId: this.$route.params.guildId,
          config: jsYaml.dump(root, { noRefs: true, lineWidth: 120 }),
        });
        this.success = "Support settings saved. The bot will use the new configuration.";
        this.saved = true;
        window.setTimeout(() => (this.saved = false), 3000);
      } catch (error) {
        if (error instanceof ApiError) {
          this.error = error.body?.errors?.join("\n") || error.body?.error || error.message;
        } else if (error instanceof Error) {
          this.error = error.message;
        } else {
          this.error = "Could not save support settings.";
        }
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>
