import { createRouter, createWebHistory } from 'vue-router'
import FormSubmit from '../components/FormSubmit.vue'
import FormView from '../components/FormView.vue'

const routes = [
  { path: '/', name: 'Submit', component: FormSubmit },
  { path: '/form-view', name: 'FormView', component: FormView }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
