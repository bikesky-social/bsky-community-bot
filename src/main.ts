import { BlueskyCommunityBot } from "./BlueskyCommunityBot";
import { Env } from "./Env";

const blueskyCommunityBot = new BlueskyCommunityBot({
  botBskyUsername: Env.getRequiredStringEnvVarOrThrow('BOT_BSKY_USERNAME'),
  botBskyPassword: Env.getRequiredStringEnvVarOrThrow('BOT_BSKY_PASSWORD'),
  labelerBskyUsername: Env.getRequiredStringEnvVarOrThrow('LABELER_BSKY_USERNAME'),
  labelerBskyPassword: Env.getRequiredStringEnvVarOrThrow('LABELER_BSKY_PASSWORD'),
  labelerDid: Env.getRequiredStringEnvVarOrThrow('LABELER_DID'),
  maxLabels: Env.getRequiredNumberEnvVarOrThrow('MAX_LABELS'),
  selfServeLabelIdentifiers: Env.getRequiredCommaSeparatedEnvVarOrThrow('SELF_SERVE_LABEL_IDENTIFIERS'),
  verifiedLabels: Env.getOptionalCommaSeparatedEnvVar('VERIFIED_LABELS'),
  port: Env.getRequiredNumberEnvVarOrThrow('PORT'),
  conversationCollection: Env.getRequiredStringEnvVarOrThrow('CONVERSATION_COLLECTION'),
  defaultLabelLocale: Env.getRequiredStringEnvVarOrThrow('DEFAULT_LABEL_LOCALE'),
  labelVerificationEmail: Env.getRequiredStringEnvVarOrThrow('LABEL_VERIFICATION_EMAIL'),
  maxPostLength: Env.getRequiredNumberEnvVarOrThrow('MAX_POST_LENGTH'),
});

blueskyCommunityBot.run();
