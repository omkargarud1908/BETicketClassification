import { classifyTicket } from '../Services/ticketClassificationService.js'

export async function handleTicketClassification(requestBody) {
  return classifyTicket(requestBody)
}
