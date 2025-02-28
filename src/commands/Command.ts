import type { CommandMap } from "../CommandGenerator";
import { Bot, Post } from "@skyware/bot";
import { BlueskyCommunityBot } from "../BlueskyCommunityBot";
import type { TFunction } from "i18next";
import * as CommandState from "../lexicon/types/app/bikesky/communityBot/commandState";

export enum CommandStates {
  Closed,
}

export class Command {
  static blueskyCommunityBot: BlueskyCommunityBot;
  static commandName = "";
  static commandDescription = "";
  command: string[];
  params: string[];
  rootPost: Post;

  constructor(command: string[], post: Post) {
    this.command = command;
    command.shift();
    this.params = command;
    this.rootPost = post;
  }

  static async registerCommand(
    cmap: CommandMap,
    blueskyCommunityBot: BlueskyCommunityBot
  ) {
    cmap[this.commandName] = this;
    this.blueskyCommunityBot = blueskyCommunityBot;
  }

  async mention(
    post: Post,
    t: TFunction<string, undefined>
  ): Promise<CommandState.Record> {
    console.log("unhandled mention: " + post);

    return {
      $type: "app.bikesky.communityBot.commandState",
      command: Command.commandName,
      authorDid: post.author.did,
      state: CommandStates.Closed,
    };
  }

  static async reply(
    commandState: CommandState.Record,
    reply: Post,
    t: TFunction<string, undefined>
  ): Promise<CommandState.Record> {
    console.log("unhandled reply: " + reply);

    return {
      $type: "app.bikesky.communityBot.commandState",
      command: Command.commandName,
      authorDid: reply.author.did,
      state: CommandStates.Closed,
    };
  }

  getCommandName() {
    return Command.commandName;
  }
}
