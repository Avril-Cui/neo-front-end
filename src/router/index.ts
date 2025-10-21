import { createRouter, createWebHistory } from 'vue-router'
import TodayView from '../views/TodayView.vue'
import LoggingView from '../views/LoggingView.vue'
import CompareView from '../views/CompareView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'today',
      component: TodayView,
    },
    {
      path: '/logging',
      name: 'logging',
      component: LoggingView,
    },
    {
      path: '/compare',
      name: 'compare',
      component: CompareView,
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue'),
    },
  ],
})

export default router
