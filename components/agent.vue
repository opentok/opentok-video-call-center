<template>
  <div class="route-agent uk-grid-collapse" uk-grid uk-height-viewport="expand: true">
    <div class="uk-width-1-3 uk-width-1-4@l uk-height-viewport uk-panel-scrollable" id="agent-info-screen">
      <h1 class="uk-h3 uk-padding-small">Agent</h1>
      <p v-show="!callers.length" class="uk-text-lead">No callers connected</p>

      <div v-for="caller in callers" :key="caller.callerId"
        class="uk-card uk-card-default uk-card-hover uk-card-small uk-margin-small-bottom"
        :class="{ 'uk-card-primary': caller.agentConnected, 'uk-card-secondary': caller.onHold }">
        <div class="uk-card-header">
          <h3 class="uk-h4">Caller #{{ caller.callerId }}</h3>
        </div>
        <div class="uk-card-body">
          <ul class="uk-list">
            <li>Name: {{ caller.callerName || 'N/A' }}</li>
            <li>Reason: {{ caller.callerReason || 'N/A' }}</li>
          </ul>
          <span v-if="caller.agentConnected" class="uk-card-badge uk-label uk-label-success">Live</span>
          <span v-if="caller.onHold" class="uk-card-badge uk-label uk-label-warning">On Hold</span>
          <button
            @click="joinCall(caller.callerId)"
            v-if="!caller.agentConnected && !caller.onHold"
            class="uk-button uk-button-primary">Accept</button>
          <button
            @click="unholdCall(caller.callerId)"
            v-else-if="caller.onHold"
            class="uk-button uk-button-default">Resume</button>
          <button
            @click="holdCall(caller.callerId)"
            v-else-if="caller.agentConnected && !caller.onHold"
            class="uk-button uk-button-primary">Hold</button>
        </div>
      </div>
    </div>
    <div class="uk-width-expand uk-background-muted">
      <ot-subscriber v-if="callerSession && callerStream" @error="errorHandler" :stream="callerStream" :opts="otOpts"
        :session="callerSession" class="uk-width-1-1 uk-height-1-1">
      </ot-subscriber>
      <ot-publisher v-if="callerSession" :session="callerSession" @error="errorHandler"
        class="uk-width-small uk-height-small uk-position-medium uk-position-bottom-right">
      </ot-publisher>
    </div>
  </div>
</template>

<style scoped>
  #agent-info-screen {
    overflow-x: hidden;
  }
</style>


<script>
import OT from '@opentok/client'
import axios from 'axios'
import OtPublisher from './ot-publisher'
import OtSubscriber from './ot-subscriber'

function errorHandler(err) {
  console.log('Error', err)
  if (err && err.message) {
    UIkit.notification(err.message, 'danger')
  } else if (typeof err == 'string') {
    UIkit.notification(err, 'danger')
  }
}

function setupSession(callerId) {
  this.callerSession.on('streamCreated', (event) => {
    this.callerStream = event.stream
  })
  this.callerSession.on('connectionCreated', (event) => {
    this.connections[event.connection.id] = callerId
  })
  this.callerSession.on('connectionDestroyed', (event) => {
    delete this.connections[event.connection.id]
    if (this.currentCaller === callerId) {
      this.callerSession.disconnect()
      this.callerStream = null
      this.callerSession = null
      this.currentCaller = null
    }
    this.deleteCaller(callerId)
    console.log('Connection destroyed', callerId)
  })
  this.callerSession.on('streamDestroyed', (event) => {
    console.log('Stream destroyed', callerId)
    this.callerStream = null
  })
}

function successHandler(msg) {
  UIkit.notification(msg, 'success')
}

function joinCall(callerId) {
  if (this.currentCaller !== null && this.currentCaller !== callerId) {
    this.holdCall(this.currentCaller)
  }
  axios.get(`/call/${callerId}/join`)
    .then(res => {
      this.callerSession = OT.initSession(res.data.apiKey, res.data.sessionId)
      this.setupSession(callerId)
      this.callerSession.connect(res.data.token, (err) => {
        if (err) {
          console.log(err)
          return
        }
        this.updateCaller(res.data.caller)
        this.currentCaller = callerId
      })
    })
    .catch(errorHandler)
}

function holdCall(callerId) {
  if (this.callerSession && this.callerSession.isConnected()) {
    this.callerSession.disconnect()
  }
  console.log('Hold Call', callerId)
  this.currentCaller = null
  this.callerSession = null
  this.callerStream = null
  axios.get(`/call/${callerId}/hold`)
    .then(res => {
      this.updateCaller(res.data.caller)
    })
}

function unholdCall(callerId) {
  if (this.currentCaller !== null && this.currentCaller !== callerId) {
    this.holdCall(this.currentCaller)
  }
  axios.get(`/call/${callerId}/unhold`)
    .then(res => {
      this.callerSession = OT.initSession(res.data.apiKey, res.data.sessionId)
      this.setupSession(callerId)
      this.callerSession.connect(res.data.token, (err) => {
        if (err) {
          console.log(err)
          return
        }
        this.updateCaller(res.data.caller)
        this.currentCaller = callerId
      })
    })
    .catch(errorHandler)
}

function updateCaller(caller) {
  for (const c in this.callers) {
    if (this.callers[c].callerId === caller.callerId) {
      this.callers.splice(c, 1, caller)
    }
  }
}

function deleteCaller(callerId) {
  for (const c in this.callers) {
    if (this.callers[c].callerId === callerId) {
      axios.get(`/call/${callerId}/delete`)
        .then(res => {
          this.callers.splice(c, 1)
        })
        .catch(errorHandler)
    }
  }
}

function fetchAgentData() {
  axios('/agent/data')
    .then(res => {
      this.callers = res.data.callers
    })
    .catch(e => {
      errorHandler('Unable to fetch agent data')
      console.log('Unable to fetch agent data', e)
    })
}

export default {
  name: 'agent',
  components: { OtPublisher, OtSubscriber },

  data: () => ({
    callers: [],
    connections: new Map(),
    currentCaller: null,
    callerSession: null,
    callerStream: null,
    otOpts: {
      insertMode: 'append',
      width: '100%',
      height: '100%'
    }
  }),

  mounted() {
    this.fetchAgentData()
    setInterval(this.fetchAgentData, 2500)
  },

  methods: {
    joinCall,
    holdCall,
    unholdCall,
    updateCaller,
    deleteCaller,
    setupSession,
    errorHandler,
    successHandler,
    fetchAgentData
  }
}

</script>
