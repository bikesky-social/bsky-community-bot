import { Command } from "./Command";
import { Post } from "@skyware/bot";
import type { CommandValidationResult, CommandState } from "./Command";
import type { CommandMap } from "../CommandGenerator";
import { BlueskyCommunityBot } from "../BlueskyCommunityBot";

enum LabelCommandStates {
  Closed,
  WaitingForLabelChoices,
}

export class LabelCommand extends Command {
  static commandName = "label";
  static commandDescription = "add labels to your account";
  static maxLabels = -1;

  static async registerCommand(
    cmap: CommandMap,
    blueskyCommunityBot: BlueskyCommunityBot
  ) {
    super.registerCommand(cmap, blueskyCommunityBot);

    LabelCommand.maxLabels =
      LabelCommand.blueskyCommunityBot.options.maxLabels === -1
        ? Number.MAX_SAFE_INTEGER
        : LabelCommand.blueskyCommunityBot.options.maxLabels;
  }

  async validateCommand(): Promise<CommandValidationResult> {
    if (
      LabelCommand.blueskyCommunityBot.labelPoliciesKeeper
        .hasValidSelfServeLabels
    ) {
      const selfServeLabels =
        await LabelCommand.blueskyCommunityBot.labelPoliciesKeeper.getTargetSelfServeLabels(
          this.rootPost.author.did
        );

      // check if max labels would be exceeded
      if (selfServeLabels.length >= LabelCommand.maxLabels) {
        return {
          valid: false,
          response: `this account already has the maximum number of labels that we allow (${LabelCommand.maxLabels}). if you would like to switch to some new labels, you can remove labels from an account by using the unlabel command.`,
        };
      } else {
        this.validCommand = true;
        return {
          valid: true,
          response: "",
        };
      }
    } else {
      return {
        valid: false,
        response: `this command is not available at the moment. please try again later.`,
      };
    }
  }

