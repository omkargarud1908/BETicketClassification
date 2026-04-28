import { URL } from 'node:url'
import { handleChat } from '../Controllers/chatBotController.js'
import { handleApiInfo, handleHealth } from '../Controllers/healthController.js'
import { handleTicketClassification } from '../Controllers/ticketClassificationController.js'

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Content-Type': 'application/json',
  })
  response.end(JSON.stringify(payload))
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''

    request.on('data', (chunk) => {
      body += chunk

      if (body.length > 1_000_000) {
        reject(new Error('Request body is too large.'))
        request.destroy()
      }
    })

    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('Request body must be valid JSON.'))
      }
    })

    request.on('error', reject)
  })
}

export async function routeRequest(request, response) {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {})
    return
  }

  const url = new URL(request.url || '/', `http://${request.headers.host}`)

  try {
    if (request.method === 'GET' && url.pathname === '/') {
      const result = handleApiInfo()
      sendJson(response, result.status, result.payload)
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/health') {
      const result = handleHealth()
      sendJson(response, result.status, result.payload)
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/classify-ticket') {
      const result = await handleTicketClassification(await readBody(request))
      sendJson(response, result.status, result.payload)
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/chat') {
      const result = await handleChat(await readBody(request))
      sendJson(response, result.status, result.payload)
      return
    }

    sendJson(response, 404, { error: 'Route not found.' })
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Unexpected server error.',
    })
  }
}
