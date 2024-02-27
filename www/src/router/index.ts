import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';
import SettingsView from '@/views/SettingsView.vue';
import CreateToolView from '@/views/tools/CreateToolView.vue';
import ToolsDatabaseView from '@/views/tools/ToolsDatabaseView.vue';
import ToolsView from '@/views/tools/ToolsView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/tools',
      name: 'tools',
      component: ToolsView,
    },
    {
      path: '/tools/database',
      name: 'toolsDatabase',
      component: ToolsDatabaseView,
    },
    {
      path: '/tools/database/create',
      name: 'createTool',
      component: CreateToolView,
    },
    {
      path: '/tools/database/:id',
      name: 'createTool',
      component: CreateToolView,
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
    },
  ],
});

export default router;
