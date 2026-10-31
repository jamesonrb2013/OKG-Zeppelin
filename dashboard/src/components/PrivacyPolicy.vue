<template>
  <div class="privacy-policy">
    <div class="wrapper">
      <h1>OKG Administrative &amp; Management Privacy Policy</h1>

      <h2>Platform overview</h2>
      <p>
        OKG Administrative &amp; Management is a moderation bot for Discord that allows server staff to carry out moderator actions (warn, mute,
        kick, ban, clean messages, view user information, etc.), keep records of infractions, perform automated actions
        ("automod", e.g. message filtering), post detailed logs on logging channels, and set up systems such as reaction
        roles. The platform also includes a web dashboard that server administrators can log in to through Discord OAuth.
      </p>
      <p>
        OKG Administrative &amp; Management is operated as part of OneKidGaming. For questions about this policy or requests concerning your data,
        contact <a href="mailto:support@onekidgaming.blitz.cloud">support@onekidgaming.blitz.cloud</a>.
      </p>

      <h2>Stored data</h2>
      <p>
        When OKG Administrative &amp; Management is used by a server, the following categories of data can be stored by the bot. The specific
        categories of data saved for each server depends on how the server has configured the platform.
      </p>
      <ul>
        <li>Recent messages and username/nickname changes of users engaged on the server</li>
        <li>Recent bulk deleted messages</li>
        <li>Basic user information, moderator-entered text, and relevant message archives for infraction records</li>
        <li>A subset of previously held roles and nickname on the server to be restored when a user rejoins</li>
        <li>Basic server details of the server using the bot</li>
      </ul>
      <p>Additionally, when a user logs in to the web dashboard the following types of data are stored:</p>
      <ul>
        <li>Basic Discord user information</li>
        <li>Time and originating IP address of the login for security audit purposes</li>
      </ul>

      <h2>Data retention</h2>
      <ul>
        <li>
          Recent messages are stored for 24h
          <ul><li>Deleted messages within this 24h are cleared 5 minutes after deletion</li></ul>
        </li>
        <li>5 most recent usernames and 10 most recent nicknames of users engaged in chat or voice channels are stored for 30 days</li>
        <li>Archives of bulk-deleted messages are stored for 30 days</li>
        <li>Infraction record data is kept until the server stops using OKG Administrative &amp; Management unless explicitly deleted</li>
        <li>Roles and nicknames that are restored on rejoin are cleared when the user rejoins</li>
        <li>User information for users logged in to the platform's web dashboard via Discord OAuth is stored as long as the server uses the platform</li>
      </ul>

      <h2>Data access and deletion requests</h2>
      <p>
        To request access to personal data stored about you, or to request its deletion, contact
        <a href="mailto:support@onekidgaming.blitz.cloud">support@onekidgaming.blitz.cloud</a>.
        Requests will be reviewed in accordance with applicable law and operational requirements.
      </p>
    </div>
  </div>
</template>

<script lang="ts">
import "../style/privacy-policy.css";
export default {};
</script>
