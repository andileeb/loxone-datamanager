import { createRouter, createWebHashHistory } from 'vue-router'
import ConnectionView from './views/ConnectionView.vue'
import { useConnectionStore } from './stores/connection'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/connect' },
    { path: '/connect', component: ConnectionView },
    { path: '/browser', component: () => import('./views/BrowserView.vue') },
    { path: '/editor/:filename', component: () => import('./views/EditorView.vue'), props: true }
  ]
})

router.beforeEach((to) => {
  if (to.path === '/connect') return true
  const conn = useConnectionStore()
  if (conn.status !== 'connected') return '/connect'
  return true
})

export default router
