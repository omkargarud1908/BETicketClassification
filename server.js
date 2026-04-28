import { createServer } from 'node:http'
import { loadLocalEnv } from './src/Services/envService.js'
import { routeRequest } from './src/Routes/apiRoutes.js'

loadLocalEnv()

const port = Number(process.env.PORT || 4000)

const server = createServer(routeRequest)

server.listen(port, () => {
  console.log(`Ticket classification API running at http://localhost:${port}`)
})
