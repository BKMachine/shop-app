<template>
  <div class="container">
    <!-- Cost Header Stats -->
    <div class="stats-header">
      <h1 class="stats-title">Cost Summary</h1>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Yesterday</div>
          <div class="stat-value">${{ toolCosts.yesterday.toFixed(2) }}</div>
        </div>
        <div class="stat-card highlight">
          <div class="stat-label">Today</div>
          <div class="stat-value">${{ toolCosts.today.toFixed(2) }}</div>
        </div>
      </div>
    </div>

    <!-- Activity Columns -->
    <div class="activities-grid">
      <!-- Tools Activity Column -->
      <div class="activity-column">
        <h2 class="column-title">Tools</h2>
        <div v-if="toolActivities.length === 0" class="no-data">No activity</div>
        <v-card v-for="activity in toolActivities" :key="activity._id" class="activity-card">
          <v-card-text class="card-content">
            <v-row class="align-center" no-gutters>
              <!-- Tool Image -->
              <v-col cols="3" class="image-col">
                <v-img class="tool-image" :src="activity.new.img" />
              </v-col>

              <!-- Tool Info -->
              <v-col cols="auto" class="info-col">
                <div class="tool-description">{{ activity.new.description }}</div>
                <div class="activity-meta">
                  <span :class="`amount ${activity.type === 'increase' ? 'increase' : 'decrease'}`">
                    {{ activity.type === 'increase' ? '+' : '−' }}{{ activity.amount }}
                  </span>
                  <span class="stock-info">{{ activity.new.stock }}</span>
                  <span class="cost-badge"
                    >${{ (activity.amount * activity.new.cost).toFixed(2) }}</span
                  >
                </div>
                <div class="timestamp">{{ new Date(activity.timestamp).toLocaleString() }}</div>
              </v-col>

              <!-- Action Button -->
              <v-col cols="auto" class="action-col">
                <v-btn
                  icon
                  size="x-small"
                  class="action-btn"
                  @click="open(activity.new)"
                  title="View tool details"
                >
                  <v-icon icon="mdi-arrow-top-right" size="small"></v-icon>
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </div>

      <!-- Parts Activity Column (placeholder for future) -->
      <div class="activity-column">
        <h2 class="column-title">Parts</h2>
        <div class="no-data">No parts activity yet</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import { computed, onMounted, ref } from 'vue';
import api from '@/plugins/axios';
import router from '@/router';

const audits = ref<Audit[]>([]);
const to = ref<DateTime>(DateTime.now());
const from = computed<DateTime>(() => DateTime.now().minus({ days: 2 }));

const toolActivities = computed(() =>
  audits.value
    .map((audit) => {
      const oldStock = audit.old?.stock ?? 0;
      const newStock = audit.new?.stock ?? 0;
      const diff = newStock - oldStock;
      return {
        ...audit,
        type: diff > 0 ? 'increase' : diff < 0 ? 'decrease' : 'no_change',
        amount: Math.abs(diff),
      };
    })
    .filter((audit) => audit.type !== 'no_change')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
);

onMounted(() => {
  getToolAudits();
  getToolCosts();
});

function getToolAudits() {
  api.post('/audits/tools', { from: from.value.toISO(), to: to.value.toISO() }).then((response) => {
    audits.value = response.data.slice(0, 50);
  });
}

const toolCosts = ref<{ today: number; yesterday: number }>({ today: 0, yesterday: 0 });

async function getToolCosts() {
  const now = DateTime.now();
  const startOfDay = now.startOf('day');
  let startOfYesterday = startOfDay.minus({ days: 1 });
  // Make yesterday Friday if today is a Monday
  if (now.weekday === 1) {
    startOfYesterday = startOfYesterday.minus({ days: 2 });
  }

  function calcCosts(response: { data: Audit[] }) {
    const audits: Audit[] = response.data;
    const costs: Record<string, number> = {};
    audits.forEach((audit) => {
      const toolId = audit.new._id;
      if (!costs[toolId]) {
        costs[toolId] = 0;
      }
      const oldStock = audit.old?.stock ?? 0;
      const newStock = audit.new?.stock ?? 0;
      const diff = newStock - oldStock;
      if (diff !== 0) {
        costs[toolId] += Math.abs(diff) * audit.new.cost;
      }
    });
    return costs;
  }

  const todayCosts = await api
    .post('/audits/tools', { from: startOfDay.toISO(), to: now.toISO() })
    .then(calcCosts);

  const yesterdayCosts = await api
    .post('/audits/tools', { from: startOfYesterday.toISO(), to: startOfDay.toISO() })
    .then(calcCosts);

  toolCosts.value = {
    today: Object.values(todayCosts).reduce((sum, cost) => sum + cost, 0),
    yesterday: Object.values(yesterdayCosts).reduce((sum, cost) => sum + cost, 0),
  };
}

