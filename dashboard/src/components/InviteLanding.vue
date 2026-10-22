<template>
  <main class="min-h-screen flex items-center justify-center px-4 py-12 bg-gray-950 text-gray-100">
    <section class="w-full max-w-xl rounded-2xl border border-gray-700 bg-gray-900 p-6 md:p-9 shadow-2xl">
      <div class="text-xs font-semibold tracking-[0.2em] uppercase text-indigo-300">OneKidGaming · Private access</div>
      <h1 class="text-3xl md:text-4xl font-bold mt-3">Install <span class="text-indigo-300">OKG Manager</span></h1>
      <p class="text-gray-300 mt-4">
        This invitation page is visible to everyone, but a valid code from the OKG team is required before you can
        continue to Discord.
      </p>
      <form class="mt-7 space-y-4" @submit.prevent="verifyCode">
        <label class="block text-sm font-medium" for="invite-code"
          >Invitation code
          <input
            id="invite-code"
            v-model.trim="code"
            class="block w-full mt-2 rounded-lg border border-gray-600 bg-gray-950 px-4 py-3 font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-indigo-500"
            type="text"
            required
            minlength="8"
            maxlength="40"
            autocomplete="one-time-code"
            autocapitalize="characters"
            spellcheck="false"
            placeholder="OKG-XXXX-XXXX-XXXX"
          />
        </label>
        <button
          class="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-3 font-semibold"
          type="submit"
          :disabled="checking"
        >
          {{ checking ? "Verifying code…" : "Verify invitation" }}
        </button>
      </form>
      <div v-if="error" class="mt-4 rounded-lg border border-red-800 bg-red-950/50 p-3 text-red-200" role="alert">
        {{ error }}
      </div>
      <div
        v-if="message"
        class="mt-4 rounded-lg border border-emerald-800 bg-emerald-950/50 p-3 text-emerald-200"
        role="status"
      >
        {{ message }}
      </div>
      <p class="text-xs text-gray-500 mt-6">
        Codes can expire, run out of uses, or be revoked. Never post your invitation code publicly.
      </p>
      <router-link class="inline-block mt-5 text-sm text-indigo-300 hover:text-indigo-200" to="/"
        >← OKG home</router-link
      >
    </section>
  </main>
</template>

<script lang="ts">
import { post } from "../api";

export default {
  data() {
    return { code: "", checking: false, error: "", message: "" };
  },
  methods: {
    async verifyCode() {
      this.checking = true;
      this.error = "";
      this.message = "";
      try {
        const result = await post("invite-codes/redeem", { code: this.code.toUpperCase() });
        if (!result?.installUrl) {
          this.message = result?.message || "Invitation accepted.";
          return;
        }
        window.location.assign(result.installUrl);
      } catch (error: any) {
        this.error = error?.body?.error || error?.message || "Unable to verify this invitation.";
      } finally {
        this.checking = false;
      }
    },
  },
};
</script>
