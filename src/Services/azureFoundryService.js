function buildAzureUrl() {
  const endpoint = process.env.AZURE_FOUNDRY_ENDPOINT?.replace(/\/$/, '')
  const deployment = process.env.AZURE_FOUNDRY_DEPLOYMENT
  const apiVersion = process.env.AZURE_FOUNDRY_API_VERSION || '2024-02-15-preview'

  if (!endpoint) {
    throw new Error('AZURE_FOUNDRY_ENDPOINT is not configured.')
  }

  if (deployment) {
    return `${endpoint}/openai/deployments/${encodeURIComponent(
      deployment,
    )}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`
  }

  return `${endpoint}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`
}

export async function callAzureFoundry(messages, options = {}) {
  const apiKey = process.env.AZURE_FOUNDRY_API_KEY

  if (!apiKey) {
    throw new Error('AZURE_FOUNDRY_API_KEY is not configured.')
  }

  const response = await fetch(buildAzureUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 600,
      ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  })

  const text = await response.text()

  if (!response.ok) {
    throw new Error(`Azure Foundry API failed (${response.status}): ${text}`)
  }

  return JSON.parse(text)
}

export function parseModelContent(result) {
  const content = result?.choices?.[0]?.message?.content

  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Azure Foundry response did not include assistant content.')
  }

  return content.trim()
}
