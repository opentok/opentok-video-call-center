<template>
  <div class="route-agent uk-grid-collapse" uk-grid uk-height-viewport="expand: true">
    <div v-if="caller" class="uk-width-auto uk-padding uk-background-muted">

      <self-view :session="session" :agentConnected="agentConnected" :audioVideo="audioVideo"
        :onHold="onHold" :caller="caller" @error="errorHandler" @endCall="endCallHandler">
      </self-view>

      <div class="uk-card uk-card-default uk-card-small uk-margin-small-top">
        <div class="uk-card-header">
          <h2 class="uk-h4">Caller info</h2>
        </div>
        <div class="uk-card-body">
          <ul class="uk-list">
            <li>Name: {{ callerName || 'N/A' }}</li>
            <li>Reason: {{ callerReason || 'N/A'}}</li>
          </ul>
        </div>
      </div>
    </div>

    <div v-if="!caller" class="uk-width-expand uk-position-relative" :class="{ 'uk-background-secondary': onHold }">
      <div class="uk-section uk-section-primary uk-preserve-color uk-height-viewport">
        <div class="uk-container uk-container-small">
          <div class="uk-card uk-card-default uk-width-3-4 uk-width-3-5@m uk-align-center">
            <form v-on:submit.prevent="onSubmit">
              <div class="uk-card-header">
                <p class="uk-h3">Welcome to XYZ Corporation</p>
                <p>Contact our audio/video call center</p>
              </div>
              <div class="uk-card-body">
                <div class="uk-margin" uk-grid>
                  <div class="uk-width-1-3 uk-text-right uk-text-bold">
                    <label for="caller-name">Your name</label>
                  </div>
                  <div class="uk-width-auto">
                    <input type="text" id="caller-name" v-model="callerName" autofocus ref='callerName'>
                  </div>
                </div>
                <div class="uk-margin" uk-grid>
                  <div class="uk-width-1-3 uk-text-right uk-text-bold">
                    <label for="caller-reason">Reason for call</label>
                  </div>
                  <div class="uk-width-expand">
                    <input type="text" v-model="callerReason" id="caller-reason">
                  </div>
                </div>
                <div class="uk-margin" uk-grid>
                  <div class="uk-width-1-3 uk-text-right uk-text-bold">
                    <div class="uk-form-label">Join via</div>
                  </div>
                  <div class="uk-form-controls uk-form-controls-text uk-width-expand">
                      <label><input class="uk-radio" type="radio" name="audioVideo" value="audioVideo"
                        v-model="audioVideo">Audio/Video</label><br>
                      <label><input class="uk-radio" type="radio" name="audioVideo" value="audioOnly"
                        v-model="audioVideo">Audio only</label>
                  </div>
                </div>
              </div>
              <div class="uk-card-footer">
                <div class="uk-margin" uk-grid>
                  <div class="uk-width-1-3">
                    <router-link to="/" class="uk-button uk-button-secondary">Exit</router-link>
                  </div>
                  <div class="uk-form-controls uk-form-controls-text uk-width-expand">
                    <input type="submit" value="Place call" class="uk-button uk-button-primary uk-margin-remove-left">
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <div v-if="caller" class="uk-width-expand uk-position-relative" :class="{ 'uk-background-secondary': onHold }">
      <p v-if="onHold" class="uk-position-center uk-width-1-1 uk-text-center uk-text-lead uk-light">
        Agent has put you on hold&hellip;
      </p>
      <p v-if="!agentConnected && !onHold" class="uk-position-center uk-width-1-1 uk-text-center uk-text-lead">
        Waiting for agent to join&hellip;
      </p>

      <ot-subscriber v-if="agentStream" @error="errorHandler" :stream="agentStream" :session="session" :opts="subscriberOpts"
        class="uk-background-primary uk-width-1-1 uk-height-1-1">
      </ot-subscriber>
    </div>
  </div>
</template>

<script>
import OT from '@opentok/client'
import axios from 'axios'
import OtSubscriber from './ot-subscriber'
import SelfView from './self-view'

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

function endCallHandler () {
  this.$router.push('/end')
}

function otConnect (apiKey, sessionId, token) {
  this.session = OT.initSession(apiKey, sessionId)
  this.session.connect(token, (err) => {
    if (err) {
      errorHandler(err)
      return
    }
    successHandler('Connected to OpenTok')
    console.log('Connected to session', sessionId)
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
  this.session.on('signal:endCall', () => {
    this.endCallHandler()
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

function onSubmit(e) {
  axios.post('/dial', { callerName: this.callerName, callerReason: this.callerReason, audioVideo: this.audioVideo })
  .then(res => {
    this.caller = res.data.caller
    this.otConnect(res.data.apiKey, res.data.caller.sessionId, res.data.caller.token)
  })
  .catch(console.log)
}

export default {
  name: 'caller',

  components: { OtSubscriber, SelfView },

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
    },
    callerName: null,
    callerReason: null,
    audioVideo: 'audioVideo'
  }),

  mounted() {
    this.$refs.callerName.focus()
  },

  beforeDestroy () {
    if (this.session && this.session.isConnected()) {
      console.log('Disconnecting from session', this.session.sessionId)
      this.session.disconnect()
    }
  },

  methods: {
    errorHandler,
    successHandler,
    otConnect,
    endCallHandler,
    onSubmit
  }

}

</script>
