var expect = require('chai').expect,
    exporter = require('../lib/MySqlExporter.js');

describe('MySqlExporter', function() {

    it('Export project', function() {
        var sqlQuery = exporter.writeProject('js-project-metrics');
        expect(sqlQuery).to.be.equal(
            "INSERT INTO `project` (`name`) VALUES ('js-project-metrics');\n" +
            "SET @project_id = (SELECT `id` FROM `project` WHERE `name` = 'js-project-metrics');\n"
        );
    });

    context('sql', function() {
        it('Create a insert with one field', function() {
            var sqlQuery = exporter.sql.insert('table', {field:'value'});
            expect(sqlQuery).to.be.equal("INSERT INTO `table` (`field`) VALUES ('value')")
        });

        it('Create a insert with two fields', function() {
            var sqlQuery = exporter.sql.insert('table', {fieldA:'valueA', fieldB:'valueB'});
            expect(sqlQuery).to.be.equal("INSERT INTO `table` (`fieldA`,`fieldB`) VALUES ('valueA','valueB')")
        });

        it('Create insert with numeric values', function() {
            var sqlQuery = exporter.sql.insert('table', {fieldA:10, fieldB:20.575});
            expect(sqlQuery).to.be.equal("INSERT INTO `table` (`fieldA`,`fieldB`) VALUES (10,20.575)")
        });

        it('Set a user variable', function() {
            var sqlQuery = exporter.sql.set("project_id",
                exporter.sql.select(['id'],'project',"name = 'js-project-metrics'"));
            expect(sqlQuery).to.be.equal("SET @project_id = (SELECT `id` FROM `project` WHERE name = 'js-project-metrics')")
        });

        it('Create a simple select query with one field.', function() {
            var sqlQuery = exporter.sql.select(['field'], 'table');
            expect(sqlQuery).to.be.equal('SELECT `field` FROM `table`');
        });

        it('Create a simple select query with two field.', function() {
            var sqlQuery = exporter.sql.select(['fieldA', 'fieldB'], 'table');
            expect(sqlQuery).to.be.equal('SELECT `fieldA`,`fieldB` FROM `table`');
        });

        it('Create a select query with where clause', function() {
            var sqlQuery = exporter.sql.select(['field'], 'table', "foo = 'bar'");
            expect(sqlQuery).to.be.equal("SELECT `field` FROM `table` WHERE foo = 'bar'");
        });

    });

});