import { BlueskyCommunityBot } from "./BlueskyCommunityBot";
import type { Request, Response } from "express";
import { AtpAgent } from "@atproto/api";
import type { LabelerPolicies } from "@atproto/api/dist/client/types/app/bsky/labeler/defs";
import type { ComAtprotoLabelDefs } from "@atcute/client/lexicons";
import { Canvas, loadImage } from "canvas";
import opentype from "opentype.js";
import drawText from "node-canvas-text";

type LabelOptionsImagePayload = {
  labelOptionsCanvas: Canvas;
  labelOptionsCanvasBlob: Blob;
  labelOptionsAltText: string;
};

export class LabelPoliciesKeeper {
  readonly blueskyCommunityBot: BlueskyCommunityBot;
  labelerPolicies: LabelerPolicies = {
    labelValues: [],
    labelValueDefinitions: [],
  };
  hasValidSelfServeLabels: boolean = false;

  constructor(blueskyCommunityBot: BlueskyCommunityBot) {
    this.blueskyCommunityBot = blueskyCommunityBot;
  }

  async init() {
    this.blueskyCommunityBot.server.get(
      "/update-label-policies",
      this.updateLabelDefsRoute.bind(this)
    );

    this.blueskyCommunityBot.server.get(
      "/get-label-image",
      this.getLabelImageRoute.bind(this)
    );

    await this.updateLabelPolicies();
  }

  getLabelIdentifiersCommaSeparatedString() {
    return this.labelerPolicies.labelValues.join(",");
  }

  validateSelfServeLabels(): boolean {
    // ensure self serve labels are in label defs
    const labelsNotFoundInDefs =
      this.blueskyCommunityBot.options.selfServeLabelIdentifiers.filter(
        (x) => !this.labelerPolicies.labelValues.includes(x)
      );

    if (labelsNotFoundInDefs.length === 0) {
      console.log(
        `self serve labels validated (${this.blueskyCommunityBot.options.selfServeLabelIdentifiers.length})`
      );
      return true;
    }

    console.log(
      `self serve labels could not be validated. ${labelsNotFoundInDefs.length} identifiers not found in label defs: ${labelsNotFoundInDefs}`
    );
    return false;
  }

  validateVerifiedLabels(): boolean {
    // ensure verified labels are in label defs
    const labelsNotFoundInDefs =
      this.blueskyCommunityBot.options.verifiedLabels.filter(
        (x) => !this.labelerPolicies.labelValues.includes(x)
      );

    if (labelsNotFoundInDefs.length != 0) {
      console.log(
        `verified labels could not be validated. ${labelsNotFoundInDefs.length} identifiers could not be found in the labeler's label defs: ${labelsNotFoundInDefs}`
      );
      return false;
    }

    // ensure verified labels are in the list of self serve labels
    const labelsNotFoundInSelfServeLabelIdentifiers =
      this.blueskyCommunityBot.options.verifiedLabels.filter(
        (x) =>
          !this.blueskyCommunityBot.options.selfServeLabelIdentifiers.includes(
            x
          )
      );

    if (labelsNotFoundInSelfServeLabelIdentifiers.length != 0) {
      console.log(
        `verified labels could not be validated. ${labelsNotFoundInSelfServeLabelIdentifiers.length} identifiers could not be found in self serve label identifiers: ${labelsNotFoundInSelfServeLabelIdentifiers}`
      );
      return false;
    }

    console.log(
      `verified labels validated (${this.blueskyCommunityBot.options.verifiedLabels.length})`
    );
    return true;
  }

