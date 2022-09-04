'use strict';

exports.up = function(knex, Promise) {
    return knex.schema.createTable('projects', function(table) {
        table.increments();
        table.string('name').unique().notNullable();
        table.timestamps();
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('projects');
};
