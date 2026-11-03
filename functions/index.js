import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { defineSecret, defineString } from 'firebase-functions/params'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { checkCategories, cleanReading, IMAGE_TYPES, instructions, MAX_IMAGE_CHARS, MODEL, ReceiptSchema } from './receipt.js'

/** The Anthropic API key, kept in Google Cloud Secret Manager (never in the app or the repo). */
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY')
/** Firebase user ids allowed to use it, comma separated (functions/.env). Anyone else is turned away. */
const OWNER_UIDS = defineString('OWNER_UIDS')

/**
 * Reads a receipt photo with Claude for the expense form. Called by the signed-in owner from the
 * app; returns the total, date, shop, SST, category and items, each left out when not readable.
 */
export const readReceipt = onCall(
  { region: 'asia-southeast1', secrets: [ANTHROPIC_API_KEY], memory: '512MiB', timeoutSeconds: 60, maxInstances: 2 },
  async (request) => {
    const owners = OWNER_UIDS.value()
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!request.auth || !owners.includes(request.auth.uid)) throw new HttpsError('permission-denied', 'Not allowed.')

    const { image, mediaType } = request.data ?? {}
    const categories = checkCategories(request.data?.categories)
    if (typeof image !== 'string' || !image || image.length > MAX_IMAGE_CHARS || !IMAGE_TYPES.includes(mediaType)) {
      throw new HttpsError('invalid-argument', 'Send one JPEG, PNG or WebP photo under 3 MB.')
    }

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() })
    let response
    try {
      response = await client.messages.parse({
        model: MODEL,
        max_tokens: 4000,
        output_config: { effort: 'low', format: zodOutputFormat(ReceiptSchema) },
        system: instructions(categories),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
              { type: 'text', text: 'Read this receipt.' },
            ],
          },
        ],
      })
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) throw new HttpsError('resource-exhausted', 'Too many receipts at once. Try again in a minute.')
      if (e instanceof Anthropic.APIError) {
        console.error('Anthropic API error', e.status, e.message)
        throw new HttpsError('unavailable', 'The receipt reader is not available right now.')
      }
      throw e
    }

    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens' || !response.parsed_output) {
      console.warn('No reading', response.stop_reason)
      throw new HttpsError('failed-precondition', "Couldn't read this receipt.")
    }
    return cleanReading(response.parsed_output, categories)
  },
)
