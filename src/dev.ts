import { BlueskyCommunityBot } from "./BlueskyCommunityBot";
import { ListCommandsCommand } from "./commands/ListComands";
import { LabelCommand } from "./commands/Label";
import { UnlabelCommand } from "./commands/Unlabel";
import { Env } from "./Env";

const bot = new BlueskyCommunityBot({
  labelerBskyUsername: Env.getRequiredStringEnvVarOrThrow("LABELER_BSKY_USERNAME"),
  labelerBskyAppPassword: Env.getRequiredStringEnvVarOrThrow("LABELER_BSKY_APP_PASSWORD"),
  defaultLocale: Env.getRequiredStringEnvVarOrThrow("DEFAULT_LOCALE"),
  port: Env.getRequiredNumberEnvVarOrThrow("PORT"),
  maxPostLength: Env.getRequiredNumberEnvVarOrThrow("MAX_POST_LENGTH"),
  maxLabels: Env.getRequiredNumberEnvVarOrThrow("MAX_LABELS"),
  selfServeLabelIdentifiers: Env.getRequiredCommaSeparatedEnvVarOrThrow("SELF_SERVE_LABEL_IDENTIFIERS"),
  verifiedLabels: Env.getOptionalCommaSeparatedEnvVar("VERIFIED_LABELS"),
  labelVerificationEmail: Env.getOptionalEnvVar("LABEL_VERIFICATION_EMAIL"),
  devChatBotBskyUsername: Env.getOptionalEnvVar("DEV_CHATBOT_BSKY_USERNAME"),
  devChatBotBskyAppPassword: Env.getOptionalEnvVar("DEV_CHATBOT_BSKY_APP_PASSWORD")
});

bot.addCommands([
  new ListCommandsCommand(bot),
  new LabelCommand(bot),
  new UnlabelCommand(bot),
]);

bot.go();
