import { Command } from "./Command";
import { Post, PostReference } from "@skyware/bot";
import * as CommandState from "../lexicon/types/app/bikesky/communityBot/commandState";
import type { TFunction } from "i18next";

enum ListCommandsCommandStates {
  Closed,
}

export class ListCommandsCommand extends Command {
  commandName = "listcommands";
  commandDescription = "list the available commands";

  async mention(
    post: Post,
    t: TFunction<string, undefined>
  ): Promise<CommandState.Record> {
    const responsePosts = [];

    const commandKeys = Object.keys(
      this.blueskyCommunityBot.commandMap
    );

    let currentPost = t("post.intro") + "\n\n";

    for (let i = 0; i < commandKeys.length; i++) {
      const commandKey = commandKeys[i];
      const command =
        this.blueskyCommunityBot.commandMap[commandKey];
      const commandString = `@${this.blueskyCommunityBot.options.botBskyUsername} ${command.commandName}\n`;

      if (
        currentPost.length + commandString.length <=
        this.blueskyCommunityBot.options.maxPostLength
      ) {
        currentPost = currentPost.concat(commandString);
      } else {
        responsePosts.push(currentPost);
        currentPost = t("post.continued") + "\n\n";
      }
    }

    responsePosts.push(currentPost);

    let thread: PostReference = post;

    for (let i = 0; i < responsePosts.length; i++) {
      const postText = responsePosts[i];
      thread = await thread.reply({ text: postText }, { resolveFacets: false });
    }

    return {
      $type: "app.bikesky.communityBot.commandState",
      command: this.commandName,
      authorDid: post.author.did,
      state: ListCommandsCommandStates.Closed,
    };
  }
}
