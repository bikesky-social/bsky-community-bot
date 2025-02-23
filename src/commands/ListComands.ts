import { Command } from "./Command";
import { Post, PostReference } from "@skyware/bot";
import type { CommandValidationResult, CommandState } from "./Command";

enum ListCommandsCommandStates {
  Closed,
}

export class ListCommandsCommand extends Command {
  static commandName = "listcommands";
  static commandDescription = "list the available commands";

  async validateCommand(): Promise<CommandValidationResult> {
    return {
      valid: true,
      response: "",
    };
  }

  async mention(post: Post): Promise<CommandState> {
    const responsePosts = [];

    const commandKeys = Object.keys(
      ListCommandsCommand.blueskyCommunityBot.commandGenerator.commandMap
    );

    let currentPost = "this account will respond to the following commands:\n";

    for (let i = 0; i < commandKeys.length; i++) {
      const commandKey = commandKeys[i];
      const command =
        ListCommandsCommand.blueskyCommunityBot.commandGenerator.commandMap[commandKey];
      const commandString = `@${ListCommandsCommand.blueskyCommunityBot.options.botBskyUsername} ${command.commandName}\n`;

      if (
        currentPost.length + commandString.length <=
        ListCommandsCommand.blueskyCommunityBot.options.maxPostLength
      ) {
        currentPost = currentPost.concat(commandString);
      } else {
        responsePosts.push(currentPost);
        currentPost = "Continued:\n";
      }
    }

    responsePosts.push(currentPost);

    let thread: PostReference = post;

    for (let i = 0; i < responsePosts.length; i++) {
      const postText = responsePosts[i];
      thread = await thread.reply({ text: postText }, { resolveFacets: false });
    }

    return {
      command: ListCommandsCommand.commandName,
      authorDid: post.author.did,
      state: ListCommandsCommandStates.Closed,
    };
  }
}
