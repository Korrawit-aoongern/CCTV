<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const mode = ref('login') // or 'register'
const form = reactive({
  firstname: '',
  lastname: '',
  email: '',
  password: '',
  confirm: ''
})

const loading = ref(false)
const error = ref('')

function saveUser(user) {
  localStorage.setItem('user', JSON.stringify(user))
}

async function submit() {
  error.value = ''
  loading.value = true
  try {
    if (mode.value === 'register') {
      if (!form.firstname || !form.lastname || !form.email || !form.password || !form.confirm) {
        error.value = 'กรุณากรอกข้อมูลให้ครบ'
        return
      }
      if (form.password !== form.confirm) {
        error.value = 'รหัสผ่านไม่ตรงกัน'
        return
      }
      const res = await fetch('http://localhost:3000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstname: form.firstname, lastname: form.lastname, email: form.email, password: form.password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Register failed')
      saveUser({ id: data.id, firstname: data.firstname, lastname: data.lastname, email: data.email })
      router.push('/submit')
    } else {
      if (!form.email || !form.password) {
        error.value = 'กรุณากรอกอีเมลและรหัสผ่าน'
        return
      }
      const res = await fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      saveUser({ id: data.id, firstname: data.firstname, lastname: data.lastname, email: data.email })
      router.push('/submit')
    }
  } catch (e) {
    error.value = e.message || String(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <h2 v-if="mode === 'login'">เข้าสู่ระบบ</h2>
      <h2 v-else>ลงทะเบียน</h2>

      <div class="tabs">
        <button :class="{active: mode === 'login'}" @click="mode='login'">Login</button>
        <button :class="{active: mode === 'register'}" @click="mode='register'">Register</button>
      </div>

      <div class="form">
        <div v-if="mode === 'register'">
          <label>ชื่อ</label>
          <input v-model="form.firstname" />
          <label>นามสกุล</label>
          <input v-model="form.lastname" />
        </div>

        <label>อีเมล</label>
        <input v-model="form.email" type="email" />

        <label>รหัสผ่าน</label>
        <input v-model="form.password" type="password" />

        <div v-if="mode === 'register'">
          <label>ยืนยันรหัสผ่าน</label>
          <input v-model="form.confirm" type="password" />
        </div>

        <div class="error" v-if="error">{{ error }}</div>

        <div class="actions">
          <button @click="submit" :disabled="loading">{{ mode === 'login' ? 'เข้าสู่ระบบ' : 'ลงทะเบียน' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page { display:flex; align-items:center; justify-content:center; min-height:80vh }
.auth-card { background:white; padding:20px; border-radius:10px; width:360px; box-shadow:0 10px 30px rgba(0,0,0,0.06) }
.tabs { display:flex; gap:8px; margin-bottom:12px }
.tabs button { flex:1; padding:8px; border-radius:8px; border:1px solid #e6eef8; background:#f8fbff }
.tabs button.active { background:#0b63b8; color:white }
.form label { display:block; margin-top:8px; font-weight:600 }
.form input { width:100%; padding:8px; border-radius:8px; border:1px solid #e6eef8 }
.actions { margin-top:12px; text-align:right }
.error { color: #b00020; margin-top:8px }
</style>