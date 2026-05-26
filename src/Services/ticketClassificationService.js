import { callGoogleGemini, parseModelContent } from './googleGeminiService.js'

const classificationSystemPrompt = `You classify IT support tickets.
Return only JSON with these fields:
category: one of Hardware, Software, Network, Access, Security, Billing, Other
priority: one of Low, Medium, High, Critical
team: short routing team name
summary: one sentence
reasoning: one sentence explaining the classification
confidence: number from 0 to 1`

export async function classifyTicket(payload) {
  const { title, description, requester, product } = payload

  if (!description || typeof description !== 'string') {
    return { status: 400, payload: { error: 'Ticket description is required.' } }
  }

  const ticketText = [
    `Title: ${title || 'Not provided'}`,
    `Requester: ${requester || 'Not provided'}`,
    `Product or service: ${product || 'Not provided'}`,
    `Description: ${description}`,
  ].join('\n')

  const result = await callGoogleGemini(
    [
      { role: 'system', content: classificationSystemPrompt },
      { role: 'user', content: ticketText },
    ],
    { jsonMode: true, maxTokens: 500 },
  )

  const content = parseModelContent(result)

  try {
    return { status: 200, payload: { classification: JSON.parse(content) } }
  } catch {
    return { status: 200, payload: { classification: { raw: content } } }
  }
}
