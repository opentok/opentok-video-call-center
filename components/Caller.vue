<template>
  <div class="route-caller">
    <div class="uk-text-center uk-container uk-container-expand">
      <div v-if="!agentConnected && !onHold" class="uk-alert">
        <p>Waiting in queue for agent</p>
      </div>
      <div v-else-if="onHold" class="uk-alert uk-alert-primary">
        <p>You have been put on hold</p>
      </div>
      <div v-else-if="agentConnected && !onHold" class="uk-alert uk-alert-success">
        <p>You are connected to agent</p>
      </div>
    </div>

    <div v-if="session" class="route-agent">
      <div class="uk-container">
        <subscriber v-if="agentStream" @error="errorHandler" :stream="agentStream" :session="session" :opts="subscriberOpts"
          class="uk-width-1-1 uk-background-primary" uk-height-viewport="offset-top: true">
        </subscriber>
        <publisher v-if="session" :session="session" @error="errorHandler"
          class="uk-width-small uk-height-small uk-position-medium uk-position-bottom-right uk-overlay uk-overlay-default">
        </publisher>
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
