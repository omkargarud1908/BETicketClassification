function trimTrailingSlash(value) {
  return value?.replace(/\/$/, '')
}

function appendApiVersion(url, apiVersion) {
  if (!apiVersion) return url

  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}api-version=${encodeURIComponent(apiVersion)}`
}

function isResponsesEndpoint(endpoint) {
  return /\/responses(?:\?|$)/.test(endpoint) || /\/openai\/v1(?:\/)?$/.test(endpoint)
}

function isAgentEndpoint(endpoint) {
  return /\/api\/projects\/[^/]+\/agents\//.test(endpoint)
}

function buildChatCompletionsUrl() {
  const endpoint = trimTrailingSlash(process.env.AZURE_FOUNDRY_ENDPOINT)
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

function buildResponsesUrl() {
  const endpoint = trimTrailingSlash(
    process.env.AZURE_FOUNDRY_AGENT_RESPONSES_ENDPOINT ||
      process.env.AZURE_FOUNDRY_AGENT_ENDPOINT ||
      process.env.AZURE_FOUNDRY_ENDPOINT,
  )
  const apiVersion = process.env.AZURE_FOUNDRY_AGENT_API_VERSION

  if (!endpoint) {
    throw new Error('AZURE_FOUNDRY_AGENT_RESPONSES_ENDPOINT is not configured.')
  }

  if (endpoint.endsWith('/responses')) {
    return appendApiVersion(endpoint, apiVersion)
  }

  if (endpoint.endsWith('/openai/v1')) {
    return appendApiVersion(`${endpoint}/responses`, apiVersion)
  }

  return appendApiVersion(endpoint, apiVersion)
}

function buildHostedResponsesFallbackUrl(url) {
  return url.replace('/protocols/openai/v1/responses', '/endpoint/protocols/openai/responses')
}

function canTryHostedResponsesFallback(url) {
  return url.includes('/agents/') && url.includes('/protocols/openai/v1/responses')
}

function buildHeaders(url) {
  const apiKey = process.env.AZURE_FOUNDRY_API_KEY
  const bearerToken =
    process.env.AZURE_FOUNDRY_BEARER_TOKEN || process.env.AZURE_FOUNDRY_ACCESS_TOKEN
  const headers = {
    'Content-Type': 'application/json',
  }

  if (isAgentEndpoint(url)) {
    if (!bearerToken) {
      throw new Error(
        'AZURE_FOUNDRY_BEARER_TOKEN is required for Foundry agent endpoints.',
      )
    }

    headers.Authorization = `Bearer ${bearerToken}`
    headers['Foundry-Features'] =
      process.env.AZURE_FOUNDRY_FEATURES ||
      (url.includes('/endpoint/protocols/')
        ? 'HostedAgents=V1Preview'
        : 'AgentEndpoints=V1Preview')
    return headers
  }

  if (!apiKey && !bearerToken) {
    throw new Error('AZURE_FOUNDRY_API_KEY or AZURE_FOUNDRY_BEARER_TOKEN is not configured.')
  }

  if (apiKey) headers['api-key'] = apiKey
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`

  return headers
}

function splitMessages(messages) {
  const instructions = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n')
  const input = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role,
      content: String(message.content || ''),
    }))

  return { instructions, input }
}

function buildResponsesBody(messages, options, url) {
  const { instructions, input } = splitMessages(messages)
  const model =
    process.env.AZURE_FOUNDRY_AGENT_MODEL ||
    process.env.AZURE_FOUNDRY_DEPLOYMENT ||
    process.env.AZURE_FOUNDRY_MODEL
  const isAgentRequest = isAgentEndpoint(url)

  return {
    input,
    stream: false,
    max_output_tokens: options.maxTokens ?? 600,
    ...(isAgentRequest ? {} : { temperature: options.temperature ?? 0.2 }),
    ...(instructions && !isAgentRequest ? { instructions } : {}),
    ...(model && !isAgentRequest ? { model } : {}),
    ...(options.jsonMode ? { text: { format: { type: 'json_object' } } } : {}),
  }
}

async function postJson(url, body) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(url),
      body: JSON.stringify(body),
    })
    const text = await response.text()

    return { response, text }
  } catch (error) {
    const details = [
      error instanceof Error ? error.message : 'Unknown fetch error',
      error?.cause?.code ? `code=${error.cause.code}` : '',
      error?.cause?.hostname ? `host=${error.cause.hostname}` : '',
      error?.cause?.syscall ? `syscall=${error.cause.syscall}` : '',
    ]
      .filter(Boolean)
      .join(', ')

    throw new Error(`Unable to reach Azure Foundry at ${url}: ${details}`)
  }
}

export async function callAzureFoundry(messages, options = {}) {
  const endpoint = trimTrailingSlash(process.env.AZURE_FOUNDRY_ENDPOINT || '')
  const url = isResponsesEndpoint(endpoint) ? buildResponsesUrl() : buildChatCompletionsUrl()

  const { response, text } = await postJson(url, {
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 600,
    ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
  })

  if (!response.ok) {
    throw new Error(`Azure Foundry API failed (${response.status}): ${text}`)
  }

  return JSON.parse(text)
}

export async function callAzureFoundryResponses(messages, options = {}) {
  const url = buildResponsesUrl()
  let requestUrl = url
  let body = buildResponsesBody(messages, options, url)

  let { response, text } = await postJson(url, body)

  if (response.status === 404 && canTryHostedResponsesFallback(url)) {
    const fallbackUrl = buildHostedResponsesFallbackUrl(url)
    requestUrl = fallbackUrl
    body = buildResponsesBody(messages, options, fallbackUrl)

    ;({ response, text } = await postJson(fallbackUrl, body))
  }

  if (!response.ok) {
    throw new Error(`Azure Foundry Responses API failed (${response.status}) at ${requestUrl}: ${text}`)
  }

  return JSON.parse(text)
}

export function parseModelContent(result) {
  const content =
    result?.output_text ||
    result?.choices?.[0]?.message?.content ||
    result?.output
      ?.flatMap((item) => item?.content || [])
      .map((item) => item?.text || item?.content?.[0]?.text)
      .filter(Boolean)
      .join('\n')

  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Azure Foundry response did not include assistant content.')
  }

  return content.trim()
}
