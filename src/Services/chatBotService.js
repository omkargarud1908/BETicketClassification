import { callAzureFoundryResponses, parseModelContent } from './azureFoundryService.js'

const chatSystemPrompt =
  `You are a SharePoint Support Assistant.
Help users navigate SharePoint, troubleshoot issues, and provide step-by-step guidance.
For procedural or how-to questions, use this format:
Details: one short overview sentence.
### Steps to Perform
1. **Action title:** Clear instruction.
2. **Action title:** Clear instruction.
If the user is reporting a SharePoint incident or access issue that cannot be solved through guidance, suggest creating a support ticket.`

export async function answerChat(payload) {
  const message = payload.message
  const history = Array.isArray(payload.history) ? payload.history.slice(-8) : []

  if (!message || typeof message !== 'string') {
    return { status: 400, payload: { error: 'Message is required.' } }
  }

  const safeHistory = history
    .filter((item) => item?.role === 'user' || item?.role === 'assistant')
    .map((item) => ({ role: item.role, content: String(item.content || '') }))

  const result = await callAzureFoundryResponses(
    [
      { role: 'system', content: chatSystemPrompt },
      ...safeHistory,
      { role: 'user', content: message },
    ],
    { temperature: 0.5, maxTokens: 700 },
  )

  return { status: 200, payload: { reply: parseModelContent(result) } }
}
