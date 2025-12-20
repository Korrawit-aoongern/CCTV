<script setup>
import { ref } from 'vue'

function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
}

const sseEnabled = ref(localStorage.getItem('sse_notify') === '1')
const status = ref('')

function toggleSSE() {
  // `v-model` already updated `sseEnabled`; just persist and notify
  localStorage.setItem('sse_notify', sseEnabled.value ? '1' : '0')
  // Request permission when enabling
  try {
    if (sseEnabled.value && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      Notification.requestPermission().catch(() => {})
    }
  } catch (e) {}
  // notify other windows/components
  try { console.debug('sse-toggle dispatch', sseEnabled.value); window.dispatchEvent(new CustomEvent('sse-toggle', { detail: sseEnabled.value })) } catch (e) {}
}


async function requestPermission() {
  if (typeof Notification === 'undefined') { status.value = 'Browser does not support Notifications'; return }
  const p = await Notification.requestPermission()
  status.value = `Permission: ${p}`
}
</script>

<template>
  <div>
    <h2>การตั้งค่า</h2>
    <div class="form-group">
      <label>แจ้งเตือนจากเบราว์เซอร์ (SSE)</label>
      <div>
        <label><input type="checkbox" v-model="sseEnabled" @change="toggleSSE"/> เปิดใช้งาน</label>
      </div>
    </div>

    <!-- Email notifications removed; using browser notifications (SSE) only -->

    <div style="margin-top:12px">
      <button @click="requestPermission">ขออนุญาตการแจ้งเตือนจากเบราว์เซอร์</button>
    </div>

    <div style="margin-top:8px;color:#333">{{ status }}</div>
  </div>
</template>

<style scoped>
.form-group { margin-bottom:12px }
label { font-weight:600 }
</style>
