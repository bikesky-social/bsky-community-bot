import { Bot, EventStrategy, Post } from "@skyware/bot";
import { Command } from "./commands/Command";
import express from "express";
import * as CommandPrompt from "./lexicon/types/app/bikesky/communityBot/commandPrompt";

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
    const lowerPostText = post.text.trim().toLowerCase();

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
    const localesDir = __dirname + "/../locales";
    this.i18n.init({
      fallbackLng: this.options.defaultLocale,
      // debug: true,
      initAsync: false,
      preload: fs.readdirSync(localesDir),
      ns: fs
        .readdirSync(`${localesDir}/${this.options.defaultLocale}`)
        .map((fileName: string) => fileName.split(".")[0]),
      backend: {
        loadPath: `${localesDir}/{{lng}}/{{ns}}.json`,
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
        await cmd.mention(post, t, post.author.did);
      }
    });

    this.chatBot.on("reply", async (reply) => {
      if (reply.replyRef?.parent.uri) {
        try {
          const rkey = reply.replyRef.parent.uri.split("/").pop() as string;
          const record = await this.chatBot.agent.get(
            "com.atproto.repo.getRecord",
            {
              params: {
                repo: this.chatBot.profile.did,
                collection:
                  BskyCommunityBotLexicons.ids
                    .AppBikeskyCommunityBotCommandPrompt,
                rkey: rkey,
              },
            }
          );

          const recordValue = record.data.value;

          if (
            CommandPrompt.isRecord(recordValue) &&
            CommandPrompt.validateRecord(recordValue).success
          ) {
            const commandPrompt = recordValue as CommandPrompt.Record;

            let allow = true;

            if (commandPrompt.allow) {
              for (let i = 0; i < commandPrompt.allow.length; i++) {
                const rule = commandPrompt.allow[i];

                if (CommandPrompt.isDidListRule(rule)) {
                  if (rule.list.includes(reply.author.did) === false) {
                    allow = false;

                    // TODO: reply saying they aren't allowed to reply?
                  }
                }
              }
            }

            if (allow) {
              const cmd = this.commandMap[commandPrompt.command];
              if (cmd) {
                console.log(
                  `[reply] command received from ${reply.author.did}: ${reply.text} (${reply.uri})`
                );

                const t = this.getFixedT(
                  reply.langs ? reply.langs : [],
                  commandPrompt.command
                );
                const commandResult = await cmd.reply(commandPrompt, reply, t);
              }
            }
          }
        } catch (error) {
          console.log(
            `failed to fetch command prompt: ${JSON.stringify(error)}`
          );
        }
      }
    });

    // start the server

    this.server.set("view engine", "ejs");
    this.server.set("views", __dirname + "/../views");
    this.server.use(express.static(__dirname + "/../public"));

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
