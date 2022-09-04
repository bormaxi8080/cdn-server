'use strict';

exports.up = function(knex, Promise) {
    return knex.schema.createTable('tags', function(table) {
        table.increments();
        table.integer('version_id').notNullable().references('id').inTable('versions');
        table.string('tag_name').notNullable();
        table.string('tag_value').notNullable();
        table.timestamps();
        table.unique(['version_id', 'tag_name', 'tag_value']);
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('tags');
};
