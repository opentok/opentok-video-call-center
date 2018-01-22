// Server script for the call center demo

const express = require('express')
const OpenTok = require('opentok')
const compression = require('compression')
const bodyParser = require('body-parser')

// Get configurations
const PORT = process.env.PORT || 8080

// Set OPENTOK_API_KEY from environment variable
// Exit with error if the environment variable is not specified.
const OPENTOK_API_KEY = process.env.OPENTOK_API_KEY
if (!OPENTOK_API_KEY) {
  throw new Error('Provide OPENTOK_API_KEY environment variable')
}

// Set OPENTOK_API_SECRET from environment variable
// Exit with error if the environment variable is not specified.
const OPENTOK_API_SECRET = process.env.OPENTOK_API_SECRET
if (!OPENTOK_API_SECRET) {
  throw new Error('Provide OPENTOK_API_SECRET environment variable')
}

// --- In-memory data store ---
//
// An actual application will use databases to store these information. This demo does not go into those complexities by
// using simple in-memory data structures. This means, you will lose caller and agent information on server restart.

// List of current `Caller` indexed by caller ID
let callers = new Map()
// Sequence used to create incremental IDs for callers
let callerSeq = 0
// List of current `Agent` indexed by agent ID
let agents = new Map()
// Sequence used to create incremental IDs for agents
let agentSeq = 0
// List of callers pending to be assigned to any agent
let pendingQueue = []

// --- OpenTok setup ---

// Create instance of `OpenTok` that we will reuse for the rest of the application.
const OT = new OpenTok(OPENTOK_API_KEY, OPENTOK_API_SECRET)

/**
 * Create a new OpenTok session with the given `mediaMode`.
 *
 * @param {string} [mediaMode=routed] - The mediaMode for the session.
 * @returns {Promise} Returns a `Promise` that resolves to a new OpenTok session object.
 * @see https://tokbox.com/developer/guides/create-session/node/
 */
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

/**
 * Create a new token to join an existing OpenTok session with the role set to `publisher`.
 *
 * @see https://tokbox.com/developer/guides/create-token/node/
 * @param {string} sessionId - ID the OpenTok session to create token for
 * @param {string} userId - An internal user ID that is added to the serialized token data.
 * @param {string} [userType=caller] - An internal user type which is set to 'caller' by default.
 * @returns {Promise} Returns a `Promise` that resolves to a token.
 */
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

/**
 * Caller holds metadata and provides actions for a single caller. Each new instance of this constructor is created for
 * every new caller.
 *
 * @constructor
 * @param {string} sessionId - OpenTok session ID for this caller
 * @param {string} token - OpenTok token used by the caller to join the session
 */
function Caller (sessionId, token) {
  // Session ID for this caller
  this.sessionId = sessionId
  // Token for the caller to join the session
  this.token = token
  // Auto-generated caller ID used to identify this caller
  this.callerId = (++callerSeq).toString()
  // Whether the caller is on hold
  this.onHold = false
  // Whether agent has connected to this caller
  this.agentConnected = false
  // Time when the caller joined
  this.connectedSince = new Date()
  // Time when the call started
  this.onCallSince = null
  // Whether caller is ready. This is set to true only after caller has successfully connected to OpenTok.
  this.ready = false
  // Name for this caller.
  this.callerName = null
  // Reason for call
  this.callerReason = null
  // Whether the caller has audio or video. Values can be either 'audioOnly` or `audioVideo`.
  this.audioVideo = null
  // `Agent` assigned to this caller. `null` means no agent assigned.
  this.assignedAgent = null
}

/**
 * Provides a subset of data used to send status of this caller.
 *
 * @returns {object}
 */
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

/**
 * Marks agent has started call and sends out a `agentConnected` signal with caller status.
 *
 * @returns {Promise} - Returns a `Promise` that fails if the signal failed to be sent.
 */
Caller.prototype.startCall = function () {
  return new Promise((resolve, reject) => {
    this.onCallSince = new Date()
    this.agentConnected = true
    OT.signal(this.sessionId, null, { type: 'agentConnected', data: JSON.stringify(this.status()) }, function (err) {
      if (err) {
        return reject(err)
      }
      return resolve()
    })
  })
}

/**
 * Marks the current call to be on hold and sends out a `hold` signal with caller status.
 *
 * @returns {Promise} - Returns a `Promise` that fails if the signal failed to be sent.
 */
Caller.prototype.hold = function () {
  return new Promise((resolve, reject) => {
    this.onHold = true
    this.agentConnected = false
    OT.signal(this.sessionId, null, { type: 'hold', data: JSON.stringify(this.status()) }, function (err) {
      if (err) {
        return reject(err)
      }
      return resolve()
    })
  })
}

/**
 * Marks the current call has been removed from hold and sends out an `unhold` signal with caller status.
 *
 * @returns {Promise} - Returns a `Promise` that fails if the signal failed to be sent.
 */
Caller.prototype.unhold = function () {
  return new Promise((resolve, reject) => {
    this.onHold = false
    this.agentConnected = true
    OT.signal(this.sessionId, null, { type: 'unhold', data: JSON.stringify(this.status()) }, function (err) {
      if (err) {
        return reject(err)
      }
      return resolve()
    })
  })
}

