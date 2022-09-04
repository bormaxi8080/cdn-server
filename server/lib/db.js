var knex = require('knex');

var connectionString = function(db) {
    return [
        'postgres://', db.user, (db.password ? ':' + db.password : ''),
        '@', db.host, (db.port ? ':' + db.port : ''),
        '/', db.database
    ].join('');
};

var expand = function(data) {
    var counter = 0;
    return data.sql.replace(/\?/g, function() {
        return data.bindings[counter++];
    });
};

module.exports = function(config) {
    var db = knex({
        client: 'pg',
        connection: connectionString(config)
    });

    db.on('query', function(data) {
        console.log("SQL: %s", expand(data));
    });

    return db;
};
