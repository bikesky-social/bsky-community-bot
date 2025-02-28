import { Bot, EventStrategy, Post } from "@skyware/bot";
import { CommandGenerator } from "./CommandGenerator";
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
  botBskyUsername: string;
  botBskyPassword: string;
  labelerBskyUsername: string;
  labelerBskyPassword: string;
  maxLabels: number;
  selfServeLabelIdentifiers: string[];
  verifiedLabels: string[];
  port: number;
  labelVerificationEmail: string;
  defaultLocale: string;
  maxPostLength: number;
};

export class BlueskyCommunityBot {
  readonly options: BlueskyCommunityBotOptions;
  readonly server = express();
  readonly chatBot: Bot;
  readonly labelerBot: Bot;
  readonly commandGenerator: CommandGenerator;
  readonly labelPoliciesKeeper: LabelPoliciesKeeper;
  readonly i18n: typeof i18n;

  constructor(options: BlueskyCommunityBotOptions) {
    this.options = options;
    this.commandGenerator = new CommandGenerator(this);
    this.chatBot = new Bot({
      eventEmitterOptions: {
        strategy: EventStrategy.Firehose,
      },
    });
    this.labelerBot =
      this.options.botBskyUsername === this.options.labelerBskyUsername
        ? this.chatBot
        : new Bot();
    this.labelPoliciesKeeper = new LabelPoliciesKeeper(this);
    this.i18n = i18n.createInstance().use(Backend);
  }

  getCommandClassAndPartsByPost(
    post: Post
  ): { command: typeof Command; commandParts: string[] } | undefined {
    const lowerPostText = post.text.toLowerCase();

    if (lowerPostText.startsWith("@" + this.options.botBskyUsername + " ")) {
      const handleAndCommandParts = lowerPostText.split(" ");
      const commandParts = handleAndCommandParts[1].split(" ");
      const command = commandParts[0];

      const cmdClass = this.commandGenerator.getCommandClassByName(command);

      if (cmdClass) {
        return {
          command: this.commandGenerator.getCommandClassByName(command),
          commandParts: commandParts,
        };
      }
    }
    return undefined;
  }

  getFixedT(lngs: string[], namespace: string) {
    const lngsWithFallback = lngs.concat(this.options.defaultLocale);
    return this.i18n.getFixedT(lngsWithFallback, namespace);
  }

  async run() {
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

    //  initialize chat bots

    await this.chatBot.login({
      identifier: this.options.botBskyUsername,
      password: this.options.botBskyPassword,
    });

    console.log("chat bot logged in");

    if (this.options.botBskyUsername != this.options.labelerBskyUsername) {
      await this.labelerBot.login({
        identifier: this.options.labelerBskyUsername,
        password: this.options.labelerBskyPassword,
      });

      console.log("labeler bot logged in");
    }

    await this.commandGenerator.registerCommands();
    await this.labelPoliciesKeeper.init();

    // chat bot handlers

    this.chatBot.on("open", async () => {
      console.log("open: the chat bot has begun listening for events");
    });

    this.chatBot.on("close", async () => {
      console.log("closed: the chat bot has stopped listening for events");
    });

    this.chatBot.on("error", async (error) => {
      console.log(`chat bot error occurred: ${error}`);
    });

    this.chatBot.on("mention", async (post) => {
      const commandAndParts = this.getCommandClassAndPartsByPost(post);

      if (commandAndParts) {
        console.log(
          `${post.cid} command received from ${post.author.did}: ${post.text}`
        );

        const cmd = new commandAndParts.command(
          commandAndParts.commandParts,
          post
        );
        const t = this.getFixedT(
          post.langs ? post.langs : [],
          cmd.getCommandName()
        );
        const commandResult = await cmd.mention(post, t);
        if (commandResult.state != CommandStates.Closed) {
          try {
            const stateSavingResponse = await this.chatBot.putRecord(
              BskyCommunityBotLexicons.ids.AppBikeskyCommunityBotCommandState,
              commandResult,
              post.cid
            );
            console.log(
              `saved conversation state: ${JSON.stringify(stateSavingResponse)}`
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
        try {
          const record = await this.chatBot.agent.get(
            "com.atproto.repo.getRecord",
            {
              params: {
                repo: this.chatBot.profile.did,
                collection: BskyCommunityBotLexicons.ids.AppBikeskyCommunityBotCommandState,
                rkey: reply.replyRef?.root.cid,
              },
            }
          );

          console.log(`fetched commandState: ${JSON.stringify(record)}`);

          const recordValue = record.data.value;

          if (
            CommandState.isRecord(recordValue) &&
            CommandState.validateRecord(recordValue).success
          ) {
            const commandState = recordValue as CommandState.Record;

            if (commandState.authorDid === reply.author.did) {
              const cmdClass = this.commandGenerator.getCommandClassByName(
                commandState.command
              );
              if (cmdClass) {
                const t = this.getFixedT(
                  reply.langs ? reply.langs : [],
                  commandState.command
                );
                const commandResult = await cmdClass.reply(
                  commandState,
                  reply,
                  t
                );

                if (commandResult.state === CommandStates.Closed) {
                  try {
                    const recordAtUri = `at://${this.chatBot.profile.did}/${BskyCommunityBotLexicons.ids.AppBikeskyCommunityBotCommandState}/${reply.replyRef?.root.cid}`;
                    await this.chatBot.deleteRecord(recordAtUri);
                    console.log(`conversation closed: ${recordAtUri}`);
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
                      reply.replyRef?.root.cid
                    );
                    console.log(
                      `saved conversation state: ${JSON.stringify(
                        stateSavingResponse
                      )}`
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
