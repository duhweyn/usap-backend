const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',        // your MySQL Workbench root password goes here
  database: 'usap_db',
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;
