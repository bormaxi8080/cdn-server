var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;
var yaml = require('js-yaml');

var loadYaml = function(path) {
    return yaml.safeLoad(fs.readFileSync(fs.realpathSync(path), 'utf8'));
};

var configPath = path.join(__dirname, '../config', process.env.NODE_ENV + '.yml');
var config = loadYaml(configPath);

var shellConnection = function(db) {
    var connString = (db.password ? 'PGPASSWORD=' + db.password + ' ': '');
    connString += 'psql -U ' + db.user + ' -h ' + db.host + ' -p ' + db.port;
    return connString;
};

var echoCmd = function(cmd) {
    return 'echo "' + cmd + '"';
};

var execDBCmd = function(cmd, connString, callback) {
    var rawCmd = echoCmd(cmd) + " | " + connString;
    console.log("SQL: %s", cmd);
    exec(rawCmd, function(err, stdout, stderr) {
        callback(stderr.match("ERROR") ? stderr : null);
    });
};

namespace('db', function() {
    var migratorConfig = {
        directory: path.normalize(path.join(__dirname, '../migrations'))
    };
    var connString = shellConnection(config.db);

    desc('Удаление базы данных');
    task('drop', [], function() {
        console.log("Dropping database");
        execDBCmd("DROP DATABASE IF EXISTS " + config.db.database, connString, function(err) {
            if (err) { throw new Error(err); }
            complete();
        });
    }, true);

    desc('Создание базы данных');
    task('init', [], function() {
        console.log("Initing database");
        execDBCmd("CREATE DATABASE " + config.db.database, connString, function(err) {
            if (err) { throw new Error(err); }
            complete();
        });
    }, true);

    namespace('migrate', function() {
        desc('Создание новой миграции - db:migrate:create[name]');
        task('create', [], function(name) {
            console.log("Creating new migration");
            var knex = require('../lib/db')(config.db);
            console.log("CREATING MIGRATION; NAME: %s; PATH: %s", name, migratorConfig.directory);
            knex.migrate.make(name, migratorConfig).exec(function(err, result) {
                if (err) {
                    console.log("ERROR CREATING MIGRATION: %s", err);
                } else {
                    console.log("MIGRATION CREATED: %s", result)
                }
                complete();
            });
        }, true);

        desc('Откат последней группы миграций');
        task('rollback', [], function(name) {
            console.log("Rolling back database migration");
            var knex = require('../lib/db')(config.db);
            knex.transaction(function(t) {
                return t.migrate.rollback(migratorConfig)
            }).then(function(err) {
                console.log("MIGRATION UNDONE OK");
                complete();
            }).catch(function(err) {
                console.log("ROLLBACK; UNDOING MIGRATIONS ERR: %s", err);
                complete();
            });
        }, true);
    });

    desc('Запуск миграций баз данных');
    task('migrate', [], function() {
        console.log("Migrating database");
        var knex = require('../lib/db')(config.db);
        knex.transaction(function(trx) {
            return trx.migrate.latest(migratorConfig)
        }).then(function(err) {
            console.log("MIGRATION OK");
            complete();
        }).catch(function(err) {
            console.log("ROLLBACK; MIGRATION ERR: %s", err);
            complete();
        });
    }, true);

    desc('Пересоздание баз данных');
    task('recreate', ['drop', 'init', 'migrate']);
});