/**
 * Agent holds the metadata for a single agent.
 *
 * @constructor
 * @param {string} [name='N/a'] - Optional name for the agent
 */
function Agent (name = 'N/a') {
  // Auto-generated ID for the agent
  this.agentid = (++agentSeq).toString()
  // Agent's name
  this.name = name.trim()
  // List of callers assigned to this agent
  this.currentCallers = new Map()
  console.log('New Agent connected', this.agentid)
}

/**
 * Assigns given number of pending callers to this Agent. This looks up `pendingQueue` and assigns based on FIFO
 * (first-in-first-out).
 *
 * @param {number} [limit=1] - Number of callers to assign
 */
Agent.prototype.assignPending = function (limit = 1) {
  let c = pendingQueue.splice(0, limit)
  for (const i in c) {
    this.assignCaller(c[i])
  }
}

/**
 * Assign given caller to current agent.
 *
 * @param {Caller} c - Instance of `Caller` to assign to.
 */
Agent.prototype.assignCaller = function (c) {
  c.assignedAgent = this.agentid
  this.currentCallers.set(c.callerId, c)
}

/**
 * Remove a caller from agent's list of current callers and assign one pending caller to this agent in its place. This
 * method is called when a caller has left or agent has ended a call.
 *
 * @param {string} callerid - ID of the caller
 */
Agent.prototype.removeCaller = function (callerid) {
  this.currentCallers.delete(callerid)
  this.assignPending(1)
}

/**
 * Mark the current agent as disconnected and move agent's current callers to pending callers' queue. Also, this removes
 * this agent from the list of available agents.
 */
Agent.prototype.disconnect = function () {
  for (const c of this.currentCallers.values()) {
    c.agentConnected = null
    pendingQueue.push(c)
  }
  console.log('Agent disconnected', this.agentid)
  agents.delete(this.agentid)
}

/**
 * Get status of callers who are marked as ready and currently assigned to this agent.
 *
 * @returns {Array} - `Caller.status()` for each active caller.
 */
Agent.prototype.activeCallers = function () {
  return Array.from(this.currentCallers.values()).filter(c => c.ready).map(c => c.status())
}

/**
 * Get number of callers assigned to this agent
 *
 * @returns {number}
 */
Agent.prototype.callerCount = function () {
  return this.currentCallers.size
}

// --- Caller assignment functions ---

/**
 * Sort current `agents` list in ascending order of the number of caller each `Agent` has.
 *
 * @returns {Agent[]} - Array of `Agent`
 */
function sortAgentsByCallerCount () {
  return Array.from(agents.values()).sort((a, b) => a.callerCount() - b.callerCount())
}

/**
 * Assign a given caller to an available agent. It picks the agent with least number of callers.
 *
 * @param {Caller} caller - Caller to be assigned
 * @return {Promise} - Resolves to assigned agent's ID or `null` if no agent is available.
 */
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

/**
 * Remove a given caller. This function cleans up a caller's presence from assigned agent's list as well as from pending
 * callers' queue if the caller is not currently assigned to any agent.
 *
 * @param {string} callerid - Caller's ID
 */
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

// --- Server-side monitoring callbacks ---

/**
 * Handle what happens when OpenTok sends callback that a new connection was created. If the connection is identified as
 * a caller, this function marks that caller as `ready`.
 *
 * @param {Object} data - Data posted from OpenTok
 */
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

/**
 * Handle what happens when OpenTok sends callback that a connection was destroyed. If the connection is identified as
 * caller, this function cleans up that caller from the queues.
 *
 * @param {Object} data - Data posted from OpenTok
 */
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

// --- Bootstrap Express Application ---

// Create expressJS app instance
const app = express()
app.use(compression())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// Mount the `./public` dir to web-root as static.
app.use('/', express.static('./public'))

// --- REST endpoints ---

/**
 * POST /dial
 *
 * Called by callers when they join. This creates a new caller and attempts to assign the caller to an available agent.
 */
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

/**
 * GET /call/:id/join
 *
 * Used by agents to mark that they have joined a caller.
 */
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

/**
 * GET /call/:id/hold
 *
 * Used by agents to mark given caller on hold.
 */
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

/**
 * GET /call/:id/unhold
 *
 * Used by agents to mark given caller is removed from hold.
 */
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

/**
 * GET /call/:id/delete
 *
 * Used by agents to remove a caller
 */
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

/**
 * GET /call/:id
 *
 * Get status of given caller if found
 */
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

/**
 * GET /agent/:id/callers
 *
 * Get callers currently assigned to given agent. If agent has less than 3 callers, this also attempts to assign the
 * first caller in the pending queuee to this agent.
 */
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

/**
 * GET /agent/:id/disconnect
 *
 * Remove agent from list of active agents.
 */
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

/**
 * POST /agent
 *
 * Creates a new agent.
 */
app.post('/agent', (req, res, next) => {
  let a = new Agent(req.body.name || 'N/A')
  a.assignPending(3)
  agents.set(a.agentid, a)
  res.status(200).json({
    agentid: a.agentid,
    name: a.name
  })
})

/**
 * Callback handler for OpenTok session monitoring.
 */
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
