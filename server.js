const express = require('express')
const OpenTok = require('opentok')
const compression = require('compression')
const bodyParser = require('body-parser')

// Get configurations
const PORT = process.env.PORT || 8080

const OPENTOK_API_KEY = process.env.OPENTOK_API_KEY
if (!OPENTOK_API_KEY) {
  throw new Error('Provide OPENTOK_API_KEY environment variable')
}

const OPENTOK_API_SECRET = process.env.OPENTOK_API_SECRET
if (!OPENTOK_API_SECRET) {
  throw new Error('Provide OPENTOK_API_SECRET environment variable')
}

// Generate an OpenTok session. Will will use a single session only
const OT = new OpenTok(OPENTOK_API_KEY, OPENTOK_API_SECRET)

function createSession (mediaMode = 'routed') {
  return new Promise(function (resolve, reject) {
    OT.createSession({ mediaMode: mediaMode }, (err, session) => {
      if (err) {
        console.log('Error creating OpenTok session', err)
        return reject(err)
      }
      return resolve(session)
    })
  })
}

function createToken (sessionId, userId, userType = 'caller') {
  try {
    const token = OT.generateToken(sessionId, {
      role: 'publisher',
      data: JSON.stringify({ userId: userId, userType: userType }),
      expireTime: Math.round((Date.now() / 1000) + (60 * 60)) // 1 hour from now()
    })
    return Promise.resolve(token)
  } catch (e) {
    return Promise.reject(e)
  }
}

let callers = new Map()
let callerCount = 0
let agents = new Map()
let agentCount = 0
let pendingQueue = []

function Caller (sessionId, token) {
  this.sessionId = sessionId
  this.token = token
  this.callerId = (++callerCount).toString()
  this.onHold = false
  this.agentConnected = false
  this.connectedSince = new Date()
  this.onCallSince = null
  this.ready = false
  this.callerName = null
  this.callerReason = null
  this.audioVideo = null
  this.assignedAgent = null
}

Caller.prototype.status = function () {
  return {
    callerId: this.callerId,
    onHold: this.onHold,
    connectedSince: this.connectedSince,
    onCallSince: this.onCallSince,
    agentConnected: this.agentConnected,
    callerName: this.callerName,
    callerReason: this.callerReason,
    audioVideo: this.audioVideo
  }
}

Caller.prototype.startCall = function () {
  this.onCallSince = new Date()
  this.agentConnected = true
  OT.signal(this.sessionId, null, { type: 'agentConnected', data: JSON.stringify(this.status()) }, function (err) {
    if (err) {
      console.log(err)
    }
  })
}

Caller.prototype.hold = function () {
  this.onHold = true
  this.agentConnected = false
  OT.signal(this.sessionId, null, { type: 'hold', data: JSON.stringify(this.status()) }, function (err) {
    if (err) {
      console.log(err)
    }
  })
}

Caller.prototype.unhold = function () {
  this.onHold = false
  this.agentConnected = true
  OT.signal(this.sessionId, null, { type: 'unhold', data: JSON.stringify(this.status()) }, function (err) {
    if (err) {
      console.log(err)
    }
  })
}

function Agent (name) {
  this.agentid = (++agentCount).toString()
  this.name = name ? name.trim() : 'N/a'
  this.currentCallers = new Map()
  console.log('New Agent connected', this.agentid)
}

Agent.prototype.assignPending = function (limit = 1) {
  let c = pendingQueue.splice(0, limit)
  for (const i in c) {
    this.assignCaller(c[i])
  }
}

Agent.prototype.assignCaller = function (c) {
  c.assignedAgent = this.agentid
  this.currentCallers.set(c.callerId, c)
}

Agent.prototype.removeCaller = function (callerid) {
  this.currentCallers.delete(callerid)
  this.assignPending(1)
}

Agent.prototype.disconnect = function () {
  for (const c of this.currentCallers.values()) {
    c.agentConnected = null
    pendingQueue.push(c)
  }
  console.log('Agent disconnected', this.agentid)
  agents.delete(this.agentid)
}

Agent.prototype.activeCallers = function () {
  return Array.from(this.currentCallers.values()).filter(c => c.ready).map(c => c.status())
}

Agent.prototype.callerCount = function () {
  return this.currentCallers.size
}

function sortAgentsByCallerCount () {
  return Array.from(agents.values()).sort((a, b) => a.callerCount() - b.callerCount())
}

async function assignCaller (caller) {
  if (agents.size) {
    let agent = sortAgentsByCallerCount()[0]
    agent.assignCaller(caller)
    caller.assignedAgent = agent.agentid
    return agent.agentid
  }
  pendingQueue.push(caller)
  return null
}

async function removeCaller (callerid) {
  let c = callers.get(callerid)
  if (c) {
    if (agents.has(c.assignedAgent)) {
      let a = agents.get(c.assignedAgent)
      a.removeCaller(callerid)
    } else {
      // Attempt removing caller from pending queue if no agent was assigned
      for (const c in pendingQueue) {
        if (pendingQueue[c].callerid === callerid) {
          pendingQueue.splice(c, 1)
        }
      }
    }
    callers.delete(callerid)
  }
}

