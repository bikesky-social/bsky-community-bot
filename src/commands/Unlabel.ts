import { Command } from "./Command";
import { Post } from "@skyware/bot";
import type { CommandValidationResult, CommandState } from "./Command";
import type { TFunction } from "i18next";

enum UnlabelCommandStates {
  Closed,
  WaitingForUnlabelChoices,
}

export class UnlabelCommand extends Command {
  static commandName = "unlabel";
  static commandDescription = "remove labels from your account";

  async validateCommand(
    t: TFunction<string, undefined>
  ): Promise<CommandValidationResult> {
    if (
      UnlabelCommand.blueskyCommunityBot.labelPoliciesKeeper
        .hasValidSelfServeLabels
    ) {
      this.validCommand = true;
      return {
        valid: true,
        response: "",
      };
    } else {
      return {
        valid: false,
        response: t("error.commandNotAvailable"),
      };
    }
  }

  async mention(
    post: Post,
    t: TFunction<string, undefined>
  ): Promise<CommandState> {
    const selfServeLabels =
      await UnlabelCommand.blueskyCommunityBot.labelPoliciesKeeper.getTargetSelfServeLabels(
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
        }. ${UnlabelCommand.blueskyCommunityBot.labelPoliciesKeeper.getLabelName(
          selfServeLabel.val,
          post.langs ? post.langs : []
        )}\n`;
        labelListString = labelListString.concat(labelString);
        removeIndexes.push(`${i + 1}`);
      }
      await post.reply(
        {
          text: `here is a list of the labels on your account:\n\n${labelListString}\nplease reply with the numbers of the labels you would like separated by commas. for example, if you want to remove all of them, reply with "${removeIndexes.join(
            ","
          )}"`,
        },
        { splitLongPost: true }
      );

      return {
        command: UnlabelCommand.commandName,
        authorDid: post.author.did,
        state: UnlabelCommandStates.WaitingForUnlabelChoices,
      };
    } else {
      await post.reply({
        text: t("error.noLabelsFound"),
      });

      return {
        command: UnlabelCommand.commandName,
        authorDid: post.author.did,
        state: UnlabelCommandStates.Closed,
      };
    }
  }

  static async reply(
    commandState: CommandState,
    reply: Post,
    t: TFunction<string, undefined>
  ): Promise<CommandState> {
    const conversationClosedResponse = {
      command: UnlabelCommand.commandName,
      authorDid: reply.author.did,
      state: UnlabelCommandStates.Closed,
    };

    if (commandState.state === UnlabelCommandStates.WaitingForUnlabelChoices) {
      const stillWaitingResponse = {
        command: UnlabelCommand.commandName,
        authorDid: reply.author.did,
        state: UnlabelCommandStates.WaitingForUnlabelChoices,
      };

      const selfServeLabels =
        await UnlabelCommand.blueskyCommunityBot.labelPoliciesKeeper.getTargetSelfServeLabels(
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
          }
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

      const labelsToRemove = [];

      for (let i = 0; i < indexList.length; i++) {
        const labelIndex = indexList[i] - 1;
        const labelIdentifier = selfServeLabels[labelIndex];

        labelsToRemove.push(labelIdentifier.val);
      }

      if (labelsToRemove.length > 0) {
        try {
          // remove the labels
          await UnlabelCommand.blueskyCommunityBot.labelerBot.negateLabels({
            reference: reply.author,
            labels: labelsToRemove,
          });
        } catch (error) {
          console.log(`unable to remove labels: ${JSON.stringify(error)}`);
        }

        const appliedLabelNames =
          UnlabelCommand.blueskyCommunityBot.labelPoliciesKeeper.getLabelNames(
            labelsToRemove,
            reply.langs ? reply.langs : []
          );
        const removedLabelNameString = appliedLabelNames.join(", ");
        try {
          // reply that we applied the following labels: xxx
          await reply.reply(
            {
              text: `okay i have removed these labels from your account: ${removedLabelNameString}\n\nif you ever want to add more labels, you can do so by sending me a post that says 'label'`,
            },
            { splitLongPost: true }
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
