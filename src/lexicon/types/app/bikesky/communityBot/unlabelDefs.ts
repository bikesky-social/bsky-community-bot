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

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bikesky.communityBot.unlabelDefs'

export interface UnlabelPrompt {
  $type?: 'app.bikesky.communityBot.unlabelDefs#unlabelPrompt'
  /** A list of identifiers for labels that appear on the actor that executed the command. */
  labelIdentifiers: string[]
}

const hashUnlabelPrompt = 'unlabelPrompt'

export function isUnlabelPrompt<V>(v: V) {
  return is$typed(v, id, hashUnlabelPrompt)
}

export function validateUnlabelPrompt<V>(v: V) {
  return validate<UnlabelPrompt & V>(v, id, hashUnlabelPrompt)
}
