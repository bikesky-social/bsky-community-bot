import { Command } from "./Command";
import { Post, PostReference } from "@skyware/bot";
import type { TFunction } from "i18next";

import * as CommandPrompt from "../lexicon/types/app/bikesky/communityBot/commandPrompt";
import * as UnlabelDefs from "../lexicon/types/app/bikesky/communityBot/unlabelDefs";
import * as BskyCommunityBotLexicons from "../lexicon/lexicons";
import { type $Typed } from "../lexicon/util";
const arrayEqual = require("array-equal");

export class UnlabelCommand extends Command {
  commandName = "unlabel";
  commandDescription = "remove labels from your account";

  async createUnlabelPromptRecord(
    post: PostReference,
    authorDid: string,
    labelIdentifiers: string[]
  ): Promise<$Typed<CommandPrompt.Record>> {
    const rule: $Typed<CommandPrompt.DidListRule> = {
      $type: "app.bikesky.communityBot.commandPrompt#didListRule",
      list: [authorDid],
    };

    const unlabelPrompt: $Typed<UnlabelDefs.UnlabelPrompt> = {
      $type: "app.bikesky.communityBot.unlabelDefs#unlabelPrompt",
      labelIdentifiers: labelIdentifiers,
    };

    const commandPrompt: $Typed<CommandPrompt.Record> = {
      $type: BskyCommunityBotLexicons.ids.AppBikeskyCommunityBotCommandPrompt,
      post: post.uri,
      command: this.commandName,
      prompt: unlabelPrompt,
      allow: [rule],
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

      const replyRef = await post.reply(
        {
          text: postText,
          langs: [translate("post.intro", { returnDetails: true }).usedLng],
        },
        { splitLongPost: true }
      );

      await this.createUnlabelPromptRecord(
        replyRef,
        authorDid,
        selfServeLabels.map((label) => label.val)
      );
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
    }
  }

  async reply(
    commandPrompt: CommandPrompt.Record,
    reply: Post,
    translate: TFunction<string, undefined>
  ) {
    if (UnlabelDefs.isUnlabelPrompt(commandPrompt.prompt)) {
      const unlabelPrompt: UnlabelDefs.UnlabelPrompt = commandPrompt.prompt;
      const selfServeLabels =
        await this.blueskyCommunityBot.labelPoliciesKeeper.getTargetSelfServeLabels(
          reply.author.did
        );

      const selfServeLabelIdentifiers = selfServeLabels.map(
        (label) => label.val
      );

      if (
        arrayEqual(
          selfServeLabelIdentifiers,
          unlabelPrompt.labelIdentifiers
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

      const maxChoice = unlabelPrompt.labelIdentifiers.length;

      // parse the reply as if it is a comma-separated list of numbers
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
              text: translate("error.invalidChoices"),
              langs: [
                translate("error.invalidChoices", { returnDetails: true })
                  .usedLng,
              ],
            });
            return;
          }
        }

        if (indexList.length != uniqueIndeces.length) {
          // invalid response - duplicate choices
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
        }
      }
    }
  }
}
