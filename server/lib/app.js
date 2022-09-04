var fs = require('fs');
var path = require('path');
var yaml = require('js-yaml');
var express = require('express');
//var morgan = require('morgan');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var domain = require('domain');

var app = module.exports = express();

var loadYaml = function(path) {
    return yaml.safeLoad(fs.readFileSync(fs.realpathSync(path), 'utf8'));
};

var config = loadYaml(path.join(__dirname, "../config", app.settings.env + ".yml"));

if (config.files_dir.substr(0, 1) == '.') {
    config.files_dir = path.join(__dirname, config.files_dir);
}

app.set('config', config);
app.set('db', require('./db')(config.db));

app.use(function(req, res, next) {
    var d = domain.create();
    d.on('error', function(err) {
        console.log('DOMAIN ERROR:');
        console.log(err.stack);
        res.json(500, {error: "internal error"});
    });

    d.add(req);
    d.add(res);

    d.run(function() {
        next();
    });
});

app.use(methodOverride('_method'));
//app.use(morgan());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));


app.use('/project', require('./project').router);
app.use('/crud', require('./crud')('projects'));
//app.use('/crud', require('./crud')('files'));
//app.use('/crud', require('./crud')('versions'));

app.run = function() {
    var port = process.env.PORT || config.port;
    app.listen(port, function() {
        console.log("Server listening on port " + port);
    });
};