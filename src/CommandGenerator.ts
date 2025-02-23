import { Command } from "./commands/Command";
import { ListCommandsCommand } from "./commands/ListComands";
import { LabelCommand } from "./commands/Label";
import { UnlabelCommand } from "./commands/Unlabel";
import { BlueskyCommunityBot } from "./BlueskyCommunityBot";

export type CommandMap = {
    [commandName:string]:typeof Command
};

export class CommandGenerator {
    readonly commandMap: CommandMap = {};
    readonly blueskyCommunityBot: BlueskyCommunityBot;

    constructor(blueskyCommunityBot: BlueskyCommunityBot) {
        this.blueskyCommunityBot = blueskyCommunityBot;
    }

    async registerCommands() {
        await ListCommandsCommand.registerCommand(this.commandMap,this.blueskyCommunityBot);
        await LabelCommand.registerCommand(this.commandMap,this.blueskyCommunityBot);
        await UnlabelCommand.registerCommand(this.commandMap,this.blueskyCommunityBot);
    }

    getCommandClassByName(name:string) {
        return this.commandMap[name];
    }
}