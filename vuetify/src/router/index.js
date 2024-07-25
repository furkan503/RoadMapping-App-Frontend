import { createRouter, createWebHistory } from 'vue-router';
import Login from '../components/Login.vue';
import MapComponent from '../components/MapComponent.vue'; // Adjust the import based on your actual file paths

const routes = [
  {
    path: '/',
    redirect: '/login',
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
  },
  {
    path: '/map',
    name: 'MapComponent',
    component: MapComponent,
    meta: {
      requiresAuth: true,
    },
  },
  // Add other routes here as needed
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Navigation guard to ensure only authenticated users can access the map
router.beforeEach((to, from, next) => {
  if (to.matched.some(record => record.meta.requiresAuth)) {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      next({ path: '/login' });
    } else {
      next();
    }
  } else {
    next();
  }
});

// Workaround for dynamic import errors
router.onError((err, to) => {
  if (err?.message?.includes?.('Failed to fetch dynamically imported module')) {
    if (!localStorage.getItem('vuetify:dynamic-reload')) {
      console.log('Reloading page to fix dynamic import error');
      localStorage.setItem('vuetify:dynamic-reload', 'true');
      location.assign(to.fullPath);
    } else {
      console.error('Dynamic import error, reloading page did not fix it', err);
    }
  } else {
    console.error(err);
  }
});

router.isReady().then(() => {
  localStorage.removeItem('vuetify:dynamic-reload');
});

export default router;
