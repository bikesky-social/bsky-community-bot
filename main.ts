import { BlueskyCommunityBot } from "./src/BlueskyCommunityBot";
import { ListCommandsCommand } from "./src/commands/ListComands";
import { LabelCommand } from "./src/commands/Label";
import { UnlabelCommand } from "./src/commands/Unlabel";
import { Env } from "./src/Env";

const useLabelWebpage = Env.getRequiredBooleanEnvVar("USE_LABEL_WEBPAGE");
const hostName = useLabelWebpage ? Env.getRequiredStringEnvVarOrThrow("HOST_NAME") : Env.getOptionalEnvVar("HOST_NAME");

const bot = new BlueskyCommunityBot({
  labelerBskyUsername: Env.getRequiredStringEnvVarOrThrow("LABELER_BSKY_USERNAME"),
  labelerBskyAppPassword: Env.getRequiredStringEnvVarOrThrow("LABELER_BSKY_APP_PASSWORD"),
  defaultLocale: Env.getRequiredStringEnvVarOrThrow("DEFAULT_LOCALE"),
  port: Env.getRequiredNumberEnvVarOrThrow("PORT"),
  maxPostLength: Env.getRequiredNumberEnvVarOrThrow("MAX_POST_LENGTH"),
  maxLabels: Env.getRequiredNumberEnvVarOrThrow("MAX_LABELS"),
  labelDisplayColumns: Env.getRequiredNumberEnvVarOrThrow("LABEL_DISPLAY_COLUMNS"),
  selfServeLabels: Env.getRequiredJsonEnvVar("SELF_SERVE_LABELS"),
  labelVerificationEmail: Env.getOptionalEnvVar("LABEL_VERIFICATION_EMAIL"),
  useLabelWebpage: useLabelWebpage,
  hostName: hostName,
  devChatBotBskyUsername: Env.getOptionalEnvVar("DEV_CHATBOT_BSKY_USERNAME"),
  devChatBotBskyAppPassword: Env.getOptionalEnvVar("DEV_CHATBOT_BSKY_APP_PASSWORD")
});

bot.addCommands([
  new ListCommandsCommand(bot),
  new LabelCommand(bot),
  new UnlabelCommand(bot),
]);

bot.go();
