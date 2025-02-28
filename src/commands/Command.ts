import type { CommandMap } from "../CommandGenerator";
import { Bot, Post } from "@skyware/bot";
import { BlueskyCommunityBot } from "../BlueskyCommunityBot";
import type { TFunction } from "i18next";

export enum CommandStates {
  Closed,
}

export type CommandState = {
  command: string;
  authorDid: string;
  state: number;
};

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
  ): Promise<CommandState> {
    console.log("unhandled mention: " + post);
    return {
      command: Command.commandName,
      authorDid: post.author.did,
      state: CommandStates.Closed,
    };
  }

  static async reply(
    commandState: CommandState,
    reply: Post,
    t: TFunction<string, undefined>
  ): Promise<CommandState> {
    console.log("unhandled reply: " + reply);
    return {
      command: Command.commandName,
      authorDid: reply.author.did,
      state: CommandStates.Closed,
    };
  }

  getCommandName() {
    return Command.commandName;
  }
}
