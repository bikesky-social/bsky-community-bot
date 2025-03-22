/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'
import type * as AppBikeskyCommunityBotLabelPrompts from './labelPrompts.js'
import type * as AppBikeskyCommunityBotUnlabelPrompts from './unlabelPrompts.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bikesky.communityBot.commandPrompt'

export interface Record {
  $type: 'app.bikesky.communityBot.commandPrompt'
  /** Reference (AT-URI) to the post record. */
  post: string
  /** List of rules defining who can respond to the prompt. If value is an empty array, no one can respond. If value is undefined, anyone can respond. */
  allow?: ($Typed<DidListRule> | { $type: string })[]
  /** A token that indicates which command should handle the response to the prompt. */
  command: string
  prompt:
    | $Typed<AppBikeskyCommunityBotLabelPrompts.LabelPrompt>
    | $Typed<AppBikeskyCommunityBotUnlabelPrompts.UnlabelOffer>
    | { $type: string }
  [k: string]: unknown
}

const hashRecord = 'main'

export function isRecord<V>(v: V) {
  return is$typed(v, id, hashRecord)
}

export function validateRecord<V>(v: V) {
  return validate<Record & V>(v, id, hashRecord, true)
}

/** Allow a list of actors to respond to the prompt, indicated by a list of dids. */
export interface DidListRule {
  $type?: 'app.bikesky.communityBot.commandPrompt#didListRule'
  list: string[]
}

const hashDidListRule = 'didListRule'

export function isDidListRule<V>(v: V) {
  return is$typed(v, id, hashDidListRule)
}

export function validateDidListRule<V>(v: V) {
  return validate<DidListRule & V>(v, id, hashDidListRule)
}
