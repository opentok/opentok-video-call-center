import Vue from 'vue'
import VueRouter from 'vue-router'

// routes
import Home from './components/Home'
import Agent from './components/Agent'
import Caller from './components/Caller'

Vue.use(VueRouter)

const router = new VueRouter({
  routes: [
    { path: '/', component: Home },
    { path: '/agent', component: Agent },
    { path: '/caller', component: Caller }
  ]
})

new Vue({
  router
  // render: h => h(App)
}).$mount('#app')
