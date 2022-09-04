var express = require('express');
var _ = require('lodash');

var app = require('./app');
var db = app.get('db');

module.exports = function(tableName) {
    var router = express.Router({strict: false});

    router.get('/'+tableName, function(req, res) {
        db(tableName).select().then(function(items) {
            res.json(items);
        });
    });

    router.get('/'+tableName+'/:id', function(req, res) {
        db(tableName).where({id: req.params.id}).select().then(function(items) {
            if (items.length > 0) {
                res.json(items[0]);
            } else {
                res.json(false);
            }
        });
    });

    router.post('/'+tableName, function(req, res) {
        var fields = _.clone(req.body);
        fields.created_at = new Date;
        fields.updated_at = new Date;
        db(tableName).returning('id').insert(fields).then(function(id) {
            res.json({id: id});
        }, function(err) {
            res.send(500, err.detail ? err.detail : err);
        });
    });

    router.put('/'+tableName+'/:id', function(req, res) {
        var fields = _.clone(req.body);
        fields.updated_at = new Date;
        db(tableName).where({id: req.params.id}).update(fields).then(function(num) {
            res.json(num);
        }, function(err) {
            res.send(500, err.detail ? err.detail : err);
        });
    });

    router.delete('/'+tableName+'/:id', function(req, res) {
        db(tableName).where({id: req.params.id}).del().then(function(num) {
            res.json(num);
        });
    });

    return router;
};