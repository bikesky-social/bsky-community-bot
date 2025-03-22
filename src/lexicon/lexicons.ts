/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  type LexiconDoc,
  Lexicons,
  ValidationError,
  type ValidationResult,
} from '@atproto/lexicon'
import { type $Typed, is$typed, maybe$typed } from './util.js'

export const schemaDict = {
  AppBikeskyCommunityBotCommandPrompt: {
    lexicon: 1,
    id: 'app.bikesky.communityBot.commandPrompt',
    defs: {
      main: {
        type: 'record',
        key: 'tid',
        description:
          "Record describing a command prompt associated with a post which can be replied to in order to advance the command. The commandPrompt record's record key (rkey) must match the record key of the post that it belongs to.",
        record: {
          type: 'object',
          required: ['post', 'command', 'prompt'],
          properties: {
            post: {
              type: 'string',
              format: 'at-uri',
              description: 'Reference (AT-URI) to the post record.',
            },
            allow: {
              type: 'array',
              description:
                'List of rules defining who can respond to the prompt. If value is an empty array, no one can respond. If value is undefined, anyone can respond.',
              items: {
                type: 'union',
                refs: [
                  'lex:app.bikesky.communityBot.commandPrompt#didListRule',
                ],
              },
            },
            command: {
              type: 'string',
              description:
                'A token that indicates which command should handle the response to the prompt.',
            },
            prompt: {
              type: 'union',
              description:
                'An object that stores data that the prompt needs when an actor responds to it.',
              refs: [
                'lex:app.bikesky.communityBot.labelPrompts#labelPrompt',
                'lex:app.bikesky.communityBot.unlabelPrompts#unlabelOffer',
              ],
            },
          },
        },
      },
      didListRule: {
        type: 'object',
        description:
          'Allow a list of actors to respond to the prompt, indicated by a list of dids.',
        required: ['list'],
        properties: {
          list: {
            type: 'array',
            items: {
              type: 'string',
              format: 'did',
            },
          },
        },
      },
    },
  },
  AppBikeskyCommunityBotCommandState: {
    lexicon: 1,
    id: 'app.bikesky.communityBot.commandState',
    description: 'describes a command in progress and its state',
    defs: {
      main: {
        type: 'record',
        key: 'any',
        record: {
          type: 'object',
          required: ['command', 'authorDid', 'state'],
          properties: {
            command: {
              type: 'string',
              minLength: 1,
            },
            authorDid: {
              type: 'string',
              minLength: 1,
            },
            state: {
              type: 'integer',
            },
          },
        },
      },
    },
  },
  AppBikeskyCommunityBotLabelDefs: {
    lexicon: 1,
    id: 'app.bikesky.communityBot.labelDefs',
    description: 'Command prompts for the label command.',
    defs: {
      labelPrompt: {
        type: 'object',
        required: ['labelIdentifiers'],
        properties: {
          labelIdentifiers: {
            type: 'array',
            description:
              'A list of label identifiers that are being offered to the actor that executed the command.',
            items: {
              type: 'string',
            },
          },
          verifiedLabelIdentifiers: {
            type: 'array',
            description:
              'A list of label identifiers that are being offered to the actor that executed the command which require additional verification.',
            items: {
              type: 'string',
            },
          },
        },
      },
    },
  },
  AppBikeskyCommunityBotUnlabelDefs: {
    lexicon: 1,
    id: 'app.bikesky.communityBot.unlabelDefs',
    description: 'Command prompts for the unlabel command.',
    defs: {
      unlabelPrompt: {
        type: 'object',
        required: ['labelIdentifiers'],
        properties: {
          labelIdentifiers: {
            type: 'array',
            description:
              'A list of identifiers for labels that appear on the actor that executed the command.',
            items: {
              type: 'string',
            },
          },
        },
      },
    },
  },
} as const satisfies Record<string, LexiconDoc>
export const schemas = Object.values(schemaDict) satisfies LexiconDoc[]
export const lexicons: Lexicons = new Lexicons(schemas)

export function validate<T extends { $type: string }>(
  v: unknown,
  id: string,
  hash: string,
  requiredType: true,
): ValidationResult<T>
export function validate<T extends { $type?: string }>(
  v: unknown,
  id: string,
  hash: string,
  requiredType?: false,
): ValidationResult<T>
export function validate(
  v: unknown,
  id: string,
  hash: string,
  requiredType?: boolean,
): ValidationResult {
  return (requiredType ? is$typed : maybe$typed)(v, id, hash)
    ? lexicons.validate(`${id}#${hash}`, v)
    : {
        success: false,
        error: new ValidationError(
          `Must be an object with "${hash === 'main' ? id : `${id}#${hash}`}" $type property`,
        ),
      }
}

export const ids = {
  AppBikeskyCommunityBotCommandPrompt: 'app.bikesky.communityBot.commandPrompt',
  AppBikeskyCommunityBotCommandState: 'app.bikesky.communityBot.commandState',
  AppBikeskyCommunityBotLabelDefs: 'app.bikesky.communityBot.labelDefs',
  AppBikeskyCommunityBotUnlabelDefs: 'app.bikesky.communityBot.unlabelDefs',
} as const
