import { createRouter, createWebHistory } from 'vue-router'
import Auth from '../components/Auth.vue'
import FormSubmit from '../components/FormSubmit.vue'
import FormView from '../components/FormView.vue'
import Settings from '../components/Settings.vue'

const routes = [
  { path: '/', name: 'Auth', component: Auth },
  { path: '/submit', name: 'Submit', component: FormSubmit },
  { path: '/form-view', name: 'FormView', component: FormView }
  ,{ path: '/settings', name: 'Settings', component: Settings }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
