'use strict';

exports.up = function(knex, Promise) {
    return knex.schema.createTable('versions', function(table) {
        table.increments();
        table.integer('file_id').notNullable().references('id').inTable('files');
        table.integer('version').notNullable();
        table.string('file_path').notNullable();
        table.string('sha1').notNullable();
        table.timestamps();
        table.unique(['file_id', 'version']);
        table.unique(['file_id', 'sha1']);
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('versions');
};
