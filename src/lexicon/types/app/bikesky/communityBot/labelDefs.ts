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
const id = 'app.bikesky.communityBot.labelDefs'

export interface LabelPrompt {
  $type?: 'app.bikesky.communityBot.labelDefs#labelPrompt'
  /** A list of label identifiers that are being offered to the actor that executed the command. */
  labelIdentifiers: string[]
  /** A list of label identifiers that are being offered to the actor that executed the command which require additional verification. */
  verifiedLabelIdentifiers?: string[]
}

const hashLabelPrompt = 'labelPrompt'

export function isLabelPrompt<V>(v: V) {
  return is$typed(v, id, hashLabelPrompt)
}

export function validateLabelPrompt<V>(v: V) {
  return validate<LabelPrompt & V>(v, id, hashLabelPrompt)
}
