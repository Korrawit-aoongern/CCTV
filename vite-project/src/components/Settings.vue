<script setup>
import { ref } from 'vue'

function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
}

const sseEnabled = ref(localStorage.getItem('sse_notify') === '1')
const emailEnabled = ref(getUser()?.email_notifications === 1)
const status = ref('')

function toggleSSE() {
  sseEnabled.value = !sseEnabled.value
  localStorage.setItem('sse_notify', sseEnabled.value ? '1' : '0')
  // notify other windows/components
  try { window.dispatchEvent(new CustomEvent('sse-toggle', { detail: sseEnabled.value })) } catch (e) {}
}

async function toggleEmail() {
  const user = getUser()
  if (!user) { status.value = 'กรุณาเข้าสู่ระบบ'; return }
  const enabled = !emailEnabled.value
  try {
    const res = await fetch('http://localhost:3000/api/users/notify', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-uid': String(user.id) },
      body: JSON.stringify({ enabled })
    })
    if (!res.ok) throw new Error('Failed')
    emailEnabled.value = enabled
    // update stored user
    user.email_notifications = enabled ? 1 : 0
    localStorage.setItem('user', JSON.stringify(user))
    status.value = 'บันทึกแล้ว'
  } catch (e) {
    status.value = e.message || String(e)
  }
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
      <label>Browser Notifications (SSE)</label>
      <div>
        <label><input type="checkbox" v-model="sseEnabled" @change="toggleSSE"/> Enable</label>
      </div>
    </div>

    <div class="form-group">
      <label>Email Notifications</label>
      <div>
        <label><input type="checkbox" :checked="emailEnabled" @click="toggleEmail"/> Enabled</label>
      </div>
    </div>

    <div style="margin-top:12px">
      <button @click="requestPermission">Request Browser Notification Permission</button>
    </div>

    <div style="margin-top:8px;color:#333">{{ status }}</div>
  </div>
</template>

<style scoped>
.form-group { margin-bottom:12px }
label { font-weight:600 }
</style>
