import { Post, type PostPayload } from "@skyware/bot";
import { BlueskyCommunityBot } from "../BlueskyCommunityBot";
import type { TFunction } from "i18next";
import * as CommandPrompt from "../lexicon/types/app/bikesky/communityBot/commandPrompt";
import { type $Typed } from "../lexicon/util";
import * as BskyCommunityBotLexicons from "../lexicon/lexicons";

export class Command {
  blueskyCommunityBot: BlueskyCommunityBot;
  commandName = "";
  commandDescription = "";

  constructor(blueskyCommunityBot: BlueskyCommunityBot) {
    this.blueskyCommunityBot = blueskyCommunityBot;
  }

  async mention(
    post: Post,
    translate: TFunction<string, undefined>,
    authorDid: string
  ) {
    console.log("unhandled mention: " + post);
  }

  async reply(
    commandPrompt: CommandPrompt.Record,
    reply: Post,
    translate: TFunction<string, undefined>
  ) {
    console.log("unhandled reply: " + reply);
  }

  async putPromptRecord(commandPromptRecord: $Typed<CommandPrompt.Record>) {
    try {
      const rkey = commandPromptRecord.post.split("/").pop() as string;
      await this.blueskyCommunityBot.chatBot.putRecord(
        BskyCommunityBotLexicons.ids.AppBikeskyCommunityBotCommandPrompt,
        commandPromptRecord,
        rkey
      );
    } catch (error) {
      console.log(`failed to save command prompt: ${JSON.stringify(error)}`);
    }
  }

  async replyWithUpdatedPrompt(
    reply: Post,
    commandPrompt: CommandPrompt.Record,
    postPayload: PostPayload
  ) {
    const replyRef = await reply.reply(postPayload);
    commandPrompt.post = replyRef.uri;
    await this.putPromptRecord(commandPrompt);
  }
}
