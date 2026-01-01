import { createRouter, createWebHistory } from 'vue-router';
import { useUserStore } from '@/stores/userStore';
import { useGameStore } from '@/stores/gameStore';

const routes = [
  {
    path: '/',
    name: 'Username',
    component: () => import('@/views/UsernameView.vue')
  },
  {
    path: '/lobbies',
    name: 'LobbyBrowser',
    component: () => import('@/views/LobbyBrowserView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/lobby/:id?',
    name: 'Lobby',
    component: () => import('@/views/LobbyView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/game',
    name: 'Game',
    component: () => import('@/views/GameView.vue'),
    meta: { requiresAuth: true, requiresGame: true }
  },
  {
    path: '/results',
    name: 'Results',
    component: () => import('@/views/ResultsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, from, next) => {
  const userStore = useUserStore();
  const gameStore = useGameStore();

  if (to.meta.requiresAuth && !userStore.isRegistered) {
    next({ name: 'Username' });
    return;
  }

  if (to.meta.requiresGame && !gameStore.isInGame) {
    next({ name: 'LobbyBrowser' });
    return;
  }

  next();
});

export default router;
