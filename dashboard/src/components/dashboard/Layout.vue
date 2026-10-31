<template>
  <div class="dashboard container mx-auto px-2 py-2 md:px-6 md:py-6">
    <Title title="OKG Administrative & Management — Dashboard" />
    <nav class="flex items-stretch flex-wrap pl-4 pr-2 py-1 border border-blue-900/70 rounded-xl bg-slate-950 shadow-xl mb-8">
      <div class="flex-full md:flex-initial flex items-center">
        <img class="w-10 mr-4" src="/img/okg-shield.svg" alt="OKG" />
        <router-link to="/dashboard"><div class="font-semibold leading-tight">OKG Administrative &amp; Management</div><div class="text-xs tracking-widest text-blue-300">CONTROL CENTER</div></router-link>
        <router-link v-if="isStaff" to="/dashboard/invites" class="ml-4 rounded bg-blue-700 hover:bg-blue-600 px-3 py-1.5 text-sm">Invite codes</router-link>
      </div>
      <div class="flex-1 flex items-center flex-wrap">
        <ul class="dashboard-nav list-none flex md:ml-8">
          <router-link class="flex-auto mr-4" to="/dashboard">Servers</router-link>
          <a href="javascript:void(0)" class="navbar-item hover:text-red-400 mr-2" v-on:click="logout()">Log out</a>
        </ul>
        <div class="flex-1 flex items-center md:justify-end">
          <router-link to="/docs" role="menuitem" class="py-1 px-2 rounded hover:bg-slate-800">Documentation</router-link>
        </div>
      </div>
    </nav>
    <div class="main-content"><router-view></router-view></div>
  </div>
</template>
<style scoped>
.dashboard-nav a { &:hover { @apply underline; } }
.dashboard-nav .router-link-exact-active { @apply underline; }
</style>
<script>
import Title from "../Title.vue";
import { get } from "../../api";
export default {
  components: { Title },
  data() { return { isStaff: false }; },
  async mounted() {
    try { const result = await get("staff/status"); this.isStaff = result?.isStaff === true; }
    catch { this.isStaff = false; }
  },
  methods: {
    async logout() { await this.$store.dispatch("auth/logout"); window.location.pathname = "/"; },
  },
};
</script>
