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
  devChatBotBskyUsername?: string;
  devChatBotBskyAppPassword?: string;
};

type CommandMap = {
  [commandName: string]: Command;
};

export class BlueskyCommunityBot {
  readonly options: BlueskyCommunityBotOptions;
  readonly commandMap: CommandMap = {};
  readonly server = express();
  readonly chatBot: Bot;
  readonly labelerBot: Bot;
  readonly labelPoliciesKeeper: LabelPoliciesKeeper;
  readonly i18n: typeof i18n;
  readonly commandPrefix: string;

  constructor(options: BlueskyCommunityBotOptions) {
    this.options = options;
    this.chatBot = new Bot({
      eventEmitterOptions: {
        strategy: EventStrategy.Firehose,
      },
    });
    if (
      this.options.devChatBotBskyUsername &&
      this.options.devChatBotBskyAppPassword
    ) {
      this.labelerBot = new Bot();
      this.commandPrefix = "@" + this.options.devChatBotBskyUsername + " ";
    } else {
      this.labelerBot = this.chatBot;
      this.commandPrefix = "@" + this.options.labelerBskyUsername + " ";
    }
    this.labelPoliciesKeeper = new LabelPoliciesKeeper(this);
    this.i18n = i18n.createInstance().use(Backend);
  }

  getCommandByPost(post: Post): Command | undefined {
    const lowerPostText = post.text.toLowerCase();

    if (lowerPostText.startsWith(this.commandPrefix)) {
      const handleAndCommand = lowerPostText.split(this.commandPrefix);
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

  getCommandRecordKeyFromPost(post: Post) {
    return post.replyRef
      ? `${post.replyRef.root.cid}.${post.author.did}`
      : `${post.cid}.${post.author.did}`;
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

    //  initialize dev chat bot

    if (
      this.options.devChatBotBskyUsername &&
      this.options.devChatBotBskyAppPassword
    ) {
      await this.chatBot.login({
        identifier: this.options.devChatBotBskyUsername,
        password: this.options.devChatBotBskyAppPassword,
      });

      console.log("dev chat bot logged in");
    }

    await this.labelPoliciesKeeper.init();

    // labeler bot handlers

    this.chatBot.on("open", async () => {
      console.log("open: labeler bot has begun listening for events");
    });

    this.chatBot.on("close", async () => {
      console.log("closed: labeler bot has stopped listening for events");
    });

    this.chatBot.on("error", async (error) => {
      console.log(`labeler bot error occurred: ${error}`);
    });

    this.chatBot.on("mention", async (post) => {
      const cmd = this.getCommandByPost(post);

      if (cmd) {
        console.log(
          `[mention] command received from ${post.author.did}: ${post.text} (${post.uri})`
        );

        const t = this.getFixedT(post.langs ? post.langs : [], cmd.commandName);
        const commandResult = await cmd.mention(post, t);
        if (commandResult.state != CommandStates.Closed) {
          const commandRecordKey = this.getCommandRecordKeyFromPost(post);
          try {
            const stateSavingResponse = await this.chatBot.putRecord(
              BskyCommunityBotLexicons.ids.AppBikeskyCommunityBotCommandState,
              commandResult,
              commandRecordKey
            );
          } catch (error) {
            console.log(
              `failed to save conversation state: ${JSON.stringify(error)}`
            );
          }
        }
      }
    });

    this.chatBot.on("reply", async (reply) => {
      if (reply.replyRef?.root.cid) {
        const commandRecordKey = this.getCommandRecordKeyFromPost(reply);
        try {
          const record = await this.chatBot.agent.get(
            "com.atproto.repo.getRecord",
            {
              params: {
                repo: this.chatBot.profile.did,
                collection:
                  BskyCommunityBotLexicons.ids
                    .AppBikeskyCommunityBotCommandState,
                rkey: commandRecordKey,
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
                    const recordAtUri = `at://${this.chatBot.profile.did}/${BskyCommunityBotLexicons.ids.AppBikeskyCommunityBotCommandState}/${commandRecordKey}`;
                    await this.chatBot.deleteRecord(recordAtUri);
                  } catch (error) {
                    console.log(
                      `failed to delete conversation state: ${JSON.stringify(
                        error
                      )}`
                    );
                  }
                } else {
                  try {
                    const stateSavingResponse = await this.chatBot.putRecord(
                      BskyCommunityBotLexicons.ids
                        .AppBikeskyCommunityBotCommandState,
                      commandResult,
                      commandRecordKey
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

    this.server.use(function (req, res) {
      res.status(404).json({ error: "404" });
    });

    this.server.listen(this.options.port, () => {
      console.log(`server listening on port ${this.options.port}`);
    });
  }
}