  async mention(post: Post): Promise<CommandState> {
    const example1 = "bike-enjoyer";
    const example2 = "fietser";
    const example3 = "safe-streets";

    const locales = post.langs
      ? post.langs
      : [LabelCommand.blueskyCommunityBot.options.defaultLabelLocale];

    const postText = `let's get you some bike labels!\n\nhere's a list of our labels. please reply with the numbers of the labels you would like separated by commas. for example, if you want ${LabelCommand.blueskyCommunityBot.labelPoliciesKeeper.getLabelName(
      example1,
      locales
    )}, ${LabelCommand.blueskyCommunityBot.labelPoliciesKeeper.getLabelName(
      example2,
      locales
    )} and ${LabelCommand.blueskyCommunityBot.labelPoliciesKeeper.getLabelName(
      example3,
      locales
    )}, reply with "${LabelCommand.blueskyCommunityBot.labelPoliciesKeeper.get1BasedLabelIndex(
      example1
    )}, ${LabelCommand.blueskyCommunityBot.labelPoliciesKeeper.get1BasedLabelIndex(
      example2
    )}, ${LabelCommand.blueskyCommunityBot.labelPoliciesKeeper.get1BasedLabelIndex(
      example3
    )}"\n\n*labels with asterisks will require a manual verification step`;

    const imagePayload =
      await LabelCommand.blueskyCommunityBot.labelPoliciesKeeper.getLabelOptionsImagePayload(
        locales
      );

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
    });

    return {
      command: LabelCommand.commandName,
      authorDid: post.author.did,
      state: LabelCommandStates.WaitingForLabelChoices,
    };
  }

  static async reply(
    commandState: CommandState,
    reply: Post
  ): Promise<CommandState> {
    const conversationClosedResponse = {
      command: LabelCommand.commandName,
      authorDid: reply.author.did,
      state: LabelCommandStates.Closed,
    };

    if (commandState.state === LabelCommandStates.WaitingForLabelChoices) {
      const stillWaitingResponse = {
        command: LabelCommand.commandName,
        authorDid: reply.author.did,
        state: LabelCommandStates.WaitingForLabelChoices,
      };

      const selfServeLabels =
        await LabelCommand.blueskyCommunityBot.labelPoliciesKeeper.getTargetSelfServeLabels(
          reply.author.did
        );

      const maxChoice =
        LabelCommand.blueskyCommunityBot.options.selfServeLabelIdentifiers
          .length;

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
              text: "not all of these choices are valid numbers. can you please try again?",
            });
            return stillWaitingResponse;
          } else if (Number.isInteger(labelIndex) === false) {
            // invalid response - not an integer
            await reply.reply({
              text: "not all of these choices are valid numbers. can you please try again?",
            });
            return stillWaitingResponse;
          } else if (Number.isSafeInteger(labelIndex) === false) {
            // invalid response - not a safe integer
            await reply.reply({
              text: "not all of these choices are valid numbers. can you please try again?",
            });
            return stillWaitingResponse;
          } else if (labelIndex < 1 || labelIndex > maxChoice) {
            // invalid response - outside of range
            await reply.reply({
              text: "not all of these choices are valid. can you please try again?",
            });
            return stillWaitingResponse;
          } else {
            for (let j = 0; j < selfServeLabels.length; j++) {
              const selfServeLabelIdentifier = selfServeLabels[j].val;
              if (
                LabelCommand.blueskyCommunityBot.options
                  .selfServeLabelIdentifiers[labelIndex - 1] ===
                selfServeLabelIdentifier
              ) {
                // invalid response - they already have this label
                await reply.reply({
                  text: `you already have one of these labels (${LabelCommand.blueskyCommunityBot.labelPoliciesKeeper.getLabelName(
                    selfServeLabelIdentifier,
                    reply.langs
                      ? reply.langs
                      : [
                          LabelCommand.blueskyCommunityBot.options
                            .defaultLabelLocale,
                        ]
                  )}). can you please try again?`,
                });
                return stillWaitingResponse;
              }
            }
          }
        }

        if (
          indexList.length + selfServeLabels.length >
          LabelCommand.maxLabels
        ) {
          // invalid response - this would result in too many labels
          await reply.reply({
            text: `adding this many labels would exceed the maximum that we allow on accounts (${LabelCommand.maxLabels}). can you please try again?`,
          });
          return stillWaitingResponse;
        }

        if (indexList.length != uniqueIndeces.length) {
          // invalid response - not all unique choices
          await reply.reply({
            text: "not all of these choices are unique. can you please try again?",
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
          LabelCommand.blueskyCommunityBot.labelPoliciesKeeper.labelerPolicies
            .labelValues[labelIndex];

        if (
          LabelCommand.blueskyCommunityBot.options.verifiedLabels.includes(
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
          await LabelCommand.blueskyCommunityBot.labelerBot.label({
            reference: reply.author,
            labels: labelsToApply,
          });
        } catch (error) {
          console.log(`unable to apply labels: ${JSON.stringify(error)}`);
        }

        const appliedLabelNames =
          LabelCommand.blueskyCommunityBot.labelPoliciesKeeper.getLabelNames(
            labelsToApply,
            reply.langs
              ? reply.langs
              : [LabelCommand.blueskyCommunityBot.options.defaultLabelLocale]
          );
        const appliedLabelNameString = appliedLabelNames.join(", ");
        try {
          if (labelsAwaitingVerification.length > 0) {
            // apply the labels we can and advise on manual verification for the rest
            const postRef = await reply.reply(
              {
                text: `okay i applied these labels to your account: ${appliedLabelNameString}\n\nif you ever want to remove these, you can do so by sending me a post that says 'unlabel'\n\n1 or more of the labels you asked for needs manual verification ...`,
              },
              { splitLongPost: true }
            );

            await postRef.reply({
              text: `to continue the verification process, can you send an email to ${LabelCommand.blueskyCommunityBot.options.labelVerificationEmail} that includes:\n\n1. your Bluesky handle\n2. the verified label you would like\n\nit helps if the email comes from a domain that relates to the label, but if that isn't possible, we can still figure it out`,
            });
          } else {
            // reply that we applied the following labels: xxx
            await reply.reply(
              {
                text: `okay i have applied these labels to your account: ${appliedLabelNameString}\n\nif you ever want to remove these, you can do so by sending me a post that says unlabel`,
              },
              { splitLongPost: true }
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
            text: `one or more of the labels you asked for needs to be verified manually ...`,
          });

          await postRef.reply({
            text: `to continue the verification process, can you send an email to ${LabelCommand.blueskyCommunityBot.options.labelVerificationEmail} that includes:\n\n1. your Bluesky handle\n2. the verified label you would like\n\nit helps if the email comes from a domain that relates to the label, but if that isn't possible, we can still figure it out`,
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
