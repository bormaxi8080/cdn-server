var bluebird = require('bluebird');

var util = require('util');
var fs = bluebird.promisifyAll(require('fs'))
var path = require('path');
var crypto = require('crypto');

var mkdirp = bluebird.promisify(require('mkdirp'));


var express = require('express');
var multer  = require('multer');

var _ = require('lodash');

var app = require('./app');

var db = app.get('db');
var config = app.get('config');

var router = express.Router({strict: false});

router.use('/:project_id/upload_file', multer({ dest: path.join(config.files_dir, 'tmp')}));

function ClientRequestError(message) {
    this.name = 'ClientRequestError';
    this.message = message;
}
util.inherits(ClientRequestError, Error);

function ServerError(message) {
    this.name = 'ServerError';
    this.message = message;
}
util.inherits(ServerError, Error);

router.use('/:project_id', function(req, res, next) {
    db('projects').where({id: req.params.project_id}).count('id').spread(function(c) {
        if (Number(c.count) > 0) {
            next();
        } else {
            res.send(400, 'unknown project');
        }
    }).catch(function(a) {
        res.send(500, 'error get project');
    });
});

function RequestError(code, text) {
    this.code = code;
    this.text = text;
}

function sha1File(file) {
    return new bluebird.Promise(function(fullfill, reject) {
        var shasum = crypto.createHash('sha1');
        var stream = fs.ReadStream(file);

        stream.on('data', function(d) {
            shasum.update(d);
        });

        stream.on('end', function() {
            var d = shasum.digest('hex');
            fullfill(d);
        });

        stream.on('error', function() {
            reject();
        });
    });
}

function fullFilePath(projectId, versionId, filePath) {
    var dirName = path.dirname(filePath);
    var extName = path.extname(filePath);
    var baseName = path.basename(filePath, extName);
    return path.join((projectId+''), dirName, baseName+'.'+versionId+extName);
}

function wrapExpressCallback(cb) {
    return function(req, res, next) {
        return cb(req, res, next)
            .catch(ClientRequestError, function(e) {
                res.send(400, e.message);
            })
            .catch(function(e) {
                var message = (e instanceof Error) ? e.message : (""+e);
                res.send(500, message);
            })
            .finally(function() {
                if (req.files) {
                    _.values(req.files).forEach(function(f) {
                        fs.exists(f.path, function(e) {
                            if (e) {
                                fs.unlink(f.path, function() {});
                            }
                        });
                    });
                }
            });
    }
}


router.get('/:project_id/check_sha1_exists', wrapExpressCallback(function(req, res) {
    return db('files').where({project_id: req.params.project_id, name: req.query.file}).limit(1).spread(function(file) {
        if (!file) {
            throw new ClientRequestError('unknown file');
        }
        return db('versions').where({file_id: file.id, sha1: req.query.sha1}).limit(1).spread(function(version) {
            res.json(!!version);
        })
    });
}));

router.post('/:project_id/upload_file', wrapExpressCallback(function(req, res) {
    var uploadFileName = decodeURIComponent(req.body.file);
    if (!(req.body.file && req.files.file)) {
        throw new ClientRequestError('invalid file or filename');
    }
    return sha1File(req.files.file.path).then(function(sha1) {
        return db.transaction(function(trx) {
            trx('files').where({project_id: req.params.project_id, name: uploadFileName}).limit(1)
                .spread(function(file) {
                    if (file) {
                        return file.id;
                    } else {
                        return trx('files').returning('id').insert({
                            name: uploadFileName,
                            project_id: req.params.project_id,
                            created_at: new Date,
                            updated_at: new Date
                        }).then(_.first);
                    }
                })
                .then(function(fileId) {
                    return trx('versions').where({file_id: fileId, sha1: sha1}).limit(1)
                        .spread(function(version) {
                            if (version) {
                                return version.version;
                            } else {
                                return trx('versions').max('version').where({file_id: fileId}).spread(function(r) {
                                    var newVersion = r.max + 1;
                                    var filePath = fullFilePath(req.params.project_id, newVersion, uploadFileName);
                                    var fields = {
                                        file_id: fileId,
                                        version: newVersion,
                                        sha1: sha1,
                                        file_path: filePath,
                                        created_at: new Date,
                                        updated_at: new Date
                                    };
                                    return trx('versions').returning('id').insert(fields).then(function() {
                                        var fullFilePath = path.join(config.files_dir, filePath);
                                        return mkdirp(path.dirname(fullFilePath)).then(function() {
                                            return fs.renameAsync(req.files.file.path, fullFilePath).then(function() {
                                                return newVersion;
                                            });
                                        });
                                    });
                                });
                            }
                        });
                })
                .then(function(newVersion) {
                    trx.commit(newVersion);
                })
                .catch(function(e) {
                    trx.rollback(e);
                });
        }).then(function(v) {
            res.json(v);
        })
    });
}));





module.exports = {router: router};