import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
// Email sending removed — using browser notifications only

const app = new Hono()

// Enable CORS for development
app.use('*', cors())

// Database connection using mysql2/promise
const DB_HOST = process.env.DB_HOST || '127.0.0.1'
const DB_USER = process.env.DB_USER || 'root'
const DB_PASS = process.env.DB_PASS || ''
const DB_NAME = process.env.DB_NAME || 'cctv_db'

let pool: mysql.Pool
// SSE clients
const sseClients: Array<{ id: string; controller: ReadableStreamDefaultController }> = []
const encoder = new TextEncoder()

function broadcastEvent(payload: any) {
  const data = `data: ${JSON.stringify(payload)}\n\n`
  try {
    console.log('SSE broadcast', payload)
  } catch {}
  for (const c of sseClients) {
    try {
      c.controller.enqueue(encoder.encode(data))
    } catch (e) {
      // ignore enqueue errors
    }
  }
}

async function initDb() {
  pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true
  })

  // Create table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uid INT DEFAULT NULL,
      serviceType VARCHAR(50),
      contactPhone VARCHAR(50),
      deviceModel VARCHAR(255),
      problemDescription TEXT,
      status VARCHAR(50) DEFAULT 'กำลังส่งซ่อม',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX (uid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  // Create users table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      firstname VARCHAR(100) NOT NULL,
      lastname VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  // Try to add foreign key from requests.uid -> users.id (best-effort, ignore errors)
  try {
    await pool.query(`ALTER TABLE requests ADD COLUMN IF NOT EXISTS uid INT`)
  } catch (e) {
    // ignore
  }
  try {
    await pool.query(`ALTER TABLE requests ADD CONSTRAINT fk_requests_user FOREIGN KEY (uid) REFERENCES users(id) ON DELETE SET NULL`)
  } catch (e) {
    // ignore if constraint exists or fails
  }
  // Ensure legacy email_notifications column is removed if present
  try {
    await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS email_notifications`)
  } catch (e) {
    // ignore
  }
}

// Email notifications disabled — no-op helper retained for compatibility
async function sendEmailNotificationToUser(_uid: number, _requestId: number) {
  // Intentionally no-op: email sending removed in favor of browser notifications.
  console.log('Email notifications are disabled; skipping sendEmailNotificationToUser')
}

app.get('/', (c) => c.text('Hello Hono!'))

// SSE endpoint for updates
app.get('/api/updates', (c) => {
  const stream = new ReadableStream({
    start(controller) {
      const id = String(Date.now()) + Math.random().toString(36).slice(2)
      sseClients.push({ id, controller })
      // send a comment to establish connection
      controller.enqueue(encoder.encode(':ok\n\n'))
    },
    cancel() {
      // remove closed client(s)
      // filter out any controllers that are closed
      for (let i = sseClients.length - 1; i >= 0; i--) {
        try {
          // attempt to read property; if controller is closed this may throw in some runtimes
        } catch (e) {}
      }
      // cleanup by removing any clients whose controller.desiredSize is null (best-effort)
      for (let i = sseClients.length - 1; i >= 0; i--) {
        const cinfo = sseClients[i]
        if (!cinfo || !cinfo.controller) {
          sseClients.splice(i, 1)
        }
      }
    }
  })
  const headers = new Headers({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
  return new Response(stream, { status: 200, headers })
})

// List requests for authenticated user
app.get('/api/requests', async (c) => {
  try {
    const uidHeader = c.req.header('x-uid')
    if (!uidHeader) return c.json({ error: 'Unauthorized' }, 401)
    const uid = Number(uidHeader)
    const [rows] = await pool.query('SELECT * FROM requests WHERE uid = ? ORDER BY created_at DESC', [uid])
    return c.json(rows)
  } catch (err: any) {
    console.error(err)
    return c.json({ error: err.message || 'DB error' }, 500)
  }
})

// Get single request (only if belongs to authenticated user)
app.get('/api/requests/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    const uidHeader = c.req.header('x-uid')
    if (!uidHeader) return c.json({ error: 'Unauthorized' }, 401)
    const uid = Number(uidHeader)
    const [rows] = await pool.query('SELECT * FROM requests WHERE id = ? AND uid = ?', [id, uid])
    const results: any = rows
    if (results.length === 0) return c.json({ error: 'Not found' }, 404)
    return c.json(results[0])
  } catch (err: any) {
    console.error(err)
    return c.json({ error: err.message || 'DB error' }, 500)
  }
})

// Admin: list all requests (or filter by uid)
app.get('/api/admin/requests', async (c) => {
  try {
    const isAdmin = c.req.header('x-admin') === '1'
    if (!isAdmin) return c.json({ error: 'Forbidden' }, 403)
    const uidQ = c.req.query('uid')
    if (uidQ) {
      const uid = Number(uidQ)
      const [rows] = await pool.query('SELECT * FROM requests WHERE uid = ? ORDER BY created_at DESC', [uid])
      return c.json(rows)
    }
    const [rows] = await pool.query('SELECT * FROM requests ORDER BY created_at DESC')
    return c.json(rows)
  } catch (err: any) {
    console.error(err)
    return c.json({ error: err.message || 'DB error' }, 500)
  }
})

// Admin: list users
app.get('/api/admin/users', async (c) => {
  try {
    const isAdmin = c.req.header('x-admin') === '1'
    if (!isAdmin) return c.json({ error: 'Forbidden' }, 403)
    const [rows] = await pool.query('SELECT id, firstname, lastname, email FROM users ORDER BY id')
    return c.json(rows)
  } catch (err: any) {
    console.error(err)
    return c.json({ error: err.message || 'DB error' }, 500)
  }
})

// Create request (attached to authenticated user)
app.post('/api/requests', async (c) => {
  try {
    const body = await c.req.json()
    const { serviceType, customerName, contactPhone, deviceModel, problemDescription, status } = body
    const uidHeader = c.req.header('x-uid')
    if (!uidHeader) return c.json({ error: 'Unauthorized' }, 401)
    const uid = Number(uidHeader)
    // Validate Thai phone number: must start with 0 and have 10 digits
    const phone = (contactPhone || '').toString().trim()
    if (!/^0\d{9}$/.test(phone)) {
      return c.json({ error: 'Invalid Thai phone number' }, 400)
    }
    let res: any
    if (typeof status === 'undefined') {
      // omit status column so DB default is applied
      ;[res] = await pool.query(
        'INSERT INTO requests (uid, serviceType, contactPhone, deviceModel, problemDescription) VALUES (?, ?, ?, ?, ?)',
        [uid, serviceType, contactPhone, deviceModel, problemDescription]
      ) as any
    } else {
      ;[res] = await pool.query(
        'INSERT INTO requests (uid, serviceType, contactPhone, deviceModel, problemDescription, status) VALUES (?, ?, ?, ?, ?, ?)',
        [uid, serviceType, contactPhone, deviceModel, problemDescription, status]
      ) as any
    }
    const insertId = res.insertId
    // broadcast creation (optional)
    broadcastEvent({ type: 'created', id: insertId, uid, serviceType, status: status || 'กำลังส่งซ่อม' })
    return c.json({ id: insertId, message: 'ส่งคำขอสำเร็จ' }, 201)
  } catch (err: any) {
    console.error(err)
    return c.json({ error: err.message || 'DB error' }, 500)
  }
})

// Update request (only by owner)
app.put('/api/requests/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    const body = await c.req.json()
    const { serviceType, customerName, contactPhone, deviceModel, problemDescription, status } = body
    const uidHeader = c.req.header('x-uid')
    if (!uidHeader) return c.json({ error: 'Unauthorized' }, 401)
    const uid = Number(uidHeader)
    // validate phone if provided
    if (typeof contactPhone !== 'undefined') {
      const phone = (contactPhone || '').toString().trim()
      if (!/^0\d{9}$/.test(phone)) {
        return c.json({ error: 'Invalid Thai phone number' }, 400)
      }
    }

    // build dynamic update to avoid overwriting fields with null when not provided
    const sets: string[] = []
    const params: any[] = []
    if (typeof serviceType !== 'undefined') { sets.push('serviceType=?'); params.push(serviceType) }
    if (typeof contactPhone !== 'undefined') { sets.push('contactPhone=?'); params.push(contactPhone) }
    if (typeof deviceModel !== 'undefined') { sets.push('deviceModel=?'); params.push(deviceModel) }
    if (typeof problemDescription !== 'undefined') { sets.push('problemDescription=?'); params.push(problemDescription) }
    if (typeof status !== 'undefined') { sets.push('status=?'); params.push(status) }

    if (sets.length === 0) {
      return c.json({ id, message: 'no changes' })
    }

    const sql = `UPDATE requests SET ${sets.join(', ')} WHERE id=? AND uid=?`
    params.push(id)
    params.push(uid)
    await pool.query(sql, params)
    // if status was set to completed, broadcast
    if (typeof status !== 'undefined' && status === 'สำเร็จ') {
      broadcastEvent({ type: 'status', id, uid, status })
      // send email notification (async)
      sendEmailNotificationToUser(uid, id)
    }
    return c.json({ id, message: 'updated' })
  } catch (err: any) {
    console.error(err)
    return c.json({ error: err.message || 'DB error' }, 500)
  }
})

// Delete request (only by owner)
app.delete('/api/requests/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    const uidHeader = c.req.header('x-uid')
    if (!uidHeader) return c.json({ error: 'Unauthorized' }, 401)
    const uid = Number(uidHeader)
    await pool.query('DELETE FROM requests WHERE id = ? AND uid = ?', [id, uid])
    return c.json({ id, message: 'deleted' })
  } catch (err: any) {
    console.error(err)
    return c.json({ error: err.message || 'DB error' }, 500)
  }
})

// Admin delete any request
app.delete('/api/admin/requests/:id', async (c) => {
  try {
    const isAdmin = c.req.header('x-admin') === '1'
    if (!isAdmin) return c.json({ error: 'Forbidden' }, 403)
    const id = Number(c.req.param('id'))
    await pool.query('DELETE FROM requests WHERE id = ?', [id])
    return c.json({ id, message: 'deleted' })
  } catch (err: any) {
    console.error(err)
    return c.json({ error: err.message || 'DB error' }, 500)
  }
})

// Admin update any request
app.put('/api/admin/requests/:id', async (c) => {
  try {
    const isAdmin = c.req.header('x-admin') === '1'
    if (!isAdmin) return c.json({ error: 'Forbidden' }, 403)
    const id = Number(c.req.param('id'))
    const body = await c.req.json()
    const { serviceType, contactPhone, deviceModel, problemDescription, status, uid } = body
    const sets: string[] = []
    const params: any[] = []
    if (typeof serviceType !== 'undefined') { sets.push('serviceType=?'); params.push(serviceType) }
    if (typeof contactPhone !== 'undefined') { sets.push('contactPhone=?'); params.push(contactPhone) }
    if (typeof deviceModel !== 'undefined') { sets.push('deviceModel=?'); params.push(deviceModel) }
    if (typeof problemDescription !== 'undefined') { sets.push('problemDescription=?'); params.push(problemDescription) }
    if (typeof status !== 'undefined') { sets.push('status=?'); params.push(status) }
    if (typeof uid !== 'undefined') { sets.push('uid=?'); params.push(uid) }
    if (sets.length === 0) return c.json({ id, message: 'no changes' })
    const sql = `UPDATE requests SET ${sets.join(', ')} WHERE id=?`
    params.push(id)
    await pool.query(sql, params)
    // fetch updated row to get current uid and status
    try {
      const [rowsUpdated] = await pool.query('SELECT uid, status FROM requests WHERE id = ?', [id]) as any
      if (rowsUpdated && rowsUpdated.length) {
        const r = rowsUpdated[0]
        if (r.status === 'สำเร็จ') {
          broadcastEvent({ type: 'status', id, uid: r.uid, status: r.status })
          sendEmailNotificationToUser(r.uid, id)
        }
      }
    } catch (e) {
      // ignore
    }
    return c.json({ id, message: 'updated' })
  } catch (err: any) {
    console.error(err)
    return c.json({ error: err.message || 'DB error' }, 500)
  }
})

// Register endpoint
app.post('/api/register', async (c) => {
  try {
    const body = await c.req.json()
    const { firstname, lastname, email, password } = body
    if (!firstname || !lastname || !email || !password) return c.json({ error: 'Missing fields' }, 400)
    const [exists] = await pool.query('SELECT id FROM users WHERE email = ?', [email]) as any
    if (exists.length) return c.json({ error: 'Email already registered' }, 409)
    const hashed = await bcrypt.hash(password, 10)
    const [res] = await pool.query('INSERT INTO users (firstname, lastname, email, password) VALUES (?, ?, ?, ?)', [firstname, lastname, email, hashed]) as any
    const id = res.insertId
    return c.json({ id, firstname, lastname, email })
  } catch (err: any) {
    console.error(err)
    return c.json({ error: err.message || 'DB error' }, 500)
  }
})

// Login endpoint
app.post('/api/login', async (c) => {
  try {
    const body = await c.req.json()
    const { email, password } = body
    if (!email || !password) return c.json({ error: 'Missing fields' }, 400)
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]) as any
    if (!rows.length) return c.json({ error: 'Invalid credentials' }, 401)
    const user = rows[0]
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return c.json({ error: 'Invalid credentials' }, 401)
    return c.json({ id: user.id, firstname: user.firstname, lastname: user.lastname, email: user.email })
  } catch (err: any) {
    console.error(err)
    return c.json({ error: err.message || 'DB error' }, 500)
  }
})

// Email preference endpoint removed — server no longer tracks email notifications

// Initialize DB then start server
initDb()
  .then(() => {
    serve({ fetch: app.fetch, port: Number(process.env.PORT) || 3000 }, (info) => {
      console.log(`Server is running on http://localhost:${info.port}`)
    })
  })
  .catch((err) => {
    console.error('Failed to initialize DB', err)
    process.exit(1)
  })

