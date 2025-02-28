import { Post } from "@skyware/bot";
import { BlueskyCommunityBot } from "../BlueskyCommunityBot";
import type { TFunction } from "i18next";
import * as CommandState from "../lexicon/types/app/bikesky/communityBot/commandState";

export enum CommandStates {
  Closed,
}

export class Command {
  blueskyCommunityBot: BlueskyCommunityBot;
  commandName = "";
  commandDescription = "";

  constructor(blueskyCommunityBot: BlueskyCommunityBot) {
    this.blueskyCommunityBot = blueskyCommunityBot;
  }

  async mention(
    post: Post,
    t: TFunction<string, undefined>
  ): Promise<CommandState.Record> {
    console.log("unhandled mention: " + post);

    return {
      $type: "app.bikesky.communityBot.commandState",
      command: this.commandName,
      authorDid: post.author.did,
      state: CommandStates.Closed,
    };
  }

  async reply(
    commandState: CommandState.Record,
    reply: Post,
    t: TFunction<string, undefined>
  ): Promise<CommandState.Record> {
    console.log("unhandled reply: " + reply);

    return {
      $type: "app.bikesky.communityBot.commandState",
      command: this.commandName,
      authorDid: reply.author.did,
      state: CommandStates.Closed,
    };
  }
}
