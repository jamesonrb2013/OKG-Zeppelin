import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

const OWNER_ID = "1441223435043868735";
const ROUTER_URL = (process.env.OKG_API_ROUTER_URL || "https://okg-api-router.onrender.com").replace(/\/+$/, "");

function ownerOnly(interaction: ChatInputCommandInteraction): boolean {
  return interaction.user.id === OWNER_ID;
}

async function bridgeRequest(
  path: string,
  interaction: ChatInputCommandInteraction,
  method: "GET" | "POST" = "GET",
  body?: unknown,
) {
  const token = process.env.OKG_API_ROUTER_BRIDGE_TOKEN?.trim();
  if (!token)
    throw new Error(
      "The private router bridge is not configured on OKG Manager yet. Set OKG_API_ROUTER_BRIDGE_TOKEN in the bot environment.",
    );
  const url = ROUTER_URL + "/bridge" + path;
  const headers = {
    "x-okg-bridge-token": token,
    "x-okg-discord-user-id": interaction.user.id,
    "content-type": "application/json",
    accept: "application/json",
  };
  const response =
    method === "GET"
      ? await fetch(url, { method: "GET", headers, signal: AbortSignal.timeout(25000) })
      : await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body ?? {}),
          signal: AbortSignal.timeout(25000),
        });
  const payload = (await response.json().catch(() => ({}))) as any;
  if (!response.ok) throw new Error(payload.error?.message || "Router returned HTTP " + response.status);
  return payload;
}

export const apiRouterCommand = new SlashCommandBuilder()
  .setName("api-router")
  .setDescription("Owner-only OKG API provider controls")
  .addSubcommand((sub) => sub.setName("status").setDescription("Show configured providers and verified model counts"))
  .addSubcommand((sub) => sub.setName("dashboard").setDescription("Get the private API Router dashboard link"))
  .addSubcommand((sub) =>
    sub
      .setName("discover")
      .setDescription("Refresh a provider model catalog")
      .addStringOption((o) => o.setName("provider-id").setDescription("Provider ID from status").setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName("test")
      .setDescription("Run a real generation test against a model")
      .addStringOption((o) => o.setName("provider-id").setDescription("Provider ID from status").setRequired(true))
      .addStringOption((o) => o.setName("model-id").setDescription("Exact model ID from discovery").setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName("reveal-key")
      .setDescription("Reveal a saved key privately to the platform owner")
      .addStringOption((o) => o.setName("provider-id").setDescription("Provider ID from status").setRequired(true)),
  );

export async function handleApiRouterCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!ownerOnly(interaction)) {
    await interaction.reply({
      content: "Only the OKG Manager platform owner can use API Router controls.",
      ephemeral: true,
    });
    return;
  }
  const action = interaction.options.getSubcommand();
  if (action === "dashboard") {
    await interaction.reply({
      content:
        "OKG API Router Control Center: " +
        ROUTER_URL +
        "/admin\nSign in using ADMIN_TOKEN from Render. Keep your admin token private.",
      ephemeral: true,
    });
    return;
  }
  if (action === "status") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const payload = await bridgeRequest("/providers", interaction);
      const list = payload.data || [];
      const lines = list.map((p: any) => {
        const models = p.models || [];
        const verified = models.filter((m: any) => p.tests?.[m.id]?.ok).length;
        return (
          "**" +
          p.name +
          "** (" +
          p.provider +
          ")\nID: " +
          p.id +
          "\n" +
          (p.enabled ? "enabled" : "disabled") +
          " · " +
          models.length +
          " discovered / " +
          verified +
          " verified"
        );
      });
      await interaction.editReply(
        (lines.length ? lines.join("\n\n") : "No providers configured yet.") +
          "\n\nManage keys at " +
          ROUTER_URL +
          "/admin",
      );
    } catch (error) {
      await interaction.editReply(
        "Could not read router status: " + (error instanceof Error ? error.message : "unknown error"),
      );
    }
    return;
  }
  const providerId = interaction.options.getString("provider-id", true);
  await interaction.deferReply({ ephemeral: true });
  try {
    if (action === "discover") {
      const result = await bridgeRequest(
        "/providers/" + encodeURIComponent(providerId) + "/discover",
        interaction,
        "POST",
        {},
      );
      await interaction.editReply(
        "Model discovery finished. Found " +
          (result.count ?? result.models?.length ?? 0) +
          " generation-capable models. Open the dashboard to test models.",
      );
      return;
    }
    if (action === "test") {
      const model = interaction.options.getString("model-id", true);
      const result = await bridgeRequest(
        "/providers/" + encodeURIComponent(providerId) + "/test",
        interaction,
        "POST",
        { model },
      );
      const test = result.result;
      await interaction.editReply(
        "Model test: " +
          model +
          "\nResult: " +
          (test?.ok ? "PASSED" : "FAILED") +
          "\n" +
          (test?.detail || "No detail returned") +
          (test?.duration_ms ? "\nDuration: " + test.duration_ms + " ms" : ""),
      );
      return;
    }
    if (action === "reveal-key") {
      const result = await bridgeRequest(
        "/providers/" + encodeURIComponent(providerId) + "/reveal",
        interaction,
        "POST",
        {},
      );
      if (!result.api_key) throw new Error("The router did not return a saved key.");
      await interaction.editReply({
        content:
          "Saved provider key (private owner response)\nProvider ID: " +
          providerId +
          "\n" +
          result.api_key.slice(0, 1600) +
          "\n\nDo not share this in a public channel.",
      });
      return;
    }
  } catch (error) {
    await interaction.editReply(
      "API Router action failed: " + (error instanceof Error ? error.message : "unknown error"),
    );
  }
}
