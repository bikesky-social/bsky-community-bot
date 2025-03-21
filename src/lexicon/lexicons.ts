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
  AppBikeskyCommunityBotCommandState: 'app.bikesky.communityBot.commandState',
} as const
