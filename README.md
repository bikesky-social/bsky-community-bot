# Bluesky Community Bot

A Typescript package that allows people to send commands to an account on Bluesky by mentioning the account in a post. The package allows the account to perform actions, keep track of conversation status and respond to the account that is making the request of the bot.

## Commands

Commands are sent to the bot by making a post on Bluesky that mentions the account followed by a command name. For example, you would send this post to run the label command:

```bash
@labeler.bikesky.social label
```

The package supports the following commands:

|Command|Description|
|:---|:---|
|listcommands|The listcommands command lists all of the commands that the bot will respond to.|
|label|The label command enables the user to apply Bluesky labels to their account. It responds by offering them a selection of labels in a post that contains an image that is generated using the labeler account's label definitions. The user then selects labels by responding with numbers. The labels that a user can select are determined by configuration settings. The bot can enforce a maximum number of labels if you want to. And the bot also supports offering labels that require extra verification, which it will provide instructions for instead of applying the labels.|
|unlabel|The unlabel command enables the user to remove Bluesky labels from their account which they applied using the label command.|

## Internationalization

Bluesky Community Bot supports internationalization for all of its responses and any references it makes to labels. It will attempt to respond to users in the language they use to speak to it. Currently we have translations for English. We'll be adding more translations soon and would welcome any contributions for this in the [locales folder](https://github.com/bikesky-social/bsky-community-bot/tree/main/locales).

## Configuration as a Web Service

This repo can be deployed as a web service. When deploying, it is configured using environment variables. The expected environment variables are:

```env
# the username of the bluesky labeler's account (required)
LABELER_BSKY_USERNAME=replace_with_username

# an app password for the bluesky labeler's account (required)
LABELER_BSKY_APP_PASSWORD=replace_with_password

# the default locale to use for label names and reply text (required)
DEFAULT_LOCALE=en

# the port for the server to listen on (required)
PORT=3000

# the maximum length of a post (required)
MAX_POST_LENGTH=300

# the maximum number of labels to allow people to add to their account (required)
# set this to -1 for unlimited labels
MAX_LABELS=3

# the number of columns to display on the label image (required)
LABEL_DISPLAY_COLUMNS=2

# a JSON formatted array that lists the identifiers of the labels that the bot will offer (required)
# the labels are listed in category objects that will define how they are grouped on the image that is displayed when the bot prompts to pick a label
# category objects can be named with localized values and optionally show a notice that says labels in that category require manual verification
SELF_SERVE_LABELS=[{"labels":[{"identifier":"label-1","verified":false},{"identifier":"label-2","verified":false},{"identifier":"label-3","verified":false},{"identifier":"label-4","verified":false}]},{"name":[{"lang":"en","value":"Verified Labels ✅"}],"showVerificationNote":true,"labels":[{"identifier":"label-5","verified":true},{"identifier":"label-6","verified":true}]}]

# an email address that the bot will tell people to contact if they ask for a verified label (required if any labels are set to verified:true)
LABEL_VERIFICATION_EMAIL=replace_with_email_address

# if true, the bot will link people who use the label command to a webpage where it hosts a list of labels (required)
# if false, the bot will reply to the label command with an image showing a list of labels
USE_LABEL_WEBPAGE=false

# the publicly accessible domain where your bot is hosted (required if USE_LABEL_WEBPAGE is true)
HOST_NAME=www.example.com
```

## Deploying

### Render

The easiest way to deploy this service is to use the "Deploy to Render" button below. Using this button will create a new service on Render which you can configure. It will run on Render's Free service tier.

<a href="https://render.com/deploy?repo=https://github.com/bikesky-social/bsky-community-bot">
<img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render" />
</a>

### Docker

This service is available on [Github Container Registry](https://github.com/bikesky-social/bsky-community-bot/pkgs/container/bsky-community-bot) and on [Docker Hub](https://hub.docker.com/r/bikesky/bsky-community-bot). You can run the container with the following command:

```bash
docker run -p 3000:3000 \
-e LABELER_BSKY_USERNAME=replace_with_username \
-e LABELER_BSKY_APP_PASSWORD=replace_with_password \
-e DEFAULT_LOCALE=en \
-e PORT=3000 \
-e MAX_POST_LENGTH=300 \
-e MAX_LABELS=3 \
-e LABEL_DISPLAY_COLUMNS=2 \
-e SELF_SERVE_LABELS=[{"labels":[{"identifier":"label-1","verified":false},{"identifier":"label-2","verified":false},{"identifier":"label-3","verified":false},{"identifier":"label-4","verified":false}]},{"name":[{"lang":"en","value":"Verified Labels ✅"}],"showVerificationNote":true,"labels":[{"identifier":"label-5","verified":true},{"identifier":"label-6","verified":true}]}] \
-e LABEL_VERIFICATION_EMAIL=replace_with_email_address \
-e USE_LABEL_WEBPAGE=false \
-e HOST_NAME=www.example.com \
bikesky/bsky-community-bot
```

## Package Use

You can install this package in your own project by using a package manager like npm:

```bash
npm install @bikesky/bsky-community-bot
```

Once the package is installed, create a BlueskyCommunityBot instance, add some commands to it, and run it like so:

```typescript
import { BlueskyCommunityBot } from "@bikesky/bsky-community-bot";
import { ListCommandsCommand } from "@bikesky/bsky-community-bot/commands/ListComands";
import { LabelCommand } from "@bikesky/bsky-community-bot/commands/Label";
import { UnlabelCommand } from "@bikesky/bsky-community-bot/commands/Unlabel";

const bot = new BlueskyCommunityBot({
  labelerBskyUsername: "<replace with username>",
  labelerBskyAppPassword: "<replace with app password>",
  defaultLocale: "en",
  port: 3000,
  maxPostLength: 300,
  maxLabels: 3,
  labelDisplayColumns:2,
  selfServeLabels: [
    {
      showVerificationNote: false,
      labels: [
        { identifier: "label-1", verified: false },
        { identifier: "label-2", verified: false },
        { identifier: "label-3", verified: false },
        { identifier: "label-4", verified: false },
      ],
    },
    {
      name: [{ lang: "en", value: "Verified Labels ✅" }],
      showVerificationNote: true,
      labels: [
        { identifier: "label-5", verified: true },
        { identifier: "label-6", verified: true },
      ],
    },
  ],
  labelVerificationEmail: "replace.this@example.com",
  useLabelWebpage: false,
  hostName: "www.example.com",
});

bot.addCommands([
  new ListCommandsCommand(bot),
  new LabelCommand(bot),
  new UnlabelCommand(bot),
]);

bot.go();
```

## Development

To work on this repo, install dependencies with a package manager such as bun:

```bash
bun install
```

And then run with this command:

```bash
bun main.ts
```
