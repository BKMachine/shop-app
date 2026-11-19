import { createRouter, createWebHistory } from 'vue-router';
import { currentDeviceReady, deviceState } from '@/state/device';
import ActivityView from '@/views/ActivityView.vue';
import AuditTrailView from '@/views/AuditTrailView.vue';
import HomeView from '@/views/HomeView.vue';
import JobsView from '@/views/JobsView.vue';
import JobView from '@/views/jobs/JobView.vue';
import LocationsView from '@/views/LocationsView.vue';
import MachiningCalculatorView from '@/views/MachiningCalculatorView.vue';
import MaterialsView from '@/views/MaterialsView.vue';
import PartsView from '@/views/parts/PartsView.vue';
import PartView from '@/views/parts/PartView.vue';
import ScheduleView from '@/views/ScheduleView.vue';
import SettingsView from '@/views/SettingsView.vue';
import ShipmentArchiveView from '@/views/ShipmentArchiveView.vue';
import StatusView from '@/views/StatusView.vue';
import StatusSettingsView from '@/views/status/StatusSettingsView.vue';
import TestView from '@/views/TestView.vue';
import ToolReportView from '@/views/tools/ToolReportView.vue';
import ToolsView from '@/views/tools/ToolsView.vue';
import ToolView from '@/views/tools/ToolView.vue';

declare module 'vue-router' {
  interface RouteMeta {
    /** Full-screen page with no app bar or menu, e.g. a wall display. */
    bare?: boolean;
    /** Only for devices flagged as on the shop LAN; others are sent home. */
    lanOnly?: boolean;
  }
}

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
      path: '/jobs',
      name: 'jobs',
      component: JobsView,
    },
    {
      path: '/job/create',
      name: 'createJob',
      component: JobView,
    },
    {
      path: '/job/:id',
      name: 'viewJob',
      component: JobView,
    },
    {
      path: '/schedule',
      name: 'schedule',
      component: ScheduleView,
      meta: { lanOnly: true },
    },
    {
      // Read-only wall display for the shop TVs: /view/schedule?departments=Mills,Lathes&days=14
      path: '/view/schedule',
      name: 'scheduleDisplay',
      component: ScheduleView,
      props: { display: true },
      meta: { bare: true, lanOnly: true },
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
      path: '/shipments',
      name: 'shipments',
      component: ShipmentArchiveView,
    },
    {
      path: '/status',
      name: 'status',
      component: StatusView,
    },
    {
      path: '/status/settings',
      name: 'statusSettings',
      component: StatusSettingsView,
    },
    {
      path: '/activity',
      name: 'activity',
      component: ActivityView,
    },
    {
      path: '/audit-trail',
      name: 'auditTrail',
      component: AuditTrailView,
    },
    {
      path: '/test',
      name: 'test',
      component: TestView,
    },
    {
      path: '/calculator',
      name: 'calculator',
      component: MachiningCalculatorView,
    },
  ],
});

router.beforeEach(async (to) => {
  if (!to.meta.lanOnly) return true;
  await currentDeviceReady();
  return deviceState.current?.isLan ? true : { name: 'home' };
});

export default router;
