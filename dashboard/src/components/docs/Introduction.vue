<template>
  <div>
    <h1>Welcome to OKG Administrative &amp; Management</h1>
    <p>OKG Administrative &amp; Management is the official OneKidGaming platform for Discord administration, moderation, and community operations. It brings essential server-management tools together with a connected web dashboard.</p>
    <div class="px-3 py-2 rounded bg-gray-800 shadow-md inline-block">
      <alert class="inline-icon mr-1 text-blue-300" title="Platform note!" />
      Some guides are being expanded as OKG features continue to evolve. Always use the settings currently shown in your dashboard.
    </div>
    <h2>Access to the platform</h2>
    <p>Access is provided by the OKG team. If you need access or believe your account is missing permissions, contact your server owner or <a href="mailto:support@onekidgaming.blitz.cloud">OKG Support</a>.</p>
    <h2>Dashboard configuration</h2>
    <p>Authorized administrators can manage server features, configuration, and staff access through the dashboard. Server owners should grant dashboard access only to trusted staff members. See <router-link to="/docs/configuration/configuration-format">Configuration format</router-link> for details.</p>
    <h2>Platform modules</h2>
    <p>OKG Administrative &amp; Management is organized into modules. Each module groups related functionality and provides its own configuration options, allowing server teams to enable and tailor the tools they need.</p>
    <h2>Commands</h2>
    <p>Command references are listed on the relevant module documentation pages. The default command prefix may be changed for an individual server where supported.</p>
    <h2>Need help?</h2>
    <p>Join the <a href="https://discord.gg/nePR9dnuYm">official OKG Discord server</a> or email <a href="mailto:support@onekidgaming.blitz.cloud">support@onekidgaming.blitz.cloud</a>.</p>
  </div>
</template>
<script lang="ts">
import Alert from "vue-material-design-icons/Alert.vue";
export default { components: { Alert } };
</script>
