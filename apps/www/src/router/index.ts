import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';
import LocationsView from '@/views/LocationsView.vue';
import MaterialsView from '@/views/MaterialsView.vue';
import SettingsView from '@/views/SettingsView.vue';
import PartView from '@/views/parts/PartView.vue';
import PartsView from '@/views/parts/PartsView.vue';
import ToolReportView from '@/views/tools/ToolReportView.vue';
import ToolView from '@/views/tools/ToolView.vue';
import ToolsView from '@/views/tools/ToolsView.vue';
import StatusView from '@/views/StatusView.vue';

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
      path: '/locations',
      name: 'locations',
      component: LocationsView,
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
    {
      path: '/parts',
      name: 'parts',
      component: PartsView,
    },
    {
      path: '/parts/create',
      name: 'createPart',
      component: PartView,
    },
    {
      path: '/parts/database/:id',
      name: 'viewPart',
      component: PartView,
    },
    {
      path: '/materials',
      name: 'materials',
      component: MaterialsView,
    },
    {
      path: '/status',
      name: 'status',
      component: StatusView,
    },
  ],
});

export default router;
