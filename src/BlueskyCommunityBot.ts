import { Bot, EventStrategy, Post } from "@skyware/bot";
import { CommandGenerator } from "./CommandGenerator";
import { Command } from "./commands/Command";
import express from "express";
import type { CommandState } from "./commands/Command";
import { CommandStates } from "./commands/Command";
import { LabelPoliciesKeeper } from "./LabelPoliciesKeeper";
import i18n from "i18next";
import Backend from "i18next-fs-backend";
const fs = require("fs");

type BlueskyCommunityBotOptions = {
  botBskyUsername: string;
  botBskyPassword: string;
  labelerBskyUsername: string;
  labelerBskyPassword: string;
  labelerDid: string;
  maxLabels: number;
  selfServeLabelIdentifiers: string[];
  verifiedLabels: string[];
  port: number;
  conversationCollection: string;
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

  log(key: string) {
    console.log(this.i18n.t(key, key, { lng: this.options.defaultLocale }));
  }

  async run() {
    // initialize i18n
    this.i18n.init({
      fallbackLng: "en",
      debug: true,
      initAsync: false,
      saveMissing: true,
      preload: fs.readdirSync("./locales"),
      backend: {
        loadPath: "./locales/{{lng}}/{{ns}}.json",
        addPath: "./locales/{{lng}}/{{ns}}.json",
      },
    });

    this.log("initialized i18n");

    //  initialize chat bots

    await this.chatBot.login({
      identifier: this.options.botBskyUsername,
      password: this.options.botBskyPassword,
    });

    this.log("chat bot logged in");

    if (this.options.botBskyUsername != this.options.labelerBskyUsername) {
      await this.labelerBot.login({
        identifier: this.options.labelerBskyUsername,
        password: this.options.labelerBskyPassword,
      });

      this.log("labeler bot logged in");
    }

    await this.commandGenerator.registerCommands();
    await this.labelPoliciesKeeper.init();

    // chat bot handlers

    this.chatBot.on("open", async () => {
      this.log("open: the chat bot has begun listening for events");
    });

    this.chatBot.on("close", async () => {
      this.log("closed: the chat bot has stopped listening for events");
    });

    this.chatBot.on("error", async (error) => {
      this.log(`chat bot error occurred: ${error}`);
    });

    this.chatBot.on("mention", async (post) => {
      const commandAndParts = this.getCommandClassAndPartsByPost(post);

      if (commandAndParts) {
        this.log(
          `${post.cid} command received from ${post.author.did}: ${post.text}`
        );

        const cmd = new commandAndParts.command(
          commandAndParts.commandParts,
          post
        );
        const validCmd = await cmd.validateCommand();
        if (validCmd.valid) {
          const commandResult = await cmd.mention(post);
          if (commandResult.state != CommandStates.Closed) {
            try {
              const stateSavingResponse = await this.chatBot.putRecord(
                this.options.conversationCollection,
                commandResult,
                post.cid
              );
              this.log(
                `saved conversation state: ${JSON.stringify(
                  stateSavingResponse
                )}`
              );
            } catch (error) {
              this.log(
                `failed to save conversation state: ${JSON.stringify(error)}`
              );
            }
          }
        } else {
          this.log(
            `${post.cid} command validation response: ${validCmd.response}`
          );
          await post.reply({ text: validCmd.response });
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
                collection: this.options.conversationCollection,
                rkey: reply.replyRef?.root.cid,
              },
            }
          );

          this.log(`fetched commandState: ${JSON.stringify(record)}`);
          const commandState = record.data.value as CommandState;

          if (commandState.authorDid === reply.author.did) {
            const cmdClass = this.commandGenerator.getCommandClassByName(
              commandState.command
            );
            if (cmdClass) {
              const commandResult = await cmdClass.reply(commandState, reply);

              if (commandResult.state === CommandStates.Closed) {
                try {
                  const recordAtUri = `at://${this.chatBot.profile.did}/${this.options.conversationCollection}/${reply.replyRef?.root.cid}`;
                  const result = await this.chatBot.deleteRecord(recordAtUri);
                  this.log(`conversation closed: ${recordAtUri}`);
                } catch (error) {
                  this.log(
                    `failed to delete conversation state: ${JSON.stringify(
                      error
                    )}`
                  );
                }
              } else {
                try {
                  const stateSavingResponse = await this.chatBot.putRecord(
                    this.options.conversationCollection,
                    commandResult,
                    reply.replyRef?.root.cid
                  );
                  this.log(
                    `saved conversation state: ${JSON.stringify(
                      stateSavingResponse
                    )}`
                  );
                } catch (error) {
                  this.log(
                    `failed to save conversation state: ${JSON.stringify(
                      error
                    )}`
                  );
                }
              }
            }
          }
        } catch (error) {
          this.log(`failed to fetch commandState: ${JSON.stringify(error)}`);
        }
      } else {
        this.log("reply has no root: " + JSON.stringify(reply));
      }
    });

    // start the server

    this.server.get("/health", (req, res) => {
      res.json({ health: "ok" });
    });

    this.server.listen(this.options.port, () => {
      this.log(`server listening on port ${this.options.port}`);
    });
  }
}
