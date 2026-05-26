const defaultModel = 'gemini-2.5-flash'

function buildGeminiUrl() {
  const model = process.env.GOOGLE_GEMINI_MODEL || process.env.GEMINI_MODEL || defaultModel

  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent`
}

function getApiKey() {
  return process.env.GEMINI_API_KEY
}

function toGeminiRequest(messages, options = {}) {
  const systemMessages = []
  const contents = []

  for (const message of messages) {
    const text = String(message?.content || '').trim()
    if (!text) continue

    if (message.role === 'system') {
      systemMessages.push(text)
      continue
    }

    contents.push({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text }],
    })
  }

  return {
    contents,
    ...(systemMessages.length
      ? { systemInstruction: { parts: [{ text: systemMessages.join('\n\n') }] } }
      : {}),
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxTokens ?? 600,
      ...(options.jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  }
}

export async function callGoogleGemini(messages, options = {}) {
  const apiKey = getApiKey()

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.')
  }

  let response

  try {
    response = await fetch(buildGeminiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(toGeminiRequest(messages, options)),
    })
  } catch (error) {
    const cause = error instanceof Error ? error.cause || error : undefined
    const detail = cause?.code || cause?.message || error?.message || 'unknown network error'

    throw new Error(`Could not connect to Google Gemini API: ${detail}`)
  }

  const text = await response.text()

  if (!response.ok) {
    throw new Error(`Google Gemini API failed (${response.status}): ${text}`)
  }

  return JSON.parse(text)
}

export function parseModelContent(result) {
  const content = result?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim()

  if (!content) {
    throw new Error('Google Gemini response did not include model content.')
  }

  return content
}
