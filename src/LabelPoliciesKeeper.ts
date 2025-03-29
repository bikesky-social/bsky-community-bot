import { BlueskyCommunityBot } from "./BlueskyCommunityBot";
import type { Request, Response } from "express";
import { AtpAgent } from "@atproto/api";
import type { LabelerPolicies } from "@atproto/api/dist/client/types/app/bsky/labeler/defs";
import * as LabelerDefs from "@atproto/api/dist/client/types/app/bsky/labeler/defs";
import type { ComAtprotoLabelDefs } from "@atcute/client/lexicons";
import { chromium } from "playwright";
import { imageSize } from "image-size";
import type { ISizeCalculationResult } from "image-size/types/interface";

type LabelOptionsImagePayload = {
  imageBuffer: Buffer;
  imageBlob: Blob;
  imageDimensions: ISizeCalculationResult;
  altText: string;
};

export class LabelPoliciesKeeper {
  readonly blueskyCommunityBot: BlueskyCommunityBot;
  labelerPolicies: LabelerPolicies = {
    labelValues: [],
    labelValueDefinitions: [],
  };
  hasValidSelfServeLabels: boolean = false;
  labelOptionsImagePayloadCache: {
    [locale: string]: LabelOptionsImagePayload;
  } = {};

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

    this.blueskyCommunityBot.server.get(
      "/labels",
      this.getLabelRoute.bind(this)
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

      const view = labelDefs.data.views[0];

      if (LabelerDefs.isLabelerViewDetailed(view)) {
        this.labelerPolicies = view.policies as LabelerPolicies;

        this.labelOptionsImagePayloadCache = {};

        console.log("updated label defs");

        if (this.validateSelfServeLabels() && this.validateVerifiedLabels()) {
          this.hasValidSelfServeLabels = true;
        }

        return true;
      } else {
        console.log("returned labeler view was not detailed");
      }

      return false;
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

  getLabelOptionsImagePayloadCacheKey(locales: string[]) {
    return locales.join(",");
  }

  getCachedLabelOptionsImagePayload(locales: string[]) {
    const key = this.getLabelOptionsImagePayloadCacheKey(locales);
    if (key in this.labelOptionsImagePayloadCache) {
      return this.labelOptionsImagePayloadCache[key];
    }

    return undefined;
  }

  getLabelOptionsImageAltText(locales: string[]) {
    let altText = "";

    const translate = this.blueskyCommunityBot.getFixedT(locales, "label");
    altText = translate("post.labelsAltText", {
      labelerDisplayName:
        this.blueskyCommunityBot.labelerBot.profile.displayName,
    });

    if (this.labelerPolicies.labelValueDefinitions) {
      for (
        let i = 0;
        i < this.blueskyCommunityBot.options.selfServeLabelIdentifiers.length;
        i++
      ) {
        const labelIdentifier =
          this.blueskyCommunityBot.options.selfServeLabelIdentifiers[i];

        const labelText =
          this.blueskyCommunityBot.options.verifiedLabels.includes(
            labelIdentifier
          )
            ? `${this.getLabelName(labelIdentifier, locales)}*`
            : this.getLabelName(labelIdentifier, locales);
        const labelName = `${i + 1}. ${labelText}`;

        altText = altText.concat(`\n${labelName}`);
      }
    }

    return altText;
  }

  getLabelsRouteRenderOptions(locales: string[]) {
    const translate = this.blueskyCommunityBot.getFixedT(locales, "label");

    let difference =
      this.blueskyCommunityBot.options.selfServeLabelIdentifiers.filter(
        (x) => !this.blueskyCommunityBot.options.verifiedLabels.includes(x)
      );

    return {
      labelerAvatarUrl: this.blueskyCommunityBot.labelerBot.profile.avatar,
      labelerDisplayName:
        this.blueskyCommunityBot.labelerBot.profile.displayName,
      selfServeLabelNames: this.getLabelNames(difference, locales),
      selfServeVerifiedLabelNames: this.getLabelNames(
        this.blueskyCommunityBot.options.verifiedLabels,
        locales
      ),
      verifiedLabelsHeading: translate("webpage.verifiedLabelsHeading"),
      manualVerificationNotice: translate("webpage.manualVerificationNotice"),
      columns: this.blueskyCommunityBot.options.labelDisplayColumns,
    };
  }

  async getLabelOptionsImagePayload(
    locales: string[]
  ): Promise<LabelOptionsImagePayload> {
    const cache = this.getCachedLabelOptionsImagePayload(locales);
    if (cache) {
      return cache;
    }

    const renderOptions = this.getLabelsRouteRenderOptions(locales);

    const browser = await chromium.launch();
    const page = await browser.newPage({ deviceScaleFactor: 2 });

    let labelHtml = "";

    this.blueskyCommunityBot.server.render(
      "pages/labels",
      renderOptions,
      (error, html) => {
        labelHtml = html;
      }
    );

    await page.setContent(labelHtml, { waitUntil: "load" });

    const element = await page.getByTitle("labels");
    const boundingBox = await element?.boundingBox();
    console.log(`column width: ${boundingBox?.width}`);

    const width = boundingBox?.width ? boundingBox?.width : 0;

    await page.setViewportSize({
      width: Math.round(width + 25),
      height: 1,
    });

    const buffer = await page.screenshot({
      type: "png",
      scale: "device",
      fullPage: true,
    });
    await browser.close();

    const payload: LabelOptionsImagePayload = {
      imageBuffer: buffer,
      imageBlob: new Blob([buffer], { type: "image/png" }),
      imageDimensions: imageSize(buffer),
      altText: this.getLabelOptionsImageAltText(locales),
    };

    this.labelOptionsImagePayloadCache[
      this.getLabelOptionsImagePayloadCacheKey(locales)
    ] = payload;

    console.log(`generated label options image for locales: ${locales}`);

    return payload;
  }

  async getLabelImageRoute(req: Request, res: Response) {
    const imageOptionsPayload = await this.getLabelOptionsImagePayload(
      req.query["locale"] ? [req.query["locale"] as string] : []
    );
    res.type("png");
    res.end(imageOptionsPayload.imageBuffer);
  }

  async getLabelRoute(req: Request, res: Response) {
    const locales = req.query["locale"] ? [req.query["locale"] as string] : [];
    const translate = this.blueskyCommunityBot.getFixedT(locales, "label");

    let difference =
      this.blueskyCommunityBot.options.selfServeLabelIdentifiers.filter(
        (x) => !this.blueskyCommunityBot.options.verifiedLabels.includes(x)
      );

    res.render("pages/labels", this.getLabelsRouteRenderOptions(locales));
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
        if (
          this.labelerPolicies.labelValues.includes(label.val) &&
          this.blueskyCommunityBot.options.selfServeLabelIdentifiers.includes(
            label.val
          )
        ) {
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
