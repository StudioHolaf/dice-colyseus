const mysql = require('mysql');
const connexion = mysql.createConnection({
    host: 'dt152773-001.privatesql',
    port: '35661',
    user: 'dicedbmaster',
    password: 'yhikDoC7',
    database: 'dicedb'
});
connexion.connect((err) => {
    if (err) throw err;
    console.log('Connected!');
});

module.exports = {
    'connexion': connexion,
};