<template>
  <div class="route-agent uk-grid-collapse" uk-grid uk-height-viewport="expand: true">
    <div class="uk-width-1-3@m uk-padding">
      <h2>Caller List</h2>
      <p v-show="!callers.length" class="uk-text-lead">No callers connected</p>

      <div v-for="caller in callers" :key="caller.callerId"
        class="uk-card uk-card-default uk-card-hover uk-card-small uk-margin-small-bottom">
        <div class="uk-card-header">
          <h3 class="uk-card-title">Caller #{{ caller.callerId }}</h3>
        </div>
        <div class="uk-card-body">
          <span v-if="caller.agentConnected" class="uk-card-badge uk-label uk-label-success">Live</span>
          <span v-if="caller.onHold" class="uk-card-badge uk-label uk-label-warning">On Hold</span>
          <button
            @click="joinCall(caller.callerId)"
            v-if="!caller.agentConnected && !caller.onHold"
            class="uk-button uk-button-primary">Join</button>
          <button
            @click="unholdCall(caller.callerId)"
            v-else-if="caller.onHold"
            class="uk-button uk-button-primary">Unhold</button>
          <button
            @click="holdCall(caller.callerId)"
            v-else-if="caller.agentConnected && !caller.onHold"
            class="uk-button uk-button-primary">Hold</button>
        </div>
      </div>
    </div>
    <div class="uk-width-expand uk-background-secondary">
      <subscriber v-if="callerSession && callerStream" @error="errorHandler" :stream="callerStream" :opts="otOpts"
        :session="callerSession" class="uk-width-1-1 uk-height-1-1"></subscriber>
      <publisher v-if="callerSession" :session="callerSession" @error="errorHandler"
        class="uk-width-small uk-height-small uk-position-medium uk-position-bottom-right">
      </publisher>
    </div>
  </div>
</template>

<script>
import OT from '@opentok/client'
import axios from 'axios'
import Publisher from './Publisher'
import Subscriber from './Subscriber'

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

export default {
  name: 'agent',
  components: { Publisher, Subscriber },

  data: () => ({
    callers: [],
    connections: new Map(),
    currentCaller: null,
    callerSession: null,
    callerStream: null,
    notificationSession: null,
    otOpts: {
      insertMode: 'append',
      width: '100%',
      height: '100%'
    }
  }),

  mounted() {
    axios('/calls')
      .then(res => {
        this.callers = res.data.callers
      })
      .catch(console.log)
  },

  methods: {
    joinCall,
    holdCall,
    unholdCall,
    updateCaller,
    deleteCaller,
    setupSession,
    errorHandler,
    successHandler
  }
}

</script>
