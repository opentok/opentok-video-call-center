<template>
  <div class="route-agent uk-grid-collapse" uk-grid uk-height-viewport="expand: true">
    <div class="uk-width-1-3 uk-width-1-4@l uk-height-viewport uk-panel-scrollable" id="agent-info-screen">
      <div uk-grid>
        <div>
          <h1 class="uk-h3 uk-padding-small">Agent #{{ agentid }}</h1>
        </div>
        <div>
          <router-link to="/end" class="uk-button uk-button-danger uk-b">Exit</router-link>
        </div>
      </div>

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
          <button
            @click="endCall(caller.callerId)"
            v-if="caller.agentConnected && !caller.onHold"
            class="uk-button uk-button-danger">End Call</button>
        </div>
      </div>
    </div>
    <div class="uk-width-expand uk-background-muted">
      <ot-subscriber v-if="callerSession && callerStream" @error="errorHandler" :stream="callerStream" :opts="otOpts"
        :session="callerSession" class="uk-width-1-1 uk-height-1-1">
      </ot-subscriber>
      <ot-publisher v-if="callerSession" :session="callerSession" @error="errorHandler" :opts="publisherOpts"
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

let fetchInterval = null

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
      this.audioVideo = res.data.caller.audioVideo
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
      this.audioVideo = res.data.caller.audioVideo
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

function endCall(callerId) {
  if (this.callerSession && this.callerSession.isConnected()) {
    this.callerSession.disconnect()
  }
  this.deleteCaller(callerId)
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

function connectAgent() {
  axios.post('/agent')
    .then(res => {
      this.agentid = res.data.agentid
      this.fetchCallersList()
      fetchInterval = setInterval(this.fetchCallersList, 2500)
    })
    .catch(e => {
      errorHandler('Unable to connect agent to service')
      console.log('Unable to connect agent service', e)
    })
}

function disconnectAgent() {
  if (this.callerSession && this.callerSession.isConnected()) {
    console.log('Disconnecting from session', this.callerSession.sessionId)
    this.callerSession.disconnect()
  }
  if (fetchInterval) {
    clearInterval(fetchInterval)
  }
  axios.post(`/agent/${this.agentid}/disconnect`)
    .then(res => {
      console.log('Agent disconnected')
    })
    .catch(e => {
      errorHandler('Error disconnecting agent')
      console.log('Error disconnecting agent', e)
    })
}

function fetchCallersList() {
  axios(`/agent/${this.agentid}/callers`)
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
    agentid: null,
    connections: new Map(),
    currentCaller: null,
    callerSession: null,
    callerStream: null,
    audioVideo: 'audioVideo',
    otOpts: {
      insertMode: 'append',
      width: '100%',
      height: '100%',
      // Don't show OpenTok's default UI controls
      // See: https://tokbox.com/developer/guides/customize-ui/js/#hiding_ui_controls
      showControls: false
    }
  }),

  computed: {
    publisherOpts: function () {
      const _opts = {
        // Don't show OpenTok's default UI controls
        // See: https://tokbox.com/developer/guides/customize-ui/js/#hiding_ui_controls
        showControls: false
      }
      if (this.audioVideo === 'audioOnly') {
        _opts.videoSource = null
      }
      return _opts
    }
  },

  mounted() {
    this.connectAgent()
    window.onbeforeunload = () => {
      this.disconnectAgent()
      return null
    }
  },

  beforeDestroy () {
    this.disconnectAgent()
    window.onbeforeunload = null
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
    fetchCallersList,
    connectAgent,
    disconnectAgent,
    endCall
  }
}

</script>
