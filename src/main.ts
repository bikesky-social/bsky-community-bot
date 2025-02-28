import { BlueskyCommunityBot } from "./BlueskyCommunityBot";
import { ListCommandsCommand } from "./commands/ListComands";
import { LabelCommand } from "./commands/Label";
import { UnlabelCommand } from "./commands/Unlabel";
import { Env } from "./Env";

const bot = new BlueskyCommunityBot({
  botBskyUsername: Env.getRequiredStringEnvVarOrThrow("BOT_BSKY_USERNAME"),
  botBskyPassword: Env.getRequiredStringEnvVarOrThrow("BOT_BSKY_PASSWORD"),
  labelerBskyUsername: Env.getRequiredStringEnvVarOrThrow("LABELER_BSKY_USERNAME"),
  labelerBskyPassword: Env.getRequiredStringEnvVarOrThrow("LABELER_BSKY_PASSWORD"),
  maxLabels: Env.getRequiredNumberEnvVarOrThrow("MAX_LABELS"),
  selfServeLabelIdentifiers: Env.getRequiredCommaSeparatedEnvVarOrThrow("SELF_SERVE_LABEL_IDENTIFIERS"),
  verifiedLabels: Env.getOptionalCommaSeparatedEnvVar("VERIFIED_LABELS"),
  port: Env.getRequiredNumberEnvVarOrThrow("PORT"),
  defaultLocale: Env.getRequiredStringEnvVarOrThrow("DEFAULT_LOCALE"),
  labelVerificationEmail: Env.getRequiredStringEnvVarOrThrow("LABEL_VERIFICATION_EMAIL"),
  maxPostLength: Env.getRequiredNumberEnvVarOrThrow("MAX_POST_LENGTH"),
});

bot.addCommands([
  new ListCommandsCommand(bot),
  new LabelCommand(bot),
  new UnlabelCommand(bot),
]);

bot.go();
