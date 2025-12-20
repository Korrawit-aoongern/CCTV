<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const items = ref([])
const loading = ref(false)
const error = ref(null)

const editItem = reactive({ visible: false, data: null })

function getUser() {
    try {
        return JSON.parse(localStorage.getItem('user') || 'null')
    } catch {
        return null
    }
}

function serviceTypeLabel(key) {
    if (!key) return ''
    if (key === 'phoneRepair') return 'ซ่อมโทรศัพท์มือถือ'
    if (key === 'cameraInstall') return 'ติดตั้งกล้องรักษาความปลอดภัย'
    return key
}

async function fetchItems() {
    loading.value = true
    error.value = null
    try {
        const user = getUser()
        if (!user) {
            router.push('/')
            return
        }
        const res = await fetch('http://localhost:3000/api/requests', { headers: { 'x-uid': String(user.id) } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        items.value = await res.json()
    } catch (err) {
        error.value = err.message || String(err)
    } finally {
        loading.value = false
    }
}

onMounted(() => fetchItems())

// dynamic SSE handling
onMounted(() => {
    let es = null
    function handleMessage(e) {
        try {
            const d = JSON.parse(e.data)
            console.debug('SSE received', d)
            const user = getUser()
            if (d && d.uid && user && d.uid === user.id && d.status === 'สำเร็จ') {
                if (Notification.permission === 'granted') {
                    new Notification('คำขอเสร็จสิ้น', { body: `คำขอ No.${d.id} เสร็จสิ้น` })
                }
            }
        } catch (err) { console.debug('SSE parse error', err) }
    }
    function startSSE() {
        if (es) return
        try {
            if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
                Notification.requestPermission()
            }
            es = new EventSource('http://localhost:3000/api/updates')
            es.onmessage = handleMessage
            es.onerror = (ev) => console.debug('SSE error', ev)
            console.debug('SSE started')
        } catch (e) { console.debug('SSE start failed', e) }
    }
    function stopSSE() {
        if (!es) return
        try { es.close(); console.debug('SSE stopped') } catch (e) {}
        es = null
    }

    try { if (localStorage.getItem('sse_notify') === '1') startSSE() } catch (e) {}

    const toggleHandler = (ev) => { if (ev && ev.detail) startSSE(); else stopSSE() }
    window.addEventListener('sse-toggle', toggleHandler)

    onUnmounted(() => { stopSSE(); window.removeEventListener('sse-toggle', toggleHandler) })
})
</script>

<template>
    <div class="form-view">
        <h2>ดูแบบฟอร์ม</h2>

        <div v-if="loading">กำลังโหลด...</div>
        <div v-if="error" class="error">เกิดข้อผิดพลาด: {{ error }}</div>

        <table v-if="items.length" class="list-table">
            <thead>
                <tr>
                    <th>No.</th>
                    <th>ประเภท</th>
                    <th>เบอร์ติดต่อ</th>
                    <th>อุปกรณ์</th>
                    <th>สถานะ</th>
                    <th>วันที่</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(it, index) in items" :key="it.id">
                    <td>{{ index + 1 }}</td>
                    <td>{{ serviceTypeLabel(it.serviceType) }}</td>
                    <td>{{ it.contactPhone }}</td>
                    <td>{{ it.deviceModel }}</td>
                    <td>{{ it.status }}</td>
                    <td>{{ new Date(it.created_at).toLocaleString() }}</td>
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

.modal .form-group {
    margin-bottom: 10px
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
</style>
