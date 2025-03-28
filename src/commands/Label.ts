import { Command } from "./Command";
import { Post, PostReference } from "@skyware/bot";
import { BlueskyCommunityBot } from "../BlueskyCommunityBot";
import type { TFunction } from "i18next";

import * as CommandPrompt from "../lexicon/types/app/bikesky/communityBot/commandPrompt";
import * as LabelDefs from "../lexicon/types/app/bikesky/communityBot/labelDefs";
import { type $Typed } from "../lexicon/util";
import * as BskyCommunityBotLexicons from "../lexicon/lexicons";
const arrayEqual = require("array-equal");

export class LabelCommand extends Command {
  commandName = "label";
  commandDescription = "add labels to your account";
  maxLabels = -1;

  constructor(blueskyCommunityBot: BlueskyCommunityBot) {
    super(blueskyCommunityBot);
    this.maxLabels =
      this.blueskyCommunityBot.options.maxLabels === -1
        ? Number.MAX_SAFE_INTEGER
        : this.blueskyCommunityBot.options.maxLabels;
  }

  async createLabelPromptRecord(
    post: PostReference,
    labelIdentifiers: string[],
    verifiedLabelIdentifiers: string[]
  ): Promise<$Typed<CommandPrompt.Record>> {
    const labelPrompt: $Typed<LabelDefs.LabelPrompt> = {
      $type: "app.bikesky.communityBot.labelDefs#labelPrompt",
      labelIdentifiers: labelIdentifiers,
      verifiedLabelIdentifiers: verifiedLabelIdentifiers,
    };

    const commandPrompt: $Typed<CommandPrompt.Record> = {
      $type: BskyCommunityBotLexicons.ids.AppBikeskyCommunityBotCommandPrompt,
      post: post.uri,
      command: this.commandName,
      prompt: labelPrompt,
    };

    await this.putPromptRecord(commandPrompt);

    return commandPrompt;
  }

  async mention(
    post: Post,
    translate: TFunction<string, undefined>,
    authorDid: string
  ) {
    // check if command is available
    if (
      this.blueskyCommunityBot.labelPoliciesKeeper.hasValidSelfServeLabels ===
      false
    ) {
      await post.reply({
        text: translate("error.commandNotAvailable"),
        langs: [
          translate("error.commandNotAvailable", { returnDetails: true })
            .usedLng,
        ],
      });
      return;
    }

    const selfServeLabels =
      await this.blueskyCommunityBot.labelPoliciesKeeper.getTargetSelfServeLabels(
        authorDid
      );

    // check if max labels would be exceeded
    if (selfServeLabels.length >= this.maxLabels) {
      await post.reply(
        {
          text: translate("error.maxLabels", {
            maxLabels: this.maxLabels,
            unlabelCommand: `${this.blueskyCommunityBot.commandPrefix}unlabel`,
          }),
          langs: [
            translate("error.maxLabels", { returnDetails: true }).usedLng,
          ],
        },
        { resolveFacets: false }
      );
      return;
    }

    // calculate the length of the post without examples populated
    let emptyPost =
      translate("post.intro") +
      "\n\n" +
      translate("post.instructions", { labelExamples: "", numberList: "" });

    const maxExampleLength =
      this.blueskyCommunityBot.options.maxPostLength - emptyPost.length;

    // generate random label examples
    const rndSelfServeIdentifiers =
      this.blueskyCommunityBot.options.selfServeLabelIdentifiers.map((x) => x);

    rndSelfServeIdentifiers.sort(() => Math.random() - 0.5);

    const examples = [];
    const exampleIndexes = [];
    const locales = post.langs ? post.langs : [];

    while (
      examples.length < this.blueskyCommunityBot.options.maxLabels &&
      examples.join(", ").length + exampleIndexes.join(",").length <
        maxExampleLength &&
      rndSelfServeIdentifiers.length > 0
    ) {
      const exampleIdent = rndSelfServeIdentifiers.shift() as string;

      examples.push(
        this.blueskyCommunityBot.labelPoliciesKeeper.getLabelName(
          exampleIdent,
          locales
        )
      );
      exampleIndexes.push(
        this.blueskyCommunityBot.labelPoliciesKeeper.get1BasedLabelIndex(
          exampleIdent
        )
      );

      while (
        examples.join(", ").length + exampleIndexes.join(",").length >
          maxExampleLength &&
        examples.length > 0 &&
        exampleIndexes.length > 0
      ) {
        examples.pop();
        exampleIndexes.pop();
      }
    }

    // construct the post text
    let postText =
      translate("post.intro") +
      "\n\n" +
      translate("post.instructions", {
        labelExamples: examples.join(", "),
        numberList: exampleIndexes.join(","),
      });

    // fetch the image payload
    const imagePayload =
      await this.blueskyCommunityBot.labelPoliciesKeeper.getLabelOptionsImagePayload(
        locales
      );

    // post
    const replyRef = await post.reply({
      text: postText,
      images: [
        {
          data: imagePayload.imageBlob,
          aspectRatio: {
            width: imagePayload.imageDimensions.width,
            height: imagePayload.imageDimensions.height,
          },
          alt: imagePayload.altText,
        },
      ],
      langs: [translate("post.intro", { returnDetails: true }).usedLng],
    });

    // save the command prompt record
    await this.createLabelPromptRecord(
      replyRef,
      this.blueskyCommunityBot.options.selfServeLabelIdentifiers,
      this.blueskyCommunityBot.options.verifiedLabels
    );
  }

