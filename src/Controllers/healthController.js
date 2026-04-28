export function handleHealth() {
  return { status: 200, payload: { ok: true } }
}

export function handleApiInfo() {
  return {
    status: 200,
    payload: {
      name: 'Ticket Classification API',
      status: 'running',
      frontend: 'http://127.0.0.1:5173',
      endpoints: {
        health: 'GET /api/health',
        classifyTicket: 'POST /api/classify-ticket',
        chat: 'POST /api/chat',
      },
    },
  }
}
