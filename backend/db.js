import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'ai_saas',
    password: 'swaroop123',
    port: 5432,
})

export default pool
