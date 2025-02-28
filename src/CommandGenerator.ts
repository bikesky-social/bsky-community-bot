import { Command } from "./commands/Command";
import { ListCommandsCommand } from "./commands/ListComands";
import { LabelCommand } from "./commands/Label";
import { UnlabelCommand } from "./commands/Unlabel";
import { BlueskyCommunityBot } from "./BlueskyCommunityBot";

export type CommandMap = {
  [commandName: string]: Command;
};

export class CommandGenerator {
  readonly commandMap: CommandMap = {};
  readonly blueskyCommunityBot: BlueskyCommunityBot;

  constructor(blueskyCommunityBot: BlueskyCommunityBot) {
    this.blueskyCommunityBot = blueskyCommunityBot;
  }

  registerCommands() {
    const labelCommand = new LabelCommand(this.blueskyCommunityBot);
    this.commandMap[labelCommand.commandName] = labelCommand;

    const unlabelCommand = new UnlabelCommand(this.blueskyCommunityBot);
    this.commandMap[unlabelCommand.commandName] = unlabelCommand;

    const listCommandsCommand = new ListCommandsCommand(this.blueskyCommunityBot);
    this.commandMap[listCommandsCommand.commandName] = listCommandsCommand;
  }

  getCommandByName(name: string) {
    return this.commandMap[name];
  }
}
