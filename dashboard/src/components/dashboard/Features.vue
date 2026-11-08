<template>
  <div v-if="loading" class="py-8 text-sm text-gray-400">Loading server features…</div>
  <div v-else class="max-w-6xl">
    <router-link class="text-sm text-gray-400 transition hover:text-white" to="/dashboard">← All servers</router-link>

    <header class="mb-8 mt-4 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">OKG Manager / Server settings</p>
        <h1 class="mt-2 text-3xl font-bold tracking-tight text-white">Features</h1>
        <p class="mt-2 max-w-2xl text-sm text-gray-400">Manage the tools and community systems available in this server.</p>
      </div>
      <div class="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300">{{ guild?.name }}</div>
    </header>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section class="rounded-2xl border border-gray-700 bg-gray-900/80 p-6">
        <div class="flex items-center justify-between gap-3">
          <span class="text-xs font-semibold uppercase tracking-widest text-indigo-300">Community engagement</span>
          <span class="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">Available</span>
        </div>
        <h2 class="mt-4 text-xl font-semibold text-white">Giveaways &amp; raffles</h2>
        <p class="mt-2 text-sm leading-6 text-gray-400">
          Run scheduled prize events with button-based entries, optional role eligibility, multiple winners,
          automatic closing, and winner rerolls.
        </p>
        <div class="mt-5 rounded-xl border border-gray-700 bg-gray-950 px-4 py-3">
          <p class="text-xs font-medium uppercase tracking-wider text-gray-500">Discord command</p>
          <p class="mt-1 font-mono text-sm text-indigo-200">/giveaway create</p>
          <p class="mt-2 text-xs text-gray-500">Manage active events with /giveaway list, /giveaway end, and /giveaway reroll.</p>
        </div>
      </section>

      <router-link
        class="group rounded-2xl border border-gray-700 bg-gray-900/80 p-6 transition hover:border-emerald-500/60 hover:bg-gray-900"
        :to="'/dashboard/features/' + $route.params.guildId + '/unbelievaboat'"
      >
        <div class="flex items-center justify-between gap-3">
          <span class="text-xs font-semibold uppercase tracking-widest text-emerald-300">Economy integration</span>
          <span class="rounded-full border border-gray-600 px-2.5 py-1 text-xs text-gray-400">Optional</span>
        </div>
        <h2 class="mt-4 text-xl font-semibold text-white">UnbelievaBoat</h2>
        <p class="mt-2 text-sm leading-6 text-gray-400">
          Securely connect this server's own API credential to award cash prizes. Credentials are isolated by
          server and encrypted before storage.
        </p>
        <p class="mt-5 text-sm font-semibold text-emerald-300">Configure integration <span aria-hidden="true">→</span></p>
      </router-link>

      <router-link
        class="rounded-2xl border border-gray-700 bg-gray-900/80 p-6 transition hover:border-indigo-500/60 hover:bg-gray-900"
        :to="'/dashboard/features/' + $route.params.guildId + '/support/config'"
      >
        <div class="flex items-center justify-between gap-3">
          <span class="text-xs font-semibold uppercase tracking-widest text-indigo-300">Member support</span>
          <span class="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-200">Available</span>
        </div>
        <h2 class="mt-4 text-xl font-semibold text-white">Support tickets</h2>
        <p class="mt-2 text-sm leading-6 text-gray-400">
          Configure private ticket channels, staff claiming, close and reopen controls, transcripts, ticket limits,
          and custom panel messages.
        </p>
        <p class="mt-5 text-sm font-semibold text-indigo-300">Configure support <span aria-hidden="true">→</span></p>
      </router-link>
    </div>
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
