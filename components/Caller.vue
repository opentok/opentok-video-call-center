<template>
  <div class="route-caller">
    <div class="uk-container uk-text-center">
      <div v-if="!agentConnected && !onHold" class="uk-alert">
        <p>Waiting in queue for agent</p>
      </div>
      <div v-if="onHold" class="uk-alert uk-alert-primary">
        <p>You have been put on hold</p>
      </div>
      <div v-if="agentConnected && !onHold" class="uk-alert uk-alert-success">
        <p>You are connected to agent</p>
      </div>
    </div>

    <div v-if="session" class="uk-section">
      <div class="uk-container">
        <subscriber v-if="agentStream" @error="errorHandler" :stream="agentStream" :session="session"></subscriber>
        <publisher :session="session" @error="errorHandler"></publisher>
      </div>
    </div>
  </div>
</template>

<script>
import OT from '@opentok/client'
import axios from 'axios'
import Publisher from './Publisher'
import Subscriber from './Subscriber'

function errorHandler(err) {
  if (err && err.message) {
    UIkit.notification(err.message, 'danger')
  } else if (typeof err == 'string') {
    UIkit.notification(err, 'danger')
  }
}

function successHandler(msg) {
  UIkit.notification(msg, 'success')
}

function otConnect (apiKey, sessionId, token) {
  this.session = OT.initSession(apiKey, sessionId)
  this.session.connect(token, (err) => {
    if (err) {
      errorHandler(err)
      return
    }
    successHandler('Connected to OpenTok')
    console.log('Connected to session')
  })
  this.session.on('signal:agentConnected', (data) => {
    console.log('Agentconnected', data)
    this.onHold = false
    this.agentConnected = true
  })
  this.session.on('signal:hold', () => {
    this.onHold = true
    this.agentConnected = false
  })
  this.session.on('signal:unhold', () => {
    this.onHold = false
    this.agentConnected = true
  })
  this.session.on('streamCreated', (event) => {
    console.log('Stream created', event.stream)
    this.agentStream = event.stream
  })
  this.session.on('streamDestroyed', (event) => {
    this.agentStream = null
    this.agentConnected = false
    console.log('Stream destroyed')
  })
}

export default {
  name: 'caller',

  components: { Publisher, Subscriber },

  data: () => ({
    onHold: false,
    agentConnected: false,
    caller: null,
    session: null,
    agentStream: null
  }),

  mounted() {
    axios.get('/call/dial')
    .then(res => {
      this.caller = res.data.caller
      this.otConnect(res.data.apiKey, res.data.caller.sessionId, res.data.caller.token)
    })
    .catch(console.log)
  },

  methods: {
    errorHandler,
    successHandler,
    otConnect
  }

}

</script>
