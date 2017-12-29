<template>
  <div class="route-agent uk-grid-collapse" uk-grid uk-height-viewport="expand: true">
    <div class="uk-width-auto uk-padding uk-background-muted">
      <h2>Caller #{{ caller.callerId }}</h2>

      <div v-if="!agentConnected && !onHold" class="uk-alert">
        <p>Waiting in queue for agent</p>
      </div>
      <div v-if="onHold" class="uk-alert uk-alert-primary">
        <p>You have been put on hold</p>
      </div>
      <div v-if="agentConnected && !onHold" class="uk-alert uk-alert-success">
        <p>You are connected to agent</p>
      </div>

      <div class="uk-card uk-card-body uk-card-small uk-card-default">
        <publisher v-if="session" :session="session" @error="errorHandler"
          class="uk-width-small uk-height-small">
        </publisher>
      </div>
    </div>

    <div class="uk-width-expand">
      <subscriber v-if="agentStream" @error="errorHandler" :stream="agentStream" :session="session" :opts="subscriberOpts"
        class="uk-background-primary uk-width-1-1 uk-height-1-1">
      </subscriber>
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
    UIkit.notification(err.message, { pos: 'bottom-left', status: 'danger' })
  } else if (typeof err == 'string') {
    UIkit.notification(err, { pos: 'bottom-left', status: 'warning' })
  }
}

function successHandler(msg) {
  UIkit.notification(msg, { pos: 'bottom-left', status: 'success', timeout: 2500 } )
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
    // this.agentStream = null
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
    agentStream: null,
    subscriberOpts: {
      insertMode: 'append',
      width: '100%',
      height: '100%'
    }
  }),

  mounted() {
    axios.get('/dial')
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
