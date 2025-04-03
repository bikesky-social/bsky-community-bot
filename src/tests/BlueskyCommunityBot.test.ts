import { expect, test, describe, beforeAll } from "bun:test";
import { BlueskyCommunityBot } from "../BlueskyCommunityBot";
import { Post } from "@skyware/bot";
import { ListCommandsCommand } from "../commands/ListComands";
import { LabelCommand } from "../commands/Label";
import { UnlabelCommand } from "../commands/Unlabel";

const labelerName = "labeler";
const labelerHandle = `@${labelerName}`;

function getNewBot(): BlueskyCommunityBot {
  return new BlueskyCommunityBot({
    labelerBskyUsername: labelerName,
    labelerBskyAppPassword: "",
    defaultLocale: "en",
    port: 0,
    maxPostLength: 300,
    maxLabels: 3,
    labelDisplayColumns: 2,
    selfServeLabels: [],
    labelVerificationEmail: "",
    useLabelWebpage: false,
    hostName: "",
  });
}

describe("BlueskyCommunityBot", () => {
  beforeAll(() => {
    // const bot =
  });

  test("getCommandByPost returns the command if it exists", () => {
    const bot = getNewBot();

    const listCommandsCommand = new ListCommandsCommand(bot);

    bot.addCommand(listCommandsCommand);

    const cmd = bot.getCommandByPost({
      text: `${labelerHandle} listcommands`,
    } as Post);

    expect(cmd).toBe(listCommandsCommand);
  });

  test("getCommandByPost returns the command if it exists (not case sensitive)", () => {
    const bot = getNewBot();

    const listCommandsCommand = new ListCommandsCommand(bot);

    bot.addCommand(listCommandsCommand);

    const cmd = bot.getCommandByPost({
      text: `${labelerHandle} LISTCOMMANDS`,
    } as Post);

    expect(cmd).toBe(listCommandsCommand);
  });

  test("getCommandByPost returns undefined if the command does not exist", () => {
    const bot = getNewBot();

    const listCommandsCommand = new ListCommandsCommand(bot);

    bot.addCommand(listCommandsCommand);

    const cmd = bot.getCommandByPost({
      text: `${labelerHandle} this isn't a command`,
    } as Post);

    expect(cmd).toBeUndefined();
  });

  test("addCommands adds multiple commands to the bot", () => {
    const bot = getNewBot();

    const listCommandsCommand = new ListCommandsCommand(bot);
    const labelCommand = new LabelCommand(bot);
    const unlabelCommand = new UnlabelCommand(bot);

    bot.addCommands([listCommandsCommand, labelCommand, unlabelCommand]);

    {
      const cmd = bot.getCommandByPost({
        text: `${labelerHandle} listcommands`,
      } as Post);

      expect(cmd).toBe(listCommandsCommand);
    }
    {
      const cmd = bot.getCommandByPost({
        text: `${labelerHandle} label`,
      } as Post);

      expect(cmd).toBe(labelCommand);
    }
    {
      const cmd = bot.getCommandByPost({
        text: `${labelerHandle} unlabel`,
      } as Post);

      expect(cmd).toBe(unlabelCommand);
    }
  });

  test("getFixedT returns a t function for the requested language", () => {
    const bot = getNewBot();
    bot.initi18next();

    const t = bot.getFixedT([], "label");
    
    expect(t).toBeFunction();

    const postIntro = t("post.intro");

    expect(postIntro).toBe("Let's get you some labels!");
  });
});
