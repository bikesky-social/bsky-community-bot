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
  readonly labelsRoute = "/labels";
  readonly labelsOgImageRoute = "/labels-ogimage";
  labelerPolicies: LabelerPolicies = {
    labelValues: [],
    labelValueDefinitions: [],
  };
  hasValidSelfServeLabels: boolean = false;
  labelOptionsImagePayloadCache: {
    [locale: string]: LabelOptionsImagePayload;
  } = {};
  labelsOgImagePayloadCache: {
    [locale: string]: LabelOptionsImagePayload;
  } = {};

  constructor(blueskyCommunityBot: BlueskyCommunityBot) {
    this.blueskyCommunityBot = blueskyCommunityBot;
  }

  async init() {
    this.blueskyCommunityBot.server.get(
      "/get-label-image",
      this.getLabelImageRoute.bind(this)
    );

    this.blueskyCommunityBot.server.get(
      this.labelsRoute,
      this.getLabelRoute.bind(this)
    );

    this.blueskyCommunityBot.server.get(
      this.labelsOgImageRoute,
      this.getLabelsOgImageRoute.bind(this)
    );

    this.blueskyCommunityBot.server.get(
      "/clear-cache",
      this.clearCaches.bind(this)
    );

    await this.updateLabelPolicies();
  }

  getSelfServeLabelIdentifiers() {
    return this.blueskyCommunityBot.options.selfServeLabels
      .map((category) => category.labels)
      .flat()
      .map((label) => label.identifier);
  }

  getVerifiedSelfServeLabelIdentifiers() {
    return this.blueskyCommunityBot.options.selfServeLabels
      .map((category) => category.labels)
      .flat()
      .filter((label) => label.verified === true)
      .map((label) => label.identifier);
  }

  getLabelsUrl(locale: string) {
    return (
      "https://" +
      this.blueskyCommunityBot.options.hostName +
      this.labelsRoute +
      "?locale=" +
      locale
    );
  }

  getLabelsOgImageUrl() {
    return (
      "https://" +
      this.blueskyCommunityBot.options.hostName +
      this.labelsOgImageRoute
    );
  }

  validateSelfServeLabels(): boolean {
    // ensure self serve labels are in label defs
    const labelsNotFoundInDefs = this.getSelfServeLabelIdentifiers().filter(
      (x) => !this.labelerPolicies.labelValues.includes(x)
    );

    if (labelsNotFoundInDefs.length === 0) {
      console.log(
        `self serve labels validated (${this.getSelfServeLabelIdentifiers().length})`
      );
      return true;
    }

    console.log(
      `self serve labels could not be validated. ${labelsNotFoundInDefs.length} identifiers not found in label defs: ${labelsNotFoundInDefs}`
    );
    return false;
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

        if (this.validateSelfServeLabels()) {
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

  clearCaches(req: Request, res: Response) {
    this.labelOptionsImagePayloadCache = {};
    this.labelsOgImagePayloadCache = {};
    console.log("caches cleared");
    res.json({ status: "done" });
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

  getCachedLabelsOgImagePayload(locales: string[]) {
    const key = this.getLabelOptionsImagePayloadCacheKey(locales);
    if (key in this.labelsOgImagePayloadCache) {
      return this.labelsOgImagePayloadCache[key];
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
      const selfServeLabelIdentifiers = this.getSelfServeLabelIdentifiers();
      for (let i = 0; i < selfServeLabelIdentifiers.length; i++) {
        const labelIdentifier = selfServeLabelIdentifiers[i];

        const labelText = this.getVerifiedSelfServeLabelIdentifiers().includes(
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

    return {
      labelerAvatarUrl: this.blueskyCommunityBot.labelerBot.profile.avatar,
      labelerDisplayName:
        this.blueskyCommunityBot.labelerBot.profile.displayName,
      selfServeLabels: this.getSelfServeLabelsForDisplay(locales),
      manualVerificationNotice: translate("webpage.manualVerificationNotice"),
      columns: this.blueskyCommunityBot.options.labelDisplayColumns,
      showOgImage: this.blueskyCommunityBot.options.useLabelWebpage,
      ogImageUrl: this.getLabelsOgImageUrl(),
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

  async getLabelsOgImagePayload(
    locales: string[]
  ): Promise<LabelOptionsImagePayload> {
    const cache = this.getCachedLabelsOgImagePayload(locales);
    if (cache) {
      return cache;
    }

    const browser = await chromium.launch();
    const page = await browser.newPage();

    let labelHtml = "";

    this.blueskyCommunityBot.server.render(
      "pages/labels-ogimage",
      {
        labelerAvatarUrl: this.blueskyCommunityBot.labelerBot.profile.avatar,
        labelerDisplayName:
          this.blueskyCommunityBot.labelerBot.profile.displayName,
      },
      (error, html) => {
        labelHtml = html;
      }
    );

    await page.setContent(labelHtml, { waitUntil: "load" });

    await page.setViewportSize({
      width: 1200,
      height: 630,
    });

    const buffer = await page.screenshot({
      type: "png",
      scale: "device",
    });
    await browser.close();

    const payload: LabelOptionsImagePayload = {
      imageBuffer: buffer,
      imageBlob: new Blob([buffer], { type: "image/png" }),
      imageDimensions: imageSize(buffer),
      altText: this.getLabelOptionsImageAltText(locales),
    };

    this.labelsOgImagePayloadCache[
      this.getLabelOptionsImagePayloadCacheKey(locales)
    ] = payload;

    console.log(`generated labels-ogimage for locales: ${locales}`);

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
    res.render("pages/labels", this.getLabelsRouteRenderOptions(locales));
  }

  async getLabelsOgImageRoute(req: Request, res: Response) {
    const imageOptionsPayload = await this.getLabelsOgImagePayload(
      req.query["locale"] ? [req.query["locale"] as string] : []
    );
    res.type("png");
    res.end(imageOptionsPayload.imageBuffer);
  }

  async getTargetLabels(did: string): Promise<ComAtprotoLabelDefs.Label[]> {
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

    return profile.data.labels ? profile.data.labels : [];
  }

  async getTargetSelfServeLabels(
    did: string
  ): Promise<ComAtprotoLabelDefs.Label[]> {
    const labels = await this.getTargetLabels(did);

    const selfServeLabels: ComAtprotoLabelDefs.Label[] = [];

    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      if (
        this.labelerPolicies.labelValues.includes(label.val) &&
        this.getSelfServeLabelIdentifiers().includes(label.val)
      ) {
        selfServeLabels.push(label);
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

  getSelfServeLabelsForDisplay(locales: string[]) {
    const desiredLocales = locales.concat([
      this.blueskyCommunityBot.options.defaultLocale,
    ]);

    const displayLabels: {}[] = [];

    this.blueskyCommunityBot.options.selfServeLabels.map((category) => {
      const newCategory = {
        name: "",
        showVerificationNote: category.showVerificationNote,
        labels: this.getLabelNames(
          category.labels.map((label) => label.identifier),
          locales
        ),
      };

      if (category.name) {
        const nameLocales = category.name.map((name) => name.lang);
        for (let i = 0; i < desiredLocales.length; i++) {
          const locale = desiredLocales[i];
          const localeIndex = nameLocales.indexOf(locale);
          if (localeIndex != -1) {
            newCategory.name = category.name[localeIndex].value;
            break;
          }
        }
      }

      displayLabels.push(newCategory);
    });

    return displayLabels;
  }
}
