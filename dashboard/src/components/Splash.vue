<template>
  <div class="splash">
    <div class="error" v-if="error"><div class="message">{{ error }}</div></div>
    <header class="brand-header">
      <img src="/img/okg-shield.svg" alt="OKG shield" />
      <div><strong>OKG</strong><span>ADMINISTRATIVE &amp; MANAGEMENT</span></div>
    </header>
    <main class="hero">
      <div class="hero-copy">
        <p class="eyebrow">ONEKIDGAMING • OFFICIAL MANAGEMENT PLATFORM</p>
        <h1>Run your community.<br /><span>Stay in control.</span></h1>
        <p class="description">A powerful Discord administration and management platform built to help OKG communities stay organized, protected, and running smoothly.</p>
        <div class="actions">
          <a class="btn primary" href="/dashboard">Open Dashboard <span>↗</span></a>
          <a class="btn" href="/docs">Explore Documentation</a>
        </div>
        <div class="trust-line"><span class="status-dot"></span> OKG management tools • Discord-connected • Built for communities</div>
      </div>
      <div class="hero-mark">
        <div class="orb"></div>
        <img src="/img/okg-shield.svg" alt="OKG Administrative and Management emblem" />
        <div class="hero-mark-caption">ADMINISTRATIVE<br /><b>&amp; MANAGEMENT</b></div>
      </div>
    </main>
    <section class="feature-strip">
      <article><span>01</span><div><b>Moderation &amp; Safety</b><p>Tools to help staff protect and manage their servers.</p></div></article>
      <article><span>02</span><div><b>Server Management</b><p>Configure features and permissions from one dashboard.</p></div></article>
      <article><span>03</span><div><b>Clear Documentation</b><p>Guides and references for setting up your community.</p></div></article>
    </section>
    <footer class="site-footer">
      <span>© {{ new Date().getFullYear() }} OneKidGaming. OKG Administrative &amp; Management.</span>
      <nav><a href="https://discord.gg/nePR9dnuYm">OKG Discord</a><a href="mailto:support@onekidgaming.blitz.cloud">Contact Support</a><a href="/privacy-policy">Privacy</a></nav>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute } from "vue-router";

const errorMessages = {
  noAccess: "No dashboard access. If you think this is a mistake, please contact your server owner.",
  expiredLogin: "Dashboard login expired. Please log in again.",
};
const route = useRoute();
const error = ref<string | null>(null);
watch(() => route.query.error, (value) => {
  error.value = errorMessages[String(value)] || null;
});
</script>
