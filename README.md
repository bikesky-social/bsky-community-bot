# Bluesky Community Bot

A Typescript package that allows people to send commands to an account on Bluesky by mentioning the account in a post. The package allows the account to perform actions, keep track of conversation status and respond to the account that is making the request of the bot.

## Commands

The package supports the following commands:

### listcommands

The listcommands command lists all of the commands that the bot will respond to.

### label

The label command enables the user to apply Bluesky labels to their account. It responds by offering them a selection of labels in a post that contains an image that is generated using the labeler account's label definitions. The user then selects labels by responding with numbers. The labels that a user can select are determined by configuration settings. The bot can enforce a maximum number of labels if you want to. And the bot also supports offering labels that require extra verification, which it will provide instructions for instead of applying the labels.

### unlabel

The unlabel command enables the user to remove Bluesky labels from their account which they applied using the label command.

## Internationalization

Bluesky Community Bot supports internationalization for all of its responses and any references it makes to labels. It will attempt to respond to users in the language they use to speak to it. Currently we have translations for English. We'll be adding more translations soon and would welcome any contributions for this in the [locales folder](https://github.com/bikesky-social/bsky-community-bot/tree/main/locales).

## Configuration as a Web Service

This repo can be deployed as a web service. When deploying as a web service, it is configured using environment variables. The expected environment variables are:

```sh
# the username of the bluesky labeler's account
LABELER_BSKY_USERNAME="<labeler's username>"

# an app password for the bluesky labeler's account
LABELER_BSKY_APP_PASSWORD="<labeler's app password>"

# the default locale to use for label names and reply text
DEFAULT_LOCALE="en"

# the port for the server to listen on
PORT=3000

# the maximum length of a post
MAX_POST_LENGTH=300

# the maximum number of labels to allow people to add to their account
# set this to -1 for unlimited labels
MAX_LABELS=3

# a comma-separated list of identifiers of labels that the bot will offer to apply
SELF_SERVE_LABEL_IDENTIFIERS=label-1,label-2,label-3,label-4

# a comma-separated list of identifiers that the bot will 
# each of these labels should also be in SELF_SERVE_LABEL_IDENTIFIERS
VERIFIED_LABELS=label-3,label-4

# an email address that the bot will tell people to contact if they ask for a verified label
LABEL_VERIFICATION_EMAIL="<an email address to refer people to in order to manually verify a label>"
```

## Deploying

### Render

The easiest way to deploy this service is to use the "Deploy to Render" button below. Using this button will create a new service on Render which you can configure. It will run on Render's Free service tier.

<a href="https://render.com/deploy?repo=https://github.com/bikesky-social/bsky-community-bot">
<img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render" />
</a>

### Docker

This service is available on Docker Hub at [bikesky/bsky-community-bot](https://hub.docker.com/r/bikesky/bsky-community-bot). You can run it with the following command:

```sh
docker run -p 3000:3000 --env-file .env bikesky/bsky-community-bot
```

## Development

To install dependencies:

```bash
bun install
```

To run:

```bash
bun src/main.ts
```

This project was created using `bun init` in bun v1.2.4. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

## References

Bluesky Community Bot is built using the following 






