import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';
import SettingsView from '@/views/SettingsView.vue';
import ToolReportView from '@/views/tools/ToolReportView.vue';
import ToolsView from '@/views/tools/ToolsView.vue';
import ToolView from '@/views/tools/ToolView.vue';

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
      path: '/tools/create',
      name: 'createTool',
      component: ToolView,
    },
    {
      path: '/tools/database/:id',
      name: 'viewTool',
      component: ToolView,
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
    },
    {
      path: '/report',
      name: 'toolReport',
      component: ToolReportView,
    },
  ],
});

export default router;
