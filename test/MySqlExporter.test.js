var expect = require('chai').expect,
    exporter = require('../lib/MySqlExporter.js');

describe("MySqlExporter", function() {

    context("Export Items", function() {

        it("Project", function() {
            var sqlQuery = exporter.writeProject("js-project-metrics");
            expect(sqlQuery).to.be.equal(
                "INSERT INTO `project` (`name`) VALUES ('js-project-metrics');\n" +
                "SET @project_id = (SELECT `id` FROM `project` WHERE `name` = 'js-project-metrics');\n"
            );
        });

        it("Author", function() {
            var author = {
                name: "foo bar",
                email: "foo@bar.com"
            };
            var sqlQuery = exporter.writeAuthor(author);
            expect(sqlQuery).to.be.equal("INSERT IGNORE INTO `author` (`name`,`email`) VALUES ('foo bar','foo@bar.com');\n");
        });

        it("Commit", function() {
            var commit = {
                id: "1234567890123456789012345678901234567890",
                date: new Date("2015-01-01T12:00:00.000Z"),
                message: "Multiline.\nCommit Message\n",
                author: {
                    name: "foo bar",
                    email: "foo@bar.com"
                }
            };
            var sqlQuery = exporter.writeCommit(commit);
            expect(sqlQuery).to.be.equal(
                "INSERT INTO `commit` (`project`,`commit_oid`,`date`,`message`,`author`) VALUES " +
                "((@project_id),'1234567890123456789012345678901234567890','2015-01-01 12:00:00','Multiline.\\nCommit Message'," +
                "(SELECT `id` FROM `author` WHERE `name`='foo bar' AND `email`='foo@bar.com'));\n"
            )
        });

        it("File Entry", function() {
            var oid = "1234567890123456789012345678901234567890";
            var sqlQuery = exporter.writeFileEntry(oid);
            expect(sqlQuery).to.be.equal("INSERT INTO `file_entry` (`project`,`entry_oid`) VALUES " +
                "((@project_id),'1234567890123456789012345678901234567890');\n")
        });

        it("Path", function() {
            var path = "/lib/foo/bar.js";
            var sqlQuery = exporter.writePath(path);
            expect(sqlQuery).to.be.equal("INSERT IGNORE INTO `path` (`path`) VALUES ('/lib/foo/bar.js');\n");
        });

        it("Commit File", function() {
            var commit = "1234567890123456789012345678901234567890";
            var file = "0987654321098765432109876543210987654321";
            var path = "/lib/foo/bar.js";

            var sqlQuery = exporter.writeCommitFile(commit, file, path);
            expect(sqlQuery).to.be.equal("INSERT INTO `commit_file` (`commit`,`file`,`path`) VALUES (" +
                "(SELECT `id` FROM `commit` " +
                "WHERE `commit_oid` = '1234567890123456789012345678901234567890' AND project = @project_id)," +
                "(SELECT `id` FROM `file_entry` " +
                "WHERE `entry_oid` = '0987654321098765432109876543210987654321' AND project = @project_id)," +
                "(SELECT `id` FROM `path` WHERE `path` = '/lib/foo/bar.js'));\n");
        });

    });

    context("sql", function() {
        it("Create a insert with one field", function() {
            var sqlQuery = exporter.sql.insert("table", {field:"value"});
            expect(sqlQuery).to.be.equal("INSERT INTO `table` (`field`) VALUES ('value')")
        });

        it("Create a insert with a expression value", function() {
            var sqlQuery = exporter.sql.insert("table", {field: new exporter.sql.Expression('2+2')});
            expect(sqlQuery).to.be.equal("INSERT INTO `table` (`field`) VALUES ((2+2))")
        });

        it("Create a insert with two fields", function() {
            var sqlQuery = exporter.sql.insert("table", {fieldA:"valueA", fieldB:"valueB"});
            expect(sqlQuery).to.be.equal("INSERT INTO `table` (`fieldA`,`fieldB`) VALUES ('valueA','valueB')")
        });

        it("Create insert with numeric values", function() {
            var sqlQuery = exporter.sql.insert("table", {fieldA:10, fieldB:20.575});
            expect(sqlQuery).to.be.equal("INSERT INTO `table` (`fieldA`,`fieldB`) VALUES (10,20.575)")
        });

        it("Create a insert with one expression", function() {
            var sqlQuery = exporter.sql.insert("table", {field:"value"});
            expect(sqlQuery).to.be.equal("INSERT INTO `table` (`field`) VALUES ('value')")
        });

        it("Create a insert with ignore clause", function() {
            var sqlQuery = exporter.sql.insert("table", {field:"value"}, {ignore: true});
            expect(sqlQuery).to.be.equal("INSERT IGNORE INTO `table` (`field`) VALUES ('value')")
        });

        it("Set a user variable", function() {
            var sqlQuery = exporter.sql.set("project_id",
                exporter.sql.select(["id"],"project","name = 'js-project-metrics'"));
            expect(sqlQuery).to.be.equal("SET @project_id = (SELECT `id` FROM `project` WHERE name = 'js-project-metrics')")
        });

        it("Create a simple select query with one field.", function() {
            var sqlQuery = exporter.sql.select(["field"], "table");
            expect(sqlQuery).to.be.equal('SELECT `field` FROM `table`');
        });

        it("Create a simple select query with two field.", function() {
            var sqlQuery = exporter.sql.select(["fieldA", "fieldB"], "table");
            expect(sqlQuery).to.be.equal('SELECT `fieldA`,`fieldB` FROM `table`');
        });

        it("Create a select query with where clause", function() {
            var sqlQuery = exporter.sql.select(["field"], "table", "foo = 'bar'");
            expect(sqlQuery).to.be.equal("SELECT `field` FROM `table` WHERE foo = 'bar'");
        });

    });

});