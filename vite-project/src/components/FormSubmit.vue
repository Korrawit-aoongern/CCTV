<script setup>
import { reactive, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const form = reactive({
    serviceType: '',
    contactPhone: '',
    deviceModel: '',
    problemDescription: ''
})

const sending = ref(false)

const modal = reactive({
    visible: false,
    title: 'สถานะ',
    message: '',
    loading: false
})

function openModal(title, message, loading = false) {
    modal.title = title
    modal.message = message
    modal.loading = loading
    modal.visible = true
}

function closeModal() {
    modal.visible = false
}

function getUser() {
    try {
        return JSON.parse(localStorage.getItem('user') || 'null')
    } catch {
        return null
    }
}

function logout() {
    localStorage.removeItem('user')
    router.push('/')
}

onMounted(() => {
    const u = getUser()
    if (!u) router.push('/')
})

const user = ref(null)
onMounted(() => {
    user.value = getUser()
    // dynamic SSE handling
    let es = null
    function handleMessage(e) {
        try {
            const d = JSON.parse(e.data)
            console.debug('SSE received', d)
            if (d && d.uid && user.value && d.uid === user.value.id && d.status === 'สำเร็จ') {
                if (Notification.permission === 'granted') {
                    new Notification('คำขอเสร็จสิ้น', { body: `คำขอ No.${d.id} ถูกทำเครื่องหมายว่าสำเร็จ` })
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

    // Start if enabled at mount
    try { if (localStorage.getItem('sse_notify') === '1') startSSE() } catch (e) {}

    // listen for toggle events
    const toggleHandler = (ev) => { if (ev && ev.detail) startSSE(); else stopSSE() }
    window.addEventListener('sse-toggle', toggleHandler)

    onUnmounted(() => { stopSSE(); window.removeEventListener('sse-toggle', toggleHandler) })
})

async function submitForm() {
    if (!form.serviceType || !form.contactPhone || !form.problemDescription) {
        openModal('ข้อผิดพลาด', 'กรุณากรอกข้อมูลให้ครบถ้วน')
        return
    }

    const user = getUser()
    if (!user) {
        openModal('ข้อผิดพลาด', 'ผู้ใช้ไม่ได้เข้าสู่ระบบ')
        return
    }

    sending.value = true
    openModal('กำลังส่งคำขอ', 'กำลังส่งซ่อม... กรุณารอสักครู่', true)

    try {
        // Validate Thai phone number (start with 0 and 10 digits)
        const phone = (form.contactPhone || '').toString().trim()
        if (!/^0\d{9}$/.test(phone)) {
            throw new Error('กรุณากรอกหมายเลขโทรศัพท์ไทยให้ถูกต้อง (10 หลัก เริ่มต้นด้วย 0)')
        }
        const res = await fetch('http://localhost:3000/api/requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-uid': String(user.id) },
            body: JSON.stringify(form)
        })

        if (!res.ok) throw new Error(`Server error ${res.status}`)

        const data = await res.json()

        modal.loading = false
        modal.title = 'ส่งสำเร็จ'
        modal.message = data.message || 'แบบฟอร์มถูกส่งเรียบร้อยแล้ว'

        // clear form
        form.serviceType = ''
        form.contactPhone = ''
        form.deviceModel = ''
        form.problemDescription = ''
    } catch (err) {
        modal.loading = false
        modal.title = 'เกิดข้อผิดพลาด'
        modal.message = err.message || 'ไม่สามารถส่งคำขอได้'
    } finally {
        sending.value = false
    }
}
</script>

<template>
    <div id="app">
                <header class="site-header">
                        <div style="display:flex; justify-content:space-evenly; align-items:center">
                            <div>
                                <h1>ศูนย์บริการซ่อมมือถือและติดตั้งกล้อง</h1>
                                <p>แจ้งซ่อมโทรศัพท์มือถือ หรือนัดหมายติดตั้งกล้องรักษาความปลอดภัย</p>
                            </div>
                            <div style="text-align:right;">
                                    <div style="font-weight:700">{{ user && user.firstname ? user.firstname : '' }} {{ user && user.lastname ? user.lastname : '' }}</div>
                                <button @click="logout" style="margin-top:6px; background:#b00020; padding:6px 10px; border-radius:8px">ออกจากระบบ</button>
                            </div>
                        </div>
                </header>

        <main>
            <div class="form-container">
                <h2>แบบฟอร์มแจ้งซ่อม / บริการ</h2>

                <form @submit.prevent="submitForm" novalidate>
                    <div class="form-group">
                        <label for="serviceType">เลือกประเภทบริการ:</label>
                        <select id="serviceType" v-model="form.serviceType" required>
                            <option value="">-- กรุณาเลือก --</option>
                            <option value="phoneRepair">ซ่อมโทรศัพท์มือถือ</option>
                            <option value="cameraInstall">ติดตั้งกล้องรักษาความปลอดภัย</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="contactPhone">เบอร์โทรศัพท์ติดต่อ:</label>
                        <input id="contactPhone" v-model="form.contactPhone" type="tel" pattern="[0-9]{9,10}"
                            required />
                    </div>

                    <div class="form-group">
                        <label for="deviceModel">รุ่นโทรศัพท์/อุปกรณ์:</label>
                        <input id="deviceModel" v-model="form.deviceModel" type="text" />
                    </div>

                    <div class="form-group">
                        <label for="problemDescription">รายละเอียดอาการ/ความต้องการ:</label>
                        <textarea id="problemDescription" v-model="form.problemDescription" rows="5"
                            required></textarea>
                    </div>

                    <div class="actions">
                        <button type="submit" :disabled="sending">ส่งคำขอรับบริการ</button>
                    </div>
                </form>

            </div>
        </main>

        <footer class="site-footer">
            <p>&copy; 2025 Tech Service Management</p>
        </footer>

        <!-- Modal -->
        <div class="modal-backdrop" v-if="modal.visible">
            <div class="modal" :class="{ loading: modal.loading }">
                <h3>{{ modal.title }}</h3>
                <p>{{ modal.message }}</p>
                <div class="spinner" v-if="modal.loading" aria-hidden="true"></div>
                <div class="modal-actions" v-if="!modal.loading">
                    <button @click="closeModal">ปิด</button>
                </div>
            </div>
        </div>
        <!-- Floating submit button -->
        <button class="fab-submit" @click="submitForm" :disabled="sending" aria-label="ส่งคำขอ">
            ส่ง
        </button>
    </div>
</template>

<style scoped>
:root {
    --accent: #1976d2;
    --accent-2: #0b63b8;
    --bg: #eef5fb;
    --card: #ffffff;
    --muted: #6b7b8a;
}

* {
    box-sizing: border-box
}

body {
    font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans Thai', Arial;
    line-height: 1.45;
    margin: 0;
    background: linear-gradient(180deg, var(--bg), #f9fbff);
    color: #16202a;
    -webkit-font-smoothing: antialiased;
}

.site-header {
    background: linear-gradient(90deg, var(--accent), var(--accent-2));
    padding: 32px 18px;
    text-align: center;
    box-shadow: 0 6px 18px rgba(11, 99, 184, 0.12);
}

.site-header h1 {
    margin: 0 0 6px;
    font-size: 24px;
    font-weight: 700
}

.site-header p {
    margin: 0;
}

.form-container {
    max-width: 820px;
    margin: 32px auto;
    padding: 28px;
    background: var(--card);
    border-radius: 12px;
    box-shadow: 0 12px 40px rgba(16, 32, 64, 0.07);
    border: 1px solid rgba(15, 35, 60, 0.03);
}

.form-container h2 {
    margin-top: 0;
    font-size: 20px
}

.form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px
}

.form-group {
    display: flex;
    flex-direction: column;
    margin-bottom: 14px
}

.form-group label {
    font-weight: 600;
    margin-bottom: 8px;
    color: #163247
}

.form-group input,
.form-group select,
.form-group textarea {
    padding: 12px 14px;
    border: 1px solid #e3edf8;
    border-radius: 10px;
    font-size: 15px;
    background: linear-gradient(180deg, #fff, #fbfdff);
    transition: box-shadow .15s ease, border-color .15s ease, transform .08s ease;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 6px 20px rgba(25, 118, 210, 0.12);
    transform: translateY(-1px);
}

.form-group textarea {
    min-height: 120px;
    resize: vertical
}

.actions {
    display: flex;
    justify-content: flex-end
}

button {
    background: #0b63b8;
    border: none;
    padding: 10px 16px;
    border-radius: 10px;
    cursor: pointer;
    box-shadow: 0 6px 18px rgba(25, 118, 210, 0.18);
    transition: transform .12s ease, box-shadow .12s ease;
    font-weight: bold;
    color: white;
}

button:hover {
    transform: translateY(-2px)
}

button[disabled] {
    opacity: 0.6;
    cursor: default;
    transform: none
}

.note {
    margin-top: 12px;
    color: var(--muted);
    font-size: 13px
}

.site-footer {
    text-align: center;
    padding: 18px 0;
    color: var(--muted)
}

/* Modal */
.modal-backdrop {
    position: fixed;
    inset: 0;
    background: linear-gradient(rgba(6, 18, 30, 0.45), rgba(6, 18, 30, 0.45));
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
    padding: 20px
}

.modal {
    background: white;
    padding: 26px 22px;
    max-width: 480px;
    width: 100%;
    border-radius: 14px;
    box-shadow: 0 20px 60px rgba(9, 20, 40, 0.36);
    text-align: center;
    transform: translateY(-6px) scale(0.98);
    opacity: 0;
    transition: transform .26s cubic-bezier(.2, .9, .3, 1), opacity .22s ease;
}

.modal.loading {
    padding-bottom: 34px
}

.modal-backdrop .modal {
    transform: translateY(0) scale(1);
    opacity: 1
}

.modal h3 {
    margin: 0 0 8px;
    font-size: 18px
}

.modal p {
    margin: 0 0 14px;
    color: #283842
}

.modal-actions {
    display: flex;
    gap: 8px;
    justify-content: center
}

.modal-actions button {
    background: #2b6cb0;
    padding: 8px 12px;
    border-radius: 8px
}

.spinner {
    width: 44px;
    height: 44px;
    margin: 10px auto 14px;
    border-radius: 50%;
    border: 4px solid rgba(15, 35, 60, 0.08);
    border-top-color: var(--accent);
    animation: spin 1s linear infinite
}

@keyframes spin {
    to {
        transform: rotate(360deg)
    }
}

/* Floating submit button */
.fab-submit {
    position: fixed;
    bottom: 22px;
    right: 22px;
    background: linear-gradient(180deg, var(--accent), var(--accent-2));
    color: #fff;
    border: none;
    width: 58px;
    height: 58px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    box-shadow: 0 12px 36px rgba(11, 99, 184, 0.18);
    cursor: pointer
}

.fab-submit[disabled] {
    opacity: 0.6;
    cursor: default
}

@media (max-width:900px) {
    .form-grid {
        grid-template-columns: 1fr
    }
}

@media (max-width:600px) {
    .form-container {
        margin: 16px;
        padding: 16px
    }

    .site-header h1 {
        font-size: 20px
    }
}
</style>
