<template>
  <div class="route-caller">
    <h1>Caller</h1>
  </div>
</template>

<script>
import OT from '@opentok/client'
import axios from 'axios'

export default {

  created() {
    axios.get('/call/dial')
    .then(res => {
      console.log(res)
    })
    .catch(console.log)
  }

}

</script>
