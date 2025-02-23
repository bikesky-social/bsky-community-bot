import { BlueskyCommunityBot } from "./BlueskyCommunityBot";

const selfServeLabels = process.env.SELF_SERVE_LABEL_IDENTIFIERS
  ? (process.env.SELF_SERVE_LABEL_IDENTIFIERS as string).split(",")
  : [];

const verifiedLabels = process.env.VERIFIED_LABELS
  ? (process.env.VERIFIED_LABELS as string).split(",")
  : [];

const blueskyCommunityBot = new BlueskyCommunityBot({
  botBskyUsername: process.env.BOT_BSKY_USERNAME as string,
  botBskyPassword: process.env.BOT_BSKY_PASSWORD as string,
  labelerBskyUsername: process.env.LABELER_BSKY_USERNAME as string,
  labelerBskyPassword: process.env.LABELER_BSKY_PASSWORD as string,
  labelerDid: process.env.LABELER_DID as string,
  maxLabels: Number(process.env.MAX_LABELS),
  selfServeLabelIdentifiers: selfServeLabels,
  verifiedLabels: verifiedLabels,
  port: Number(process.env.PORT),
  conversationCollection: process.env.CONVERSATION_COLLECTION as string,
  labelLocale: process.env.LABEL_LOCALE as string,
  labelVerificationEmail: process.env.LABEL_VERIFICATION_EMAIL as string,
  maxPostLength: Number(process.env.MAX_POST_LENGTH),
});

blueskyCommunityBot.run();