  async updateLabelPolicies(): Promise<boolean> {
    this.hasValidSelfServeLabels = false;

    // TODO: use one of the logged in bots in blueskyCommunityBot instead
    const agent = new AtpAgent({ service: "https://bsky.social" });

    try {
      await agent.login({
        identifier: this.blueskyCommunityBot.options.labelerBskyUsername,
        password: this.blueskyCommunityBot.options.labelerBskyAppPassword,
      });
    } catch (error) {
      return false;
    }

    try {
      const labelDefs = await agent.app.bsky.labeler.getServices({
        dids: [this.blueskyCommunityBot.labelerBot.profile.did],
        detailed: true,
      });
      this.labelerPolicies = labelDefs.data.views[0]
        .policies as LabelerPolicies;

      console.log("updated label defs");

      if (this.validateSelfServeLabels() && this.validateVerifiedLabels()) {
        this.hasValidSelfServeLabels = true;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  async updateLabelDefsRoute(req: Request, res: Response) {
    const result = await this.updateLabelPolicies();

    res.send({ result: result ? "success" : "failed" });
  }

  dataURItoBlob(dataURI: string) {
    // convert base64/URLEncoded data component to raw binary data held in a string
    var byteString;
    if (dataURI.split(",")[0].indexOf("base64") >= 0)
      byteString = atob(dataURI.split(",")[1]);
    else byteString = unescape(dataURI.split(",")[1]);

    // separate out the mime component
    var mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];

    // write the bytes of the string to a typed array
    var ia = new Uint8Array(byteString.length);
    for (var i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }

    return new Blob([ia], { type: mimeString });
  }

  async getLabelOptionsImagePayload(
    locales: string[]
  ): Promise<LabelOptionsImagePayload> {
    const payload: LabelOptionsImagePayload = {
      labelOptionsAltText: "",
      labelOptionsCanvas: new Canvas(1, 1),
      labelOptionsCanvasBlob: new Blob(),
    };

    const width = 1290;
    const marginVertical = 200;
    const marginHorizontal = 50;
    const innerMarginVertical = 10;
    const innerMarginHorizontal = 10;

    payload.labelOptionsAltText = `image with a title: ${this.blueskyCommunityBot.labelerBot.profile.displayName}.\nbeneath the title is a list of numbered options:`;

    if (this.labelerPolicies.labelValueDefinitions) {
      const font = await opentype.load("./fonts/InterVariable.ttf");

      const rows = Math.round(
        this.blueskyCommunityBot.options.selfServeLabelIdentifiers.length / 2
      );

      const rowHeight = 60;
      const height = 281 + rowHeight * rows;

      payload.labelOptionsCanvas = new Canvas(width, height);
      const context = payload.labelOptionsCanvas.getContext("2d");

      // draw background

      context.fillStyle = "#161f28";
      context.fillRect(0, 0, width, height);

      // draw round rect

      const roundMarginHorizontal = 30;

      context.fillStyle = "#1d2935";
      context.roundRect(
        roundMarginHorizontal,
        marginVertical,
        width - roundMarginHorizontal * 2,
        rowHeight * rows + 25,
        12
      );
      context.fill();

      // draw label names

      for (
        let i = 0;
        i < this.labelerPolicies.labelValueDefinitions.length;
        i++
      ) {
        const label = this.labelerPolicies.labelValueDefinitions[i];
        if (
          this.blueskyCommunityBot.options.selfServeLabelIdentifiers.includes(
            label.identifier
          ) === false
        ) {
          continue;
        }

        const labelText =
          this.blueskyCommunityBot.options.verifiedLabels.includes(
            label.identifier
          )
            ? `${this.getLabelName(label.identifier, locales)}*`
            : this.getLabelName(label.identifier, locales);
        const labelName = `${i + 1}. ${labelText}`;

        payload.labelOptionsAltText = payload.labelOptionsAltText.concat(
          `\n${labelName}`
        );

        // const outerRect = {
        //   x:
        //     i % 2
        //       ? LabelCommand.labelOptionsCanvas.width / 2
        //       : 0 + marginHorizontal,
        //   y:
        //     i % 2
        //       ? marginVertical + ((i - 1) / 2) * rowHeight
        //       : marginVertical + (i / 2) * rowHeight,
        //   width: LabelCommand.labelOptionsCanvas.width / 2 - marginHorizontal,
        //   height: rowHeight,
        // };

        // drawText(context, "", font, outerRect, {
        //   minSize: 13,
        //   maxSize: 100,
        //   vAlign: "bottom",
        //   hAlign: "left",
        //   fitMethod: "baseline",
        //   textFillStyle: "#fff",
        //   drawRect: false,
        // });

        // inner rect
        const textRect = {
          x:
            i % 2
              ? payload.labelOptionsCanvas.width / 2 + innerMarginHorizontal
              : marginHorizontal + innerMarginHorizontal,
          y:
            i % 2
              ? marginVertical + innerMarginVertical + ((i - 1) / 2) * rowHeight
              : marginVertical + innerMarginVertical + (i / 2) * rowHeight,
          width:
            payload.labelOptionsCanvas.width / 2 -
            marginHorizontal -
            innerMarginHorizontal * 2,
          height: rowHeight - innerMarginVertical * 2,
        };

        drawText(context as any, labelName, font, textRect, {
          minSize: 13,
          maxSize: 32,
          vAlign: "bottom",
          hAlign: "left",
          fitMethod: "baseline",
          textFillStyle: "#fff",
          drawRect: false,
        });
      }

      const logoRadius = 70;

      // draw labeler display name

      const displayName = this.blueskyCommunityBot.labelerBot.profile
        .displayName
        ? this.blueskyCommunityBot.labelerBot.profile.displayName
        : "";

      const titleFont = await opentype.load("./fonts/Inter-Black.ttf");

      drawText(
        context as any,
        displayName,
        titleFont,
        {
          x: marginHorizontal * 1.5 + logoRadius * 2,
          y: marginVertical / 2 - logoRadius,
          width:
            width - marginHorizontal - (marginHorizontal * 2 + logoRadius * 2),
          height: logoRadius * 2,
        },
        {
          minSize: 13,
          maxSize: 66,
          vAlign: "center",
          hAlign: "left",
          fitMethod: "box",
          textFillStyle: "#fff",
          drawRect: false,
        }
      );

      // draw labeler avatar

      const circle = {
        x: logoRadius + marginHorizontal,
        y: marginVertical / 2,
        radius: 70,
      };

      context.beginPath();
      context.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2, true);
      context.closePath();
      context.clip();

      const avatar = await loadImage(
        this.blueskyCommunityBot.labelerBot.profile.avatar as string
      );

      const aspectRatio = avatar.height / avatar.width;
      const hsx = circle.radius * Math.max(1.0 / aspectRatio, 1.0);
      const hsy = circle.radius * Math.max(aspectRatio, 1.0);
      context.drawImage(
        avatar,
        circle.x - hsx,
        circle.y - hsy,
        hsx * 2,
        hsy * 2
      );
    }

    payload.labelOptionsCanvasBlob = this.dataURItoBlob(
      payload.labelOptionsCanvas.toDataURL()
    );

    console.log(`generated label options image for locales: ${locales}`);

    return payload;
  }

  async getLabelImageRoute(req: Request, res: Response) {
    const imageOptionsPayload = await this.getLabelOptionsImagePayload(
      req.params["locale"] ? [req.params["locale"] as string] : []
    );
    res.type("png");
    res.end(imageOptionsPayload.labelOptionsCanvas.toBuffer("image/png"));
  }

  async getTargetSelfServeLabels(
    did: string
  ): Promise<ComAtprotoLabelDefs.Label[]> {
    const profile = await this.blueskyCommunityBot.labelerBot.agent
      .get("app.bsky.actor.getProfile", {
        params: { actor: did },
        headers: {
          "atproto-accept-labelers":
            this.blueskyCommunityBot.labelerBot.profile.did,
        },
      })
      .catch((e) => {
        throw new Error(`Failed to fetch profile ${did}.`, {
          cause: e,
        });
      });

    const selfServeLabels: ComAtprotoLabelDefs.Label[] = [];

    if (profile.data.labels) {
      for (let i = 0; i < profile.data.labels.length; i++) {
        const label = profile.data.labels[i];
        if (this.labelerPolicies.labelValues.includes(label.val)) {
          selfServeLabels.push(label);
        }
      }
    }

    return selfServeLabels;
  }

  getLabelIndex(labelIdentifier: string): number {
    if (this.labelerPolicies.labelValueDefinitions) {
      for (
        let i = 0;
        i < this.labelerPolicies.labelValueDefinitions?.length;
        i++
      ) {
        const labelDef = this.labelerPolicies.labelValueDefinitions[i];
        if (labelDef.identifier === labelIdentifier) {
          return i;
        }
      }
    }
    return -1;
  }

  get1BasedLabelIndex(labelIdentifier: string): number {
    const labelIndex = this.getLabelIndex(labelIdentifier);
    if (labelIndex != -1) {
      return labelIndex + 1;
    }
    return -1;
  }

  getLabelName(labelIdentifier: string, locales: string[]): string | undefined {
    const desiredLocales = locales.concat([
      this.blueskyCommunityBot.options.defaultLocale,
    ]);

    if (this.labelerPolicies.labelValueDefinitions) {
      for (
        let localeIndex = 0;
        localeIndex < desiredLocales.length;
        localeIndex++
      ) {
        const desiredLocale = desiredLocales[localeIndex];

        for (
          let i = 0;
          i < this.labelerPolicies.labelValueDefinitions?.length;
          i++
        ) {
          const labelDef = this.labelerPolicies.labelValueDefinitions[i];
          if (labelDef.identifier === labelIdentifier) {
            for (let j = 0; j < labelDef.locales.length; j++) {
              const labelLocale = labelDef.locales[j];

              if (
                labelLocale.lang.toLowerCase() === desiredLocale.toLowerCase()
              ) {
                return labelLocale.name;
              }
            }
          }
        }
      }
    }

    return undefined;
  }

  getLabelNames(
    labelIdentifiers: string[],
    locales: string[]
  ): (string | undefined)[] {
    const labelNames: (string | undefined)[] = [];

    for (let i = 0; i < labelIdentifiers.length; i++) {
      labelNames.push(this.getLabelName(labelIdentifiers[i], locales));
    }

    return labelNames;
  }
}
