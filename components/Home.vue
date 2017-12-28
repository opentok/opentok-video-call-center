<template>
  <div class="uk-container uk-text-center">
    <h1 class="uk-margin-large-top">OpenTok Call Center Demo</h1>
    <p>This demo showcases a simulation of call center where callers queue up to talk to available agents.</p>
    <div class="route-home uk-flex-center" uk-grid>
      <div>
        <div class="uk-card uk-card-default uk-card-body">
          <router-link to="/agent" class="uk-button uk-button-primary uk-button-large">Join as Agent</router-link>
        </div>
      </div>
      <div>
        <div class="uk-card uk-card-default uk-card-body">
          <router-link to="/caller" class="uk-button uk-button-primary uk-button-large">Join as caller</router-link>
        </div>
      </div>
    </div>
  </div>
</template>