async function handleConnectionCreated (data) {
  let conndata = JSON.parse(data.connection.data)
  if (!conndata.userId && !conndata.userType) {
    return
  }
  if (conndata.userType === 'caller') {
    let c = callers.get(conndata.userId)
    if (!c) {
      return
    }
    c.ready = true
    console.log('Caller connected', conndata.userId)
  }
}

async function handleConnectionDestroyed (data) {
  let conndata = JSON.parse(data.connection.data)
  if (!conndata.userId && !conndata.userType) {
    return
  }
  if (conndata.userType === 'caller') {
    removeCaller(conndata.userId)
    console.log('Caller disconnected', conndata.userId)
  }
}

// Create expressJS app instance
const app = express()
app.use(compression())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// Mount the `./public` dir to web-root as static.
app.use('/', express.static('./public'))

app.post('/dial', (req, res, next) => {
  const c = new Caller()
  c.callerName = req.body.callerName
  c.callerReason = req.body.callerReason
  c.audioVideo = req.body.audioVideo
  assignCaller(c)
    .then(i => {
      c.assignedAgent = i
      return createSession()
    })
    .then(session => {
      c.sessionId = session.sessionId
      return createToken(session.sessionId, c.callerId, 'caller')
    })
    .then(token => {
      c.token = token
      callers.set(c.callerId, c)
      return res.status(200).json({
        callerId: c.callerId,
        apiKey: OPENTOK_API_KEY,
        caller: c
      })
    })
    .catch(next)
})

app.get('/call/:id/join', (req, res, next) => {
  const c = callers.get(req.params.id)
  if (!c) {
    const e = new Error(`Caller ID ${req.params.id} not found`)
    e.status = 404
    return next(e)
  }
  createToken(c.sessionId, 'Agent', 'agent')
    .then(token => {
      c.startCall()
      return res.status(200).json({
        apiKey: OPENTOK_API_KEY,
        sessionId: c.sessionId,
        token: token,
        caller: c.status()
      })
    })
    .catch(next)
})

app.get('/call/:id/hold', (req, res, next) => {
  const c = callers.get(req.params.id)
  if (!c) {
    const e = new Error(`Caller ID ${req.params.id} not found`)
    e.status = 404
    return next(e)
  }
  c.hold()
  return res.status(200).json({
    caller: c.status()
  })
})

app.get('/call/:id/unhold', (req, res, next) => {
  const c = callers.get(req.params.id)
  if (!c) {
    const e = new Error(`Caller ID ${req.params.id} not found`)
    e.status = 404
    return next(e)
  }
  createToken(c.sessionId, 'Agent', 'agent')
    .then(token => {
      c.unhold()
      return res.status(200).json({
        apiKey: OPENTOK_API_KEY,
        sessionId: c.sessionId,
        token: token,
        caller: c.status()
      })
    })
    .catch(next)
})

app.get('/call/:id/delete', (req, res, next) => {
  const c = callers.get(req.params.id)
  OT.signal(c.sessionId, null, { type: 'endCall', data: 'end' }, function (err) {
    if (err) {
      console.log(err)
    }
    removeCaller(req.params.id)
    res.status(200).json({
      deleted: req.params.id
    })
  })
})

app.get('/call/:id', (req, res, next) => {
  const c = callers.get(req.params.id)
  if (!c) {
    const e = new Error(`Caller ID ${req.params.id} not found`)
    e.status = 404
    return next(e)
  }
  res.status(200).json({
    caller: c.status()
  })
})

app.get('/agent/:id/callers', (req, res, next) => {
  const a = agents.get(req.params.id)
  if (!a) {
    const e = new Error(`Agent ID ${req.params.id} not found`)
    e.status = 404
    return next(e)
  }
  if (a.callerCount() < 3) {
    a.assignPending(1)
  }
  res.status(200).json({ callers: a.activeCallers() })
})

app.post('/agent/:id/disconnect', (req, res, next) => {
  const a = agents.get(req.params.id)
  if (!a) {
    const e = new Error(`Agent ID ${req.params.id} not found`)
    e.status = 404
    return next(e)
  }
  a.disconnect()
  res.status(200).send()
})

app.post('/agent', (req, res, next) => {
  let a = new Agent(req.body.name || 'N/A')
  a.assignPending(3)
  agents.set(a.agentid, a)
  res.status(200).json({
    agentid: a.agentid,
    name: a.name
  })
})

app.post('/ot_callback', (req, res) => {
  switch (req.body.event) {
    case 'connectionCreated':
      handleConnectionCreated(req.body)
      break
    case 'connectionDestroyed':
      handleConnectionDestroyed(req.body)
      break
  }
  res.status(200).send()
})

// error handler
app.use(function (err, req, res, next) {
  err.status = err.status || 500
  if (err.status === 500) {
    console.log('Error', err)
  }
  res.status(err.status).json({
    message: err.message || 'Unable to perform request',
    status: err.status
  })
})

if (!process.env.SECURE || process.env.SECURE === '0') {
  // Bootstrap and start HTTP server for app
  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`)
  })
} else {
  const https = require('https')
  const fs = require('fs')
  const tlsOpts = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
  }
  https.createServer(tlsOpts, app).listen(PORT, () => {
    console.log(`Listening on secure port ${PORT}...`)
  })
}
