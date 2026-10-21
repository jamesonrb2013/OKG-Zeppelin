<template>
  <div v-if="loading" class="text-gray-400 py-8">Loading server features…</div>
  <div v-else class="max-w-5xl">
    <router-link class="text-sm text-indigo-300 hover:underline" to="/dashboard">← Back to servers</router-link>
    <div class="flex flex-wrap items-end justify-between gap-4 mt-3 mb-6">
      <div>
        <p class="text-xs uppercase tracking-widest text-indigo-300 font-semibold">OKG Manager</p>
        <h1 class="text-3xl font-bold mt-1">Features</h1>
        <p class="text-gray-400 mt-2">Configure server tools from one place. More features will be added here.</p>
      </div>
      <div class="text-sm text-gray-400">{{ guild?.name }}</div>
    </div>
    <router-link
      class="block max-w-2xl rounded-xl border border-gray-700 bg-gray-800 p-6 hover:border-indigo-400 hover:bg-gray-800/80 transition"
      :to="'/dashboard/features/' + $route.params.guildId + '/support/config'"
    >
      <div class="flex items-start gap-4">
        <div class="flex items-center justify-center w-14 h-14 rounded-xl bg-indigo-500/20 text-3xl">🎫</div>
        <div class="flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-xl font-semibold">Support tickets</h2>
            <span class="text-xs rounded-full bg-indigo-500/20 text-indigo-200 px-2 py-1">New</span>
          </div>
          <p class="text-gray-300 mt-2">
            Build your own Ticket Tool-style system: private ticket channels, staff claiming, close/reopen controls,
            transcripts, ticket limits, and custom messages.
          </p>
          <p class="text-indigo-300 font-semibold mt-4">Configure support →</p>
        </div>
      </div>
    </router-link>
  </div>
</template>

<script lang="ts">
import { mapState } from "vuex";
import { ApiError } from "../../api";
import { GuildState } from "../../store/types";

export default {
  async mounted() {
    try {
      await this.$store.dispatch("guilds/loadGuild", this.$route.params.guildId);
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
    return { loading: true };
  },
  computed: {
    ...mapState("guilds", {
      guild(guilds: GuildState) {
        return guilds.available.get(this.$route.params.guildId);
      },
    }),
  },
};
</script>
