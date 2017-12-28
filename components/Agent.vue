<template>
  <div class="route-agent" uk-grid>
    <div>
      <div v-for="caller in callers" :key="caller.callerId" class="uk-card uk-card-body">
        <h3>Caller #{{ caller.callerId }}
          <span v-if="caller.agentConnected" class="uk-label uk-label-success">Live</span>
          <span v-if="caller.onHold" class="uk-label uk-label-warning">On Hold</span>
        </h3>
        <div>
          <button
            @click="joinCall(caller.callerId)"
            v-if="!caller.agentConnected && !caller.onHold"
            class="uk-button">Join</button>
          <button
            @click="unholdCall(caller.callerId)"
            v-if="caller.onHold"
            class="uk-button uk-button-primary">Unhold</button>
          <button
            @click="holdCall(caller.callerId)"
            v-if="caller.agentConnected && !caller.onHold"
            class="uk-button uk-button-secondary">Hold</button>
        </div>
      </div>
    </div>
    <div>
      <div v-if="callerSession">
        <!-- <subscriber v-if="agentStream" @error="errorHandler" :stream="agentStream" :session="session"></subscriber> -->
        <publisher :session="callerSession" @error="errorHandler"></publisher>
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

function joinCall(callerId) {
  if (this.currentCaller !== null && this.currentCaller !== callerId) {
    this.holdCall(this.currentCaller)
  }
  axios.get(`/call/${callerId}/agent/join`)
    .then(res => {
      this.callerSession = OT.initSession(res.data.apiKey, res.data.sessionId)
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
  axios.get(`/call/${callerId}/agent/hold`)
    .then(res => {
      this.updateCaller(res.data.caller)
      this.currentCaller = null
      this.callerSession = null
    })
}

function unholdCall(callerId) {
  if (this.currentCaller !== null && this.currentCaller !== callerId) {
    this.holdCall(this.currentCaller)
  }
  axios.get(`/call/${callerId}/agent/unhold`)
    .then(res => {
      this.callerSession = OT.initSession(res.data.apiKey, res.data.sessionId)
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
      this.callers.splice(c, 1)
    }
  }
}

export default {
  name: 'agent',
  components: { Publisher, Subscriber },

  data: () => ({
    callers: [],
    currentCaller: null,
    callerSession: null,
    notificationSession: null
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
    errorHandler,
    successHandler
  }
}

</script>
