<template>
  <div class="privacy-policy">
    <div class="wrapper">
      <h1>OKG Administrative &amp; Management Privacy Policy</h1>
      <h2>Platform overview</h2>
      <p>OKG Administrative &amp; Management is a Discord administration platform that allows authorized server staff to carry out moderation actions, keep records of infractions, configure automated message filtering, post server logs, and manage community utilities. The platform also includes a web dashboard that administrators can access through Discord OAuth.</p>
      <p>This platform is operated as part of OneKidGaming. For questions about this policy, contact <a href="mailto:support@onekidgaming.blitz.cloud">support@onekidgaming.blitz.cloud</a>.</p>
      <h2>Stored data</h2>
      <p>When a server uses OKG Administrative &amp; Management, the bot may store the following categories of data. The specific categories saved depend on how each server has configured the platform:</p>
      <ul>
        <li>Recent messages and username/nickname changes of users engaged on the server</li>
        <li>Recent bulk deleted messages</li>
        <li>Basic user information, moderator-entered text, and relevant message archives for infraction records</li>
        <li>A subset of previously held roles and nickname on the server to be restored when a user rejoins</li>
        <li>Basic server details of the server using the bot</li>
      </ul>
      <p>When a user logs in to the web dashboard, the following types of data may also be stored:</p>
      <ul><li>Basic Discord user information</li><li>Time and originating IP address of the login for security audit purposes</li></ul>
      <h2>Data retention</h2>
      <ul>
        <li>Recent messages are stored for 24 hours; deleted messages within this period are cleared 5 minutes after deletion.</li>
        <li>Recent usernames and nicknames of users engaged in chat or voice channels are stored for 30 days.</li>
        <li>Archives of bulk-deleted messages are stored for 30 days.</li>
        <li>Infraction record data is kept until the server stops using the platform unless explicitly deleted.</li>
        <li>Roles and nicknames that are restored on rejoin are cleared when the user rejoins.</li>
        <li>User information for users logged in to the dashboard is stored as long as the server uses the platform.</li>
      </ul>
      <h2>Data access and deletion requests</h2>
      <p>To request access to personal data stored about you, or to request its deletion, contact <a href="mailto:support@onekidgaming.blitz.cloud">OKG Support</a>. Requests will be reviewed in accordance with applicable law and operational requirements.</p>
    </div>
  </div>
</template>
<script lang="ts">
import "../style/privacy-policy.css";
export default {};
</script>
