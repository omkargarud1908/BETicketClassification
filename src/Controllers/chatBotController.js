import { answerChat } from '../Services/chatBotService.js'

export async function handleChat(requestBody) {
  return answerChat(requestBody)
}
