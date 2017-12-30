<template>
  <div class="route-agent uk-grid-collapse" uk-grid uk-height-viewport="expand: true">
    <div class="uk-width-auto uk-padding uk-background-muted">

      <div v-if="caller" class="uk-card uk-card-small uk-card-default">
        <div class="uk-card-header">
          <div uk-grid class="uk-flex-between">
            <div>
              <h2 class="uk-card-title">Caller #{{ caller.callerId }}</h2>
            </div>
            <div>
              <div v-if="!agentConnected && !onHold" class="uk-label uk-label-default">
                In queue
              </div>
              <div v-if="onHold" class="uk-label uk-label-warning">
                On hold
              </div>
              <div v-if="agentConnected && !onHold" class="uk-label uk-label-success">
                Live
              </div>
            </div>
          </div>
        </div>
        <div class="uk-card-body">
          <publisher v-if="session" :session="session" @error="errorHandler"
            class="uk-width-small uk-height-small">
          </publisher>
        </div>
      </div>
    </div>

    <div class="uk-width-expand uk-position-relative" :class="{ 'uk-background-secondary': onHold }">
      <p v-if="onHold" class="uk-position-center uk-width-1-1 uk-text-center uk-text-lead uk-light">
        Agent has put you on hold&hellip;
      </p>
      <p v-if="!agentConnected && !onHold" class="uk-position-center uk-width-1-1 uk-text-center uk-text-lead">
        Waiting for agent to join&hellip;
      </p>

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
