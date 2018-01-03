<template>
  <div v-if="session" class="uk-card uk-card-small uk-card-default">
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
    <div class="uk-card-body uk-position-relative">
      <ot-publisher :session="session" :opts="publisherOpts" @error="errorEmit" @publisherCreated="handlePublisher"
        class="uk-width-small uk-height-small">
      </ot-publisher>
      <div v-show="isMuted"
        class="uk-badge uk-label-warning uk-position-top-right uk-margin-small-top uk-margin-small-right">
        Muted
      </div>
    </div>
    <div v-if="otPublisher" class="uk-card-footer">
      <button @click="toggleMute" class="uk-button uk-width-1-1 uk-margin-small-bottom"
        :class="[ isMuted ? 'uk-button-primary' : 'uk-button-secondary' ]">
        {{ isMuted ? 'Unmute' : 'Mute'}}
      </button>
      <button @click="endCall"
        class="uk-button uk-width-1-1 uk-margin-small-bottom uk-button-danger">
        End call
      </button>
    </div>
  </div>
</template>

<script>

import OtPublisher from './ot-publisher'

export default {
  name: 'self-view',
  components: { OtPublisher },
  data () {
    return {
      otPublisher: null,
      isMuted: false
    }
  },
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
  beforeDestroy () {
    if (this.otPublisher && this.session) {
      this.session.unpublish(this.otPublisher)
    }
  },
  props: {
    caller: Object,
    session: Object,
    errorHandler: Function,
    agentConnected: {
      type: Boolean,
      default: false
    },
    onHold: {
      type: Boolean,
      default: false
    },
    audioVideo: {
      type: String,
      default: 'audioVideo'
    }
  },
  methods: {
    errorEmit: function (err) {
      this.$emit('error', err)
    },
    handlePublisher: function (p) {
      this.otPublisher = p
    },
    toggleMute: function () {
      if (this.otPublisher) {
        this.otPublisher.publishAudio(this.isMuted)
        this.$emit('publisherMuted', !this.isMuted)
        this.isMuted = !this.isMuted
      }
    },
    endCall: function () {
      this.$emit('endCall')
    }
  }
}
</script>
