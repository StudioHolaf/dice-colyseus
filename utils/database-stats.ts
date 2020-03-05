const mysql = require('mysql');
const connexion = mysql.createConnection({
    host: 'db4free.net',
    user: 'dice_stats',
    password: 'Hmermbxk17',
    database: 'dice_stats'
});
connexion.connect((err) => {
    if (err) throw err;
    console.log('Connected!');
});

module.exports = {
    'connexion': connexion,
};