function open(tool: Tool) {
  router.push({ name: 'viewTool', params: { id: tool._id } });
}
</script>

<style scoped>
.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px 12px;
}

/* Stats Header Section */
.stats-header {
  margin-bottom: 20px;
}

.stats-title {
  font-size: 22px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: #2c3e50;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.stat-card {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: 8px;
  padding: 14px 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.stat-card.highlight {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.stat-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.8;
  margin-bottom: 6px;
}

.stat-card.highlight .stat-label {
  opacity: 0.9;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

/* Activities Grid */
.activities-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 20px;
}

/* Activity Column */
.activity-column {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.column-title {
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
  padding: 0 4px;
}

.no-data {
  text-align: center;
  padding: 24px 12px;
  color: #95a5a6;
  font-size: 14px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #ecf0f1;
}

/* Activity Card */
.activity-card {
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e8eef5;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  overflow: hidden;
}

.activity-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-color: #d0dce6;
}

.card-content {
  padding: 12px;
}

.image-col {
  flex-shrink: 0;
}

.tool-image {
  max-width: 130px;
  height: 80px;
  border-radius: 6px;
  object-fit: cover;
}

.info-col {
  padding: 0 10px;
  min-width: 0;
  flex: 1;
}

.tool-description {
  font-size: 14px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 6px;
  line-height: 1.3;
  word-break: break-word;
}

.activity-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.amount {
  font-size: 13px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: -0.2px;
  white-space: nowrap;
}

.amount.increase {
  color: #27ae60;
  background: #d5f4e6;
}

.amount.decrease {
  color: #e74c3c;
  background: #fadbd8;
}

.stock-info {
  font-size: 12px;
  color: #7f8c8d;
  font-weight: 500;
}

.cost-badge {
  font-size: 12px;
  font-weight: 600;
  color: #667eea;
  background: #f0f3ff;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.timestamp {
  font-size: 11px;
  color: #95a5a6;
  font-weight: 400;
  line-height: 1.2;
}

.action-col {
  padding-left: 8px;
  flex-shrink: 0;
}

.action-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  transition: all 0.3s ease;
}

.action-btn:hover {
  transform: scale(1.15);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .activities-grid {
    grid-template-columns: 1fr;
  }

  .stats-value {
    font-size: 20px;
  }

  .tool-image {
    width: 70px;
    height: 70px;
  }

  .tool-description {
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .container {
    padding: 12px 8px;
  }

  .stats-title {
    font-size: 18px;
    margin-bottom: 10px;
  }

  .stats-grid {
    gap: 8px;
  }

  .stat-card {
    padding: 10px 12px;
  }

  .stat-value {
    font-size: 20px;
  }

  .card-content {
    padding: 10px;
  }

  .tool-image {
    width: 60px;
    height: 60px;
  }

  .info-col {
    padding: 0 8px;
  }
}
</style>
} .amount.increase { color: #27ae60; background: #d5f4e6; } .amount.decrease { color: #e74c3c;
background: #fadbd8; } .stock-info { font-size: 14px; color: #7f8c8d; font-weight: 500; } .timestamp
{ font-size: 13px; color: #95a5a6; font-weight: 400; margin-top: 4px; } .action-col { display: flex;
justify-content: flex-end; align-items: center; padding-left: 12px; } @media (max-width: 600px) {
.action-col { justify-content: flex-start; margin-top: 12px; border-top: 1px solid #ecf0f1;
padding-top: 12px; } } .action-btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
color: white; transition: all 0.3s ease; } .action-btn:hover { transform: scale(1.1); box-shadow: 0
4px 12px rgba(102, 126, 234, 0.4); } /* Responsive adjustments */ @media (max-width: 600px) {
.container { padding: 16px 12px; } .stats-title { font-size: 24px; margin-bottom: 16px; }
.stats-grid { grid-template-columns: 1fr; } .stat-value { font-size: 28px; } .section-title {
font-size: 18px; } .tool-description { font-size: 15px; } }
