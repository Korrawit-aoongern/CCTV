import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import mysql from 'mysql2/promise'

const app = new Hono()

// Enable CORS for development
app.use('*', cors())

// Database connection using mysql2/promise
const DB_HOST = process.env.DB_HOST || '127.0.0.1'
const DB_USER = process.env.DB_USER || 'root'
const DB_PASS = process.env.DB_PASS || ''
const DB_NAME = process.env.DB_NAME || 'cctv_db'

let pool: mysql.Pool

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
      serviceType VARCHAR(50),
      customerName VARCHAR(255),
      contactPhone VARCHAR(50),
      deviceModel VARCHAR(255),
      problemDescription TEXT,
      status VARCHAR(50) DEFAULT 'กำลังส่งซ่อม',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)
}

app.get('/', (c) => c.text('Hello Hono!'))

// List all requests
app.get('/api/requests', async (c) => {
  try {
    const [rows] = await pool.query('SELECT * FROM requests ORDER BY created_at DESC')
    return c.json(rows)
  } catch (err: any) {
    console.error(err)
    return c.json({ error: err.message || 'DB error' }, 500)
  }
})

// Get single request
app.get('/api/requests/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    const [rows] = await pool.query('SELECT * FROM requests WHERE id = ?', [id])
    const results: any = rows
    if (results.length === 0) return c.json({ error: 'Not found' }, 404)
    return c.json(results[0])
  } catch (err: any) {
    console.error(err)
    return c.json({ error: err.message || 'DB error' }, 500)
  }
})

// Create request
app.post('/api/requests', async (c) => {
  try {
    const body = await c.req.json()
    const { serviceType, customerName, contactPhone, deviceModel, problemDescription, status } = body
    let res: any
    if (typeof status === 'undefined') {
      // omit status column so DB default is applied
      ;[res] = await pool.query(
        'INSERT INTO requests (serviceType, customerName, contactPhone, deviceModel, problemDescription) VALUES (?, ?, ?, ?, ?)',
        [serviceType, customerName, contactPhone, deviceModel, problemDescription]
      ) as any
    } else {
      ;[res] = await pool.query(
        'INSERT INTO requests (serviceType, customerName, contactPhone, deviceModel, problemDescription, status) VALUES (?, ?, ?, ?, ?, ?)',
        [serviceType, customerName, contactPhone, deviceModel, problemDescription, status]
      ) as any
    }
    const insertId = res.insertId
    return c.json({ id: insertId, message: 'created' }, 201)
  } catch (err: any) {
    console.error(err)
    return c.json({ error: err.message || 'DB error' }, 500)
  }
})

// Update request
app.put('/api/requests/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    const body = await c.req.json()
    const { serviceType, customerName, contactPhone, deviceModel, problemDescription, status } = body
    // build dynamic update to avoid overwriting fields with null when not provided
    const sets: string[] = []
    const params: any[] = []
    if (typeof serviceType !== 'undefined') { sets.push('serviceType=?'); params.push(serviceType) }
    if (typeof customerName !== 'undefined') { sets.push('customerName=?'); params.push(customerName) }
    if (typeof contactPhone !== 'undefined') { sets.push('contactPhone=?'); params.push(contactPhone) }
    if (typeof deviceModel !== 'undefined') { sets.push('deviceModel=?'); params.push(deviceModel) }
    if (typeof problemDescription !== 'undefined') { sets.push('problemDescription=?'); params.push(problemDescription) }
    if (typeof status !== 'undefined') { sets.push('status=?'); params.push(status) }

    if (sets.length === 0) {
      return c.json({ id, message: 'no changes' })
    }

    params.push(id)
    const sql = `UPDATE requests SET ${sets.join(', ')} WHERE id=?`
    await pool.query(sql, params)
    return c.json({ id, message: 'updated' })
  } catch (err: any) {
    console.error(err)
    return c.json({ error: err.message || 'DB error' }, 500)
  }
})

// Delete request
app.delete('/api/requests/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    await pool.query('DELETE FROM requests WHERE id = ?', [id])
    return c.json({ id, message: 'deleted' })
  } catch (err: any) {
    console.error(err)
    return c.json({ error: err.message || 'DB error' }, 500)
  }
})

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