  async reply(
    commandPrompt: CommandPrompt.Record,
    reply: Post,
    translate: TFunction<string, undefined>
  ) {
    if (LabelDefs.isLabelPrompt(commandPrompt.prompt)) {
      const labelPrompt: LabelDefs.LabelPrompt = commandPrompt.prompt;
      const selfServeLabels =
        await this.blueskyCommunityBot.labelPoliciesKeeper.getTargetSelfServeLabels(
          reply.author.did
        );

      if (
        arrayEqual(
          this.blueskyCommunityBot.options.selfServeLabelIdentifiers,
          labelPrompt.labelIdentifiers
        ) === false ||
        arrayEqual(
          this.blueskyCommunityBot.options.verifiedLabels,
          labelPrompt.verifiedLabelIdentifiers
        ) === false
      ) {
        const replyRef = await reply.reply({
          text: translate("error.labelsOutOfSync"),
          langs: [
            translate("labelsOutOfSync", { returnDetails: true }).usedLng,
          ],
        });

        await this.mention(await replyRef.fetch(), translate, reply.author.did);

        return;
      }

      const maxChoice =
        this.blueskyCommunityBot.options.selfServeLabelIdentifiers.length;

      const indexList: number[] = [];
      reply.text
        .replace(/\s/g, "")
        .split(",")
        .map((index) => {
          indexList.push(Number(index));
        });

      const uniqueIndeces = [...new Set(indexList)];
      try {
        for (let i = 0; i < indexList.length; i++) {
          const labelIndex = indexList[i];
          if (isNaN(labelIndex)) {
            // invalid response - not a number
            await this.replyWithUpdatedPrompt(reply, commandPrompt, {
              text: translate("error.invalidNumber"),
              langs: [
                translate("error.invalidNumber", { returnDetails: true })
                  .usedLng,
              ],
            });
            return;
          } else if (Number.isInteger(labelIndex) === false) {
            // invalid response - not an integer
            await this.replyWithUpdatedPrompt(reply, commandPrompt, {
              text: translate("error.invalidNumber"),
              langs: [
                translate("error.invalidNumber", { returnDetails: true })
                  .usedLng,
              ],
            });
            return;
          } else if (Number.isSafeInteger(labelIndex) === false) {
            // invalid response - not a safe integer
            await this.replyWithUpdatedPrompt(reply, commandPrompt, {
              text: translate("error.invalidNumber"),
              langs: [
                translate("error.invalidNumber", { returnDetails: true })
                  .usedLng,
              ],
            });
            return;
          } else if (labelIndex < 1 || labelIndex > maxChoice) {
            // invalid response - outside of range
            await this.replyWithUpdatedPrompt(reply, commandPrompt, {
              text: translate("error.invalidChoice"),
              langs: [
                translate("error.invalidChoice", { returnDetails: true })
                  .usedLng,
              ],
            });
            return;
          } else {
            for (let j = 0; j < selfServeLabels.length; j++) {
              const selfServeLabelIdentifier = selfServeLabels[j].val;
              if (
                this.blueskyCommunityBot.options.selfServeLabelIdentifiers[
                  labelIndex - 1
                ] === selfServeLabelIdentifier
              ) {
                // invalid response - they already have this label
                await this.replyWithUpdatedPrompt(reply, commandPrompt, {
                  text: translate("error.duplicateLabel", {
                    labelName:
                      this.blueskyCommunityBot.labelPoliciesKeeper.getLabelName(
                        selfServeLabelIdentifier,
                        reply.langs ? reply.langs : []
                      ),
                  }),
                  langs: [
                    translate("error.duplicateLabel", { returnDetails: true })
                      .usedLng,
                  ],
                });
                return;
              }
            }
          }
        }

        if (indexList.length + selfServeLabels.length > this.maxLabels) {
          // invalid response - this would result in too many labels
          await this.replyWithUpdatedPrompt(reply, commandPrompt, {
            text: translate("error.addingTooManyLabels", {
              maxLabels: this.maxLabels,
            }),
            langs: [
              translate("error.addingTooManyLabels", { returnDetails: true })
                .usedLng,
            ],
          });
          return;
        }

        if (indexList.length != uniqueIndeces.length) {
          // invalid response - not all unique choices
          await this.replyWithUpdatedPrompt(reply, commandPrompt, {
            text: translate("error.duplicateChoices"),
            langs: [
              translate("error.duplicateChoices", { returnDetails: true })
                .usedLng,
            ],
          });
          return;
        }
      } catch (error) {
        console.log(
          `unable to validate or respond to label selections: ${JSON.stringify(
            error
          )}`
        );
        return;
      }

      const labelsToApply = [];
      const labelsAwaitingVerification = [];

      // check if any labels need email verification

      for (let i = 0; i < indexList.length; i++) {
        const labelIndex = indexList[i] - 1;
        const labelIdentifier =
          this.blueskyCommunityBot.options.selfServeLabelIdentifiers[
            labelIndex
          ];

        if (
          this.blueskyCommunityBot.options.verifiedLabels.includes(
            labelIdentifier
          )
        ) {
          labelsAwaitingVerification.push(labelIdentifier);
        } else {
          labelsToApply.push(labelIdentifier);
        }
      }

      if (labelsToApply.length > 0) {
        try {
          // apply the labels
          await this.blueskyCommunityBot.labelerBot.label({
            reference: reply.author,
            labels: labelsToApply,
          });
        } catch (error) {
          console.log(`unable to apply labels: ${JSON.stringify(error)}`);
        }

        const appliedLabelNames =
          this.blueskyCommunityBot.labelPoliciesKeeper.getLabelNames(
            labelsToApply,
            reply.langs ? reply.langs : []
          );
        const appliedLabelNameString = appliedLabelNames.join(", ");
        try {
          if (labelsAwaitingVerification.length > 0) {
            // apply the labels we can and advise on manual verification for the rest
            const postRef = await reply.reply(
              {
                text:
                  translate("post.success", {
                    appliedLabelNames: appliedLabelNameString,
                  }) +
                  "\n\n" +
                  translate("post.unlabelInstruction", {
                    unlabelCommand: `${this.blueskyCommunityBot.commandPrefix}unlabel`,
                  }) +
                  "\n\n" +
                  translate("post.verifiedLabelRequested"),
                langs: [
                  translate("post.success", { returnDetails: true }).usedLng,
                ],
              },
              { splitLongPost: true, resolveFacets: false }
            );

            await postRef.reply({
              text: translate("post.verificationInstruction", {
                verificationEmail:
                  this.blueskyCommunityBot.options.labelVerificationEmail,
              }),
              langs: [
                translate("post.verificationInstruction", {
                  returnDetails: true,
                }).usedLng,
              ],
            });
          } else {
            // reply that we applied the following labels: xxx
            await reply.reply(
              {
                text:
                  translate("post.success", {
                    appliedLabelNames: appliedLabelNameString,
                  }) +
                  "\n\n" +
                  translate("post.unlabelInstruction", {
                    unlabelCommand: `${this.blueskyCommunityBot.commandPrefix}unlabel`,
                  }),
                langs: [
                  translate("post.success", { returnDetails: true }).usedLng,
                ],
              },
              { splitLongPost: true, resolveFacets: false }
            );
          }
        } catch (error) {
          console.log(
            `unable to respond about applying labels: ${JSON.stringify(error)}`
          );
          return;
        }
      } else if (labelsAwaitingVerification.length > 0) {
        try {
          // advise on manual verification
          const postRef = await reply.reply({
            text: translate("post.verifiedLabelRequested"),
            langs: [
              translate("post.verifiedLabelRequested", { returnDetails: true })
                .usedLng,
            ],
          });

          await postRef.reply({
            text: translate("post.verificationInstruction", {
              verificationEmail:
                this.blueskyCommunityBot.options.labelVerificationEmail,
            }),
            langs: [
              translate("post.verificationInstruction", { returnDetails: true })
                .usedLng,
            ],
          });
        } catch (error) {
          console.log(
            `unable to respond about verified labels: ${JSON.stringify(error)}`
          );
        }
      }
    }
  }
}
