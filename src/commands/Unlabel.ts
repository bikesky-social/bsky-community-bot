import { Command } from "./Command";
import { Post } from "@skyware/bot";
import * as CommandState from "../lexicon/types/app/bikesky/communityBot/commandState";
import type { TFunction } from "i18next";

enum UnlabelCommandStates {
  Closed,
  WaitingForUnlabelChoices,
}

export class UnlabelCommand extends Command {
  commandName = "unlabel";
  commandDescription = "remove labels from your account";

  async mention(
    post: Post,
    translate: TFunction<string, undefined>
  ): Promise<CommandState.Record> {
    const conversationClosedResponse: CommandState.Record = {
      $type: "app.bikesky.communityBot.commandState",
      command: this.commandName,
      authorDid: post.author.did,
      state: UnlabelCommandStates.Closed,
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

    // check if author has zero labels
    if (selfServeLabels.length > 0) {
      let labelListString = "";
      const removeIndexes = [];

      for (let i = 0; i < selfServeLabels.length; i++) {
        const selfServeLabel = selfServeLabels[i];
        const labelString = `${
          i + 1
        }. ${this.blueskyCommunityBot.labelPoliciesKeeper.getLabelName(
          selfServeLabel.val,
          post.langs ? post.langs : []
        )}\n`;
        labelListString = labelListString.concat(labelString);
        removeIndexes.push(`${i + 1}`);
      }

      const postText =
        translate("post.intro") +
        "\n\n" +
        labelListString +
        "\n" +
        translate("post.replyInstructions", {
          numberList: removeIndexes.join(","),
        });

      await post.reply(
        {
          text: postText,
          langs: [translate("post.intro", { returnDetails: true }).usedLng],
        },
        { splitLongPost: true }
      );

      return {
        $type: "app.bikesky.communityBot.commandState",
        command: this.commandName,
        authorDid: post.author.did,
        state: UnlabelCommandStates.WaitingForUnlabelChoices,
      };
    } else {
      await post.reply(
        {
          text: translate("error.noLabelsFound", {
            labelCommand: `${this.blueskyCommunityBot.commandPrefix}label`,
          }),
          langs: [
            translate("error.noLabelsFound", { returnDetails: true }).usedLng,
          ],
        },
        { resolveFacets: false }
      );

      return conversationClosedResponse;
    }
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
      state: UnlabelCommandStates.Closed,
    };

    if (commandState.state === UnlabelCommandStates.WaitingForUnlabelChoices) {
      const stillWaitingResponse: CommandState.Record = {
        $type: "app.bikesky.communityBot.commandState",
        command: this.commandName,
        authorDid: reply.author.did,
        state: UnlabelCommandStates.WaitingForUnlabelChoices,
      };

      const selfServeLabels =
        await this.blueskyCommunityBot.labelPoliciesKeeper.getTargetSelfServeLabels(
          reply.author.did
        );

      const maxChoice = selfServeLabels.length;

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
              text: translate("error.invalidChoices"),
              langs: [
                translate("error.invalidChoices", { returnDetails: true })
                  .usedLng,
              ],
            });
            return stillWaitingResponse;
          }
        }

        if (indexList.length != uniqueIndeces.length) {
          // invalid response - duplicate choices
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

      const labelsToRemove = [];

      for (let i = 0; i < indexList.length; i++) {
        const labelIndex = indexList[i] - 1;
        const labelIdentifier = selfServeLabels[labelIndex];

        labelsToRemove.push(labelIdentifier.val);
      }

      if (labelsToRemove.length > 0) {
        try {
          // remove the labels
          await this.blueskyCommunityBot.labelerBot.negateLabels({
            reference: reply.author,
            labels: labelsToRemove,
          });
        } catch (error) {
          console.log(`unable to remove labels: ${JSON.stringify(error)}`);
        }

        const appliedLabelNames =
          this.blueskyCommunityBot.labelPoliciesKeeper.getLabelNames(
            labelsToRemove,
            reply.langs ? reply.langs : []
          );
        const removedLabelNameString = appliedLabelNames.join(", ");
        try {
          // reply that we applied the following labels: xxx
          const postText =
            translate("post.successLine1", {
              labelNames: removedLabelNameString,
            }) +
            "\n\n" +
            translate("post.successLine2", {
              labelCommand: `${this.blueskyCommunityBot.commandPrefix}label`,
            });

          await reply.reply(
            {
              text: postText,
              langs: [
                translate("post.successLine1", { returnDetails: true }).usedLng,
              ],
            },
            { splitLongPost: true, resolveFacets: false }
          );
        } catch (error) {
          console.log(
            `unable to respond about removing labels: ${JSON.stringify(error)}`
          );
          return conversationClosedResponse;
        }
      }
    }

    return conversationClosedResponse;
  }
}
