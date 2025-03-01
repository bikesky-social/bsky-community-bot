import { Bot, EventStrategy, Post } from "@skyware/bot";
import { Command } from "./commands/Command";
import express from "express";
import * as CommandState from "./lexicon/types/app/bikesky/communityBot/commandState";
import { CommandStates } from "./commands/Command";
import { LabelPoliciesKeeper } from "./LabelPoliciesKeeper";
import i18n from "i18next";
import Backend from "i18next-fs-backend";
const fs = require("fs");
import * as BskyCommunityBotLexicons from "./lexicon/lexicons";

type BlueskyCommunityBotOptions = {
  labelerBskyUsername: string;
  labelerBskyAppPassword: string;
  defaultLocale: string;
  port: number;
  maxPostLength: number;
  maxLabels: number;
  selfServeLabelIdentifiers: string[];
  verifiedLabels: string[];
  labelVerificationEmail?: string;
};

type CommandMap = {
  [commandName: string]: Command;
};

export class BlueskyCommunityBot {
  readonly options: BlueskyCommunityBotOptions;
  readonly commandMap: CommandMap = {};
  readonly server = express();
  readonly labelerBot: Bot;
  readonly labelPoliciesKeeper: LabelPoliciesKeeper;
  readonly i18n: typeof i18n;

  constructor(options: BlueskyCommunityBotOptions) {
    this.options = options;
    this.labelerBot = new Bot({
      eventEmitterOptions: {
        strategy: EventStrategy.Firehose,
      },
    });
    this.labelPoliciesKeeper = new LabelPoliciesKeeper(this);
    this.i18n = i18n.createInstance().use(Backend);
  }

  getCommandByPost(post: Post): Command | undefined {
    const lowerPostText = post.text.toLowerCase();
    const atUsernameSpace = "@" + this.options.labelerBskyUsername + " ";

    if (lowerPostText.startsWith(atUsernameSpace)) {
      const handleAndCommand = lowerPostText.split(atUsernameSpace);
      const command = handleAndCommand[1];

      const cmd = this.commandMap[command];

      if (cmd) {
        return cmd;
      }
    }
    return undefined;
  }

  addCommand(command: Command) {
    console.log(`added command: ${command.commandName}`);
    this.commandMap[command.commandName] = command;
  }

  addCommands(commands: Command[]) {
    commands.map((cmd) => this.addCommand(cmd));
  }

  getFixedT(lngs: string[], namespace: string) {
    const lngsWithFallback = lngs.concat(this.options.defaultLocale);
    return this.i18n.getFixedT(lngsWithFallback, namespace);
  }

  async go() {
    // initialize i18n
    this.i18n.init({
      fallbackLng: this.options.defaultLocale,
      // debug: true,
      initAsync: false,
      preload: fs.readdirSync("./locales"),
      ns: fs
        .readdirSync(`./locales/${this.options.defaultLocale}`)
        .map((fileName: string) => fileName.split(".")[0]),
      backend: {
        loadPath: "./locales/{{lng}}/{{ns}}.json",
      },
    });

    console.log("initialized i18n");

    //  initialize labeler bot

    await this.labelerBot.login({
      identifier: this.options.labelerBskyUsername,
      password: this.options.labelerBskyAppPassword,
    });

    console.log("labeler bot logged in");

    await this.labelPoliciesKeeper.init();

    // labeler bot handlers

    this.labelerBot.on("open", async () => {
      console.log("open: labeler bot has begun listening for events");
    });

    this.labelerBot.on("close", async () => {
      console.log("closed: labeler bot has stopped listening for events");
    });

    this.labelerBot.on("error", async (error) => {
      console.log(`labeler bot error occurred: ${error}`);
    });

    this.labelerBot.on("mention", async (post) => {
      const cmd = this.getCommandByPost(post);

      if (cmd) {
        console.log(
          `[mention] command received from ${post.author.did}: ${post.text} (${post.uri})`
        );

        const t = this.getFixedT(post.langs ? post.langs : [], cmd.commandName);
        const commandResult = await cmd.mention(post, t);
        if (commandResult.state != CommandStates.Closed) {
          try {
            const stateSavingResponse = await this.labelerBot.putRecord(
              BskyCommunityBotLexicons.ids.AppBikeskyCommunityBotCommandState,
              commandResult,
              post.cid
            );
          } catch (error) {
            console.log(
              `failed to save conversation state: ${JSON.stringify(error)}`
            );
          }
        }
      }
    });

    this.labelerBot.on("reply", async (reply) => {
      if (reply.replyRef?.root.cid) {
        try {
          const record = await this.labelerBot.agent.get(
            "com.atproto.repo.getRecord",
            {
              params: {
                repo: this.labelerBot.profile.did,
                collection:
                  BskyCommunityBotLexicons.ids
                    .AppBikeskyCommunityBotCommandState,
                rkey: reply.replyRef?.root.cid,
              },
            }
          );

          const recordValue = record.data.value;

          if (
            CommandState.isRecord(recordValue) &&
            CommandState.validateRecord(recordValue).success
          ) {
            const commandState = recordValue as CommandState.Record;

            if (commandState.authorDid === reply.author.did) {
              const cmd = this.commandMap[commandState.command];
              if (cmd) {
                console.log(
                  `[reply] command received from ${reply.author.did}: ${reply.text} (${reply.uri})`
                );

                const t = this.getFixedT(
                  reply.langs ? reply.langs : [],
                  commandState.command
                );
                const commandResult = await cmd.reply(commandState, reply, t);

                if (commandResult.state === CommandStates.Closed) {
                  try {
                    const recordAtUri = `at://${this.labelerBot.profile.did}/${BskyCommunityBotLexicons.ids.AppBikeskyCommunityBotCommandState}/${reply.replyRef?.root.cid}`;
                    await this.labelerBot.deleteRecord(recordAtUri);
                  } catch (error) {
                    console.log(
                      `failed to delete conversation state: ${JSON.stringify(
                        error
                      )}`
                    );
                  }
                } else {
                  try {
                    const stateSavingResponse = await this.labelerBot.putRecord(
                      BskyCommunityBotLexicons.ids
                        .AppBikeskyCommunityBotCommandState,
                      commandResult,
                      reply.replyRef?.root.cid
                    );
                  } catch (error) {
                    console.log(
                      `failed to save conversation state: ${JSON.stringify(
                        error
                      )}`
                    );
                  }
                }
              }
            }
          }
        } catch (error) {
          console.log(`failed to fetch commandState: ${JSON.stringify(error)}`);
        }
      } else {
        console.log("reply has no root: " + JSON.stringify(reply));
      }
    });

    // start the server

    this.server.get("/health", (req, res) => {
      res.json({ health: "ok" });
    });

    this.server.listen(this.options.port, () => {
      console.log(`server listening on port ${this.options.port}`);
    });
  }
}
