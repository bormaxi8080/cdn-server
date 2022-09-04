'use strict';

exports.up = function(knex, Promise) {
    return knex.schema.createTable('files', function(table) {
        table.increments();
        table.string('name').notNullable();
        table.integer('project_id').notNullable().references('id').inTable('projects');
        table.unique(['name', 'project_id']);
        table.timestamps();
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('files');
};
