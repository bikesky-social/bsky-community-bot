import { Command } from "./Command";
import { Post } from "@skyware/bot";
import * as CommandState from "../lexicon/types/app/bikesky/communityBot/commandState";
import { BlueskyCommunityBot } from "../BlueskyCommunityBot";
import type { TFunction } from "i18next";

enum LabelCommandStates {
  Closed,
  WaitingForLabelChoices,
}

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

  async mention(
    post: Post,
    translate: TFunction<string, undefined>
  ): Promise<CommandState.Record> {
    const conversationClosedResponse: CommandState.Record = {
      $type: "app.bikesky.communityBot.commandState",
      command: this.commandName,
      authorDid: post.author.did,
      state: LabelCommandStates.Closed,
    };

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
      return conversationClosedResponse;
    }

    const selfServeLabels =
      await this.blueskyCommunityBot.labelPoliciesKeeper.getTargetSelfServeLabels(
        post.author.did
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
      return conversationClosedResponse;
    }

    // calculate the length of the post without examples populated
    let emptyPost =
      translate("post.intro") +
      "\n\n" +
      translate("post.instructions", { labelExamples: "", numberList: "" });

    if (this.blueskyCommunityBot.options.verifiedLabels.length > 0) {
      emptyPost += "\n\n" + translate("post.verification");
    }

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

    if (this.blueskyCommunityBot.options.verifiedLabels.length > 0) {
      postText += "\n\n" + translate("post.verification");
    }

    // fetch the image payload
    const imagePayload =
      await this.blueskyCommunityBot.labelPoliciesKeeper.getLabelOptionsImagePayload(
        locales
      );

    // post
    await post.reply({
      text: postText,
      images: [
        {
          data: imagePayload.labelOptionsCanvasBlob,
          aspectRatio: {
            width: imagePayload.labelOptionsCanvas.width,
            height: imagePayload.labelOptionsCanvas.height,
          },
          alt: imagePayload.labelOptionsAltText,
        },
      ],
      langs: [translate("post.intro", { returnDetails: true }).usedLng],
    });

    return {
      $type: "app.bikesky.communityBot.commandState",
      command: this.commandName,
      authorDid: post.author.did,
      state: LabelCommandStates.WaitingForLabelChoices,
    };
  }

  async reply(
    commandState: CommandState.Record,
    reply: Post,
    translate: TFunction<string, undefined>
  ): Promise<CommandState.Record> {
    const conversationClosedResponse: CommandState.Record = {
      $type: "app.bikesky.communityBot.commandState",
      command: this.commandName,
      authorDid: reply.author.did,
      state: LabelCommandStates.Closed,
    };

    if (commandState.state === LabelCommandStates.WaitingForLabelChoices) {
      const stillWaitingResponse: CommandState.Record = {
        $type: "app.bikesky.communityBot.commandState",
        command: this.commandName,
        authorDid: reply.author.did,
        state: LabelCommandStates.WaitingForLabelChoices,
      };

      const selfServeLabels =
        await this.blueskyCommunityBot.labelPoliciesKeeper.getTargetSelfServeLabels(
          reply.author.did
        );

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
            await reply.reply({
              text: translate("error.invalidNumber"),
              langs: [
                translate("error.invalidNumber", { returnDetails: true })
                  .usedLng,
              ],
            });
            return stillWaitingResponse;
          } else if (Number.isInteger(labelIndex) === false) {
            // invalid response - not an integer
            await reply.reply({
              text: translate("error.invalidNumber"),
              langs: [
                translate("error.invalidNumber", { returnDetails: true })
                  .usedLng,
              ],
            });
            return stillWaitingResponse;
          } else if (Number.isSafeInteger(labelIndex) === false) {
            // invalid response - not a safe integer
            await reply.reply({
              text: translate("error.invalidNumber"),
              langs: [
                translate("error.invalidNumber", { returnDetails: true })
                  .usedLng,
              ],
            });
            return stillWaitingResponse;
          } else if (labelIndex < 1 || labelIndex > maxChoice) {
            // invalid response - outside of range
            await reply.reply({
              text: translate("error.invalidChoice"),
              langs: [
                translate("error.invalidChoice", { returnDetails: true })
                  .usedLng,
              ],
            });
            return stillWaitingResponse;
          } else {
            for (let j = 0; j < selfServeLabels.length; j++) {
              const selfServeLabelIdentifier = selfServeLabels[j].val;
              if (
                this.blueskyCommunityBot.options.selfServeLabelIdentifiers[
                  labelIndex - 1
                ] === selfServeLabelIdentifier
              ) {
                // invalid response - they already have this label
                await reply.reply({
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
                return stillWaitingResponse;
              }
            }
          }
        }

        if (indexList.length + selfServeLabels.length > this.maxLabels) {
          // invalid response - this would result in too many labels
          await reply.reply({
            text: translate("error.addingTooManyLabels", {
              maxLabels: this.maxLabels,
            }),
            langs: [
              translate("error.addingTooManyLabels", { returnDetails: true })
                .usedLng,
            ],
          });
          return stillWaitingResponse;
        }

        if (indexList.length != uniqueIndeces.length) {
          // invalid response - not all unique choices
          await reply.reply({
            text: translate("error.duplicateChoices"),
            langs: [
              translate("error.duplicateChoices", { returnDetails: true })
                .usedLng,
            ],
          });
          return stillWaitingResponse;
        }
      } catch (error) {
        console.log(
          `unable to validate or respond to label selections: ${JSON.stringify(
            error
          )}`
        );
        return stillWaitingResponse;
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
          return conversationClosedResponse;
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
          return conversationClosedResponse;
        }
      }
    }

    return conversationClosedResponse;
  }
}
