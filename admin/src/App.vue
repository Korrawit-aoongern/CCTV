<script setup>
import { ref, reactive, onMounted } from 'vue'

// data list + loading/error
const items = ref([])
const loading = ref(false)
const error = ref(null)

// edit modal
const editItem = reactive({ visible: false, data: null })

// simple auth state
const auth = reactive({ username: '', password: '', authenticated: false })

function saveSession() {
    try { localStorage.setItem('admin_auth', '1') } catch {}
}

function clearSession() {
    try { localStorage.removeItem('admin_auth') } catch {}
}

function restoreSession() {
    try { auth.authenticated = localStorage.getItem('admin_auth') === '1' } catch { auth.authenticated = false }
}

async function fetchItems() {
    if (!auth.authenticated) return
    loading.value = true
    error.value = null
    try {
        const res = await fetch('http://localhost:3000/api/requests')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        items.value = await res.json()
    } catch (err) {
        error.value = err.message || String(err)
    } finally {
        loading.value = false
    }
}

async function removeItem(id) {
    if (!confirm('ลบรายการนี้หรือไม่?')) return
    try {
        const res = await fetch(`http://localhost:3000/api/requests/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error(`Delete failed ${res.status}`)
        await fetchItems()
    } catch (err) {
        alert('ไม่สามารถลบข้อมูล: ' + err.message)
    }
}

function openEdit(item) {
    editItem.data = { ...item }
    editItem.visible = true
}

async function saveEdit() {
    try {
        const id = editItem.data.id
        const res = await fetch(`http://localhost:3000/api/requests/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editItem.data)
        })
        if (!res.ok) throw new Error(`Save failed ${res.status}`)
        editItem.visible = false
        await fetchItems()
    } catch (err) {
        alert('ไม่สามารถบันทึก: ' + err.message)
    }
}

function login() {
    const user = (auth.username || '').trim()
    const pass = auth.password || ''
    if (user === 'admin' && pass === '123') {
        auth.authenticated = true
        saveSession()
        auth.password = ''
        fetchItems()
    } else {
        alert('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
    }
}

function logout() {
    auth.authenticated = false
    clearSession()
}

onMounted(() => {
    restoreSession()
    if (auth.authenticated) fetchItems()
})
</script>

<template>
    <div class="form-view">
        <!-- if not authenticated show login -->
        <div v-if="!auth.authenticated" class="login-card">
            <h2>ผู้ดูแลระบบ เข้าสู่ระบบ</h2>
            <div class="form-group">
                <label>ชื่อผู้ใช้</label>
                <input v-model="auth.username" placeholder="" />
            </div>
            <div class="form-group">
                <label>รหัสผ่าน</label>
                <input v-model="auth.password" type="password" placeholder="" />
            </div>
            <div class="modal-actions">
                <button @click="login">เข้าสู่ระบบ</button>
            </div>
        </div>

        <!-- authenticated view -->
        <div v-else>
            <header class="site-header">
                <h1>หลังบ้านแอดมินศูนย์บริการซ่อมมือถือและติดตั้งกล้อง</h1>
                <div style="margin-top:8px">
                    <button @click="logout">ออกจากระบบ</button>
                </div>
            </header>
            <h2>ดูแบบฟอร์ม</h2>

            <div v-if="loading">กำลังโหลด...</div>
            <div v-if="error" class="error">เกิดข้อผิดพลาด: {{ error }}</div>

            <table v-if="items.length" class="list-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>ประเภท</th>
                        <th>ลูกค้า</th>
                        <th>เบอร์ติดต่อ</th>
                        <th>อุปกรณ์</th>
                        <th>สถานะ</th>
                        <th>วันที่</th>
                        <th>การกระทำ</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="it in items" :key="it.id">
                        <td>{{ it.id }}</td>
                        <td>{{ it.serviceType }}</td>
                        <td>{{ it.customerName }}</td>
                        <td>{{ it.contactPhone }}</td>
                        <td>{{ it.deviceModel }}</td>
                        <td>{{ it.status }}</td>
                        <td>{{ new Date(it.created_at).toLocaleString() }}</td>
                        <td>
                            <button @click="openEdit(it)">แก้ไข</button>
                            <button @click="removeItem(it.id)">ลบ</button>
                        </td>
                    </tr>
                </tbody>
            </table>

            <div v-if="!items.length && !loading">ยังไม่มีรายการ</div>

            <!-- Edit Modal -->
            <div class="modal-backdrop" v-if="editItem.visible">
                <div class="modal">
                    <h3>แก้ไขรายการ {{ editItem.data.id }}</h3>

                    <div class="form-group">
                        <label>ประเภท</label>
                        <select v-model="editItem.data.serviceType">
                            <option value="phoneRepair">ซ่อมโทรศัพท์มือถือ</option>
                            <option value="cameraInstall">ติดตั้งกล้องรักษาความปลอดภัย</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>ชื่อ</label>
                        <input v-model="editItem.data.customerName" />
                    </div>

                    <div class="form-group">
                        <label>เบอร์โทร</label>
                        <input v-model="editItem.data.contactPhone" />
                    </div>

                    <div class="form-group">
                        <label>รุ่น</label>
                        <input v-model="editItem.data.deviceModel" />
                    </div>

                    <div class="form-group">
                        <label>รายละเอียด</label>
                        <textarea v-model="editItem.data.problemDescription" rows="4"></textarea>
                    </div>

                    <div class="form-group">
                        <label>สถานะ</label>
                        <select v-model="editItem.data.status">
                            <option value="กำลังส่งซ่อม">กำลังส่งซ่อม</option>
                            <option value="สำเร็จ">สำเร็จ</option>
                            <option value="ถูกยกเลิก">ถูกยกเลิก</option>
                        </select>
                    </div>

                    <div class="modal-actions">
                        <button @click="saveEdit">บันทึก</button>
                        <button @click="() => (editItem.visible = false)">ยกเลิก</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.form-view {
    max-width: 1000px;
    margin: 20px auto
}

.list-table {
    width: 100%;
    border-collapse: collapse
}

.list-table th,
.list-table td {
    border: 1px solid #e6eef8;
    padding: 8px;
    text-align: left
}

.list-table th {
    background: #f5f9ff
}

.modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(6, 18, 30, 0.45);
    display: flex;
    align-items: center;
    justify-content: center
}

.modal {
    background: white;
    padding: 18px;
    border-radius: 10px;
    max-width: 680px;
    width: 100%
}

.form-group {
  margin: 1em;
  display: flex;
  flex-direction: row;
}

.form-group label {
  width: 128px;
}

.form-group input {
  margin-left: 24px;
}

.modal .form-group {
    margin-bottom: 16px;
}

.modal-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 8px
}

button {
    background: #2b6cb0;
    color: #fff;
    border: none;
    padding: 6px 10px;
    border-radius: 6px
}

.login-card {
    max-width: 420px;
    margin: 40px auto;
    padding: 18px;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 6px 18px rgba(20,30,40,0.08);
}

.site-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
</style>
