import { Command } from "./Command";
import { Post, PostReference } from "@skyware/bot";
import type { TFunction } from "i18next";

export class ListCommandsCommand extends Command {
  commandName = "listcommands";
  commandDescription = "list the available commands";

  async mention(
    post: Post,
    translate: TFunction<string, undefined>,
    authorDid: string
  ) {
    const responsePosts = [];

    const commandKeys = Object.keys(this.blueskyCommunityBot.commandMap);

    let currentPost = translate("post.intro") + "\n\n";

    for (let i = 0; i < commandKeys.length; i++) {
      const commandKey = commandKeys[i];
      const command = this.blueskyCommunityBot.commandMap[commandKey];
      const commandString = `${this.blueskyCommunityBot.commandPrefix}${command.commandName}\n`;

      if (
        currentPost.length + commandString.length <=
        this.blueskyCommunityBot.options.maxPostLength
      ) {
        currentPost = currentPost.concat(commandString);
      } else {
        responsePosts.push(currentPost);
        currentPost = translate("post.continued") + "\n\n";
      }
    }

    responsePosts.push(currentPost);

    let thread: PostReference = post;

    for (let i = 0; i < responsePosts.length; i++) {
      const postText = responsePosts[i];
      thread = await thread.reply(
        {
          text: postText,
          langs: [translate("post.intro", { returnDetails: true }).usedLng],
        },
        { resolveFacets: false }
      );
    }
  }
}
