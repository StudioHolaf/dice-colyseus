const mysql = require('mysql');
const connexion = mysql.createConnection({
    host: 'dt152773-002.dbaas.ovh.net',
    port: '35888',
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