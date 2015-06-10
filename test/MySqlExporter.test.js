var expect = require('chai').expect,
    MySqlExporter = require('../lib/MySqlExporter.js');

describe("MySqlExporter", function() {
    var exporter;

    before(function() {
        exporter = new MySqlExporter();
    });

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

        it("Authors", function() {
            var authors = [
                {
                    name: "foo bar",
                    email: "foo@bar.com"
                },
                {
                    name: "bar",
                    email: "bar@bar.com"
                }
            ];
            var sqlQuery = exporter.writeAuthors(authors);
            expect(sqlQuery).to.be.equal(
                "INSERT IGNORE INTO `author` (`name`,`email`) VALUES ('foo bar','foo@bar.com');\n" +
                "INSERT IGNORE INTO `author` (`name`,`email`) VALUES ('bar','bar@bar.com');\n"
            );
        });

        it("Commit", function() {
            var commit = {
                id: "1234567890123456789012345678901234567890",
                date: new Date("2015-01-01T12:00:00.000Z"),
                message: "Multiline.\nCommit Message\n",
                author: {
                    name: "foo'bar",
                    email: "foo@bar.com"
                }
            };
            var sqlQuery = exporter.writeCommit(commit);
            expect(sqlQuery).to.be.equal(
                "INSERT INTO `commit` (`project`,`commit_oid`,`date`,`message`,`author`) VALUES " +
                "((@project_id),'1234567890123456789012345678901234567890','2015-01-01 12:00:00','Multiline.\\nCommit Message'," +
                "(SELECT `id` FROM `author` WHERE `name`='foo\\'bar' AND `email`='foo@bar.com'));\n"
            )
        });

        it("Commits", function() {
            var commits = [{
                    id: "1234567890123456789012345678901234567890",
                    date: new Date("2015-01-01T12:00:00.000Z"),
                    message: "Multiline.\nCommit Message\n",
                    author: {
                        name: "foo'bar",
                        email: "foo@bar.com"
                    }
                },
                {
                    id: "0987654321098765432109876543210987654321",
                    date: new Date("2015-12-31T12:00:00.000Z"),
                    message: "Commit Message\n",
                    author: {
                        name: "bar",
                        email: "bar@bar.com"
                    }
                }];
            var sqlQuery = exporter.writeCommits(commits);
            expect(sqlQuery).to.be.equal(
                "INSERT INTO `commit` (`project`,`commit_oid`,`date`,`message`,`author`) VALUES " +
                "((@project_id),'1234567890123456789012345678901234567890','2015-01-01 12:00:00','Multiline.\\nCommit Message'," +
                "(SELECT `id` FROM `author` WHERE `name`='foo\\'bar' AND `email`='foo@bar.com'));\n" +
                "INSERT INTO `commit` (`project`,`commit_oid`,`date`,`message`,`author`) VALUES " +
                "((@project_id),'0987654321098765432109876543210987654321','2015-12-31 12:00:00','Commit Message'," +
                "(SELECT `id` FROM `author` WHERE `name`='bar' AND `email`='bar@bar.com'));\n"
            );
        });

        it("File Entry", function() {
            var oid = "1234567890123456789012345678901234567890";
            var sqlQuery = exporter.writeFileEntry(oid);
            expect(sqlQuery).to.be.equal("INSERT INTO `file_entry` (`project`,`entry_oid`) VALUES " +
                "((@project_id),'1234567890123456789012345678901234567890');\n")
        });

        it("File Entries", function() {
            var entries = [
                "1234567890123456789012345678901234567890",
                "AAAAAAAAAAAAAABBBBBBBBBBCCCCCCCCDDDDDDDD"
            ];
            var sqlQuery = exporter.writeFileEntries(entries);
            expect(sqlQuery).to.be.equal(
                "INSERT INTO `file_entry` (`project`,`entry_oid`) VALUES " +
                "((@project_id),'1234567890123456789012345678901234567890');\n" +
                "INSERT INTO `file_entry` (`project`,`entry_oid`) VALUES " +
                "((@project_id),'AAAAAAAAAAAAAABBBBBBBBBBCCCCCCCCDDDDDDDD');\n"
            );
        });

        it("Path", function() {
            var path = "/lib/foo/bar.js";
            var sqlQuery = exporter.writePath(path);
            expect(sqlQuery).to.be.equal("INSERT IGNORE INTO `path` (`path`) VALUES ('/lib/foo/bar.js');\n");
        });

        it("Write Paths", function() {
            var paths = ["/lib/foo/bar.js", "/test/bar/foo.js"];
            var sqlQuery = exporter.writePaths(paths);
            expect(sqlQuery).to.be.equal(
                "INSERT IGNORE INTO `path` (`path`) VALUES ('/lib/foo/bar.js');\n" +
                "INSERT IGNORE INTO `path` (`path`) VALUES ('/test/bar/foo.js');\n"
            );
        });

        it("Commit File", function() {
            var commit = "1234567890123456789012345678901234567890";
            var file = "0987654321098765432109876543210987654321";
            var path = "/lib/foo/bar.js";

            var sqlQuery = exporter.writeCommitFile(commit, file, path);
            expect(sqlQuery).to.be.equal("INSERT INTO `commit_file` (`commit`,`file_entry`,`path`) VALUES (" +
                "(SELECT `id` FROM `commit` " +
                "WHERE `commit_oid` = '1234567890123456789012345678901234567890' AND project = @project_id)," +
                "(SELECT `id` FROM `file_entry` " +
                "WHERE `entry_oid` = '0987654321098765432109876543210987654321' AND project = @project_id)," +
                "(SELECT `id` FROM `path` WHERE `path` = '/lib/foo/bar.js'));\n");
        });

        it("Commit Files", function() {
            var commit = "1234567890123456789012345678901234567890";
            var files = [
                {
                    id:"0987654321098765432109876543210987654321",
                    path:"/lib/foo/bar.js"
                },
                {
                    id:"1234567890123456789012345678901234567890",
                    path:"/test/bar/foo.js"
                }
            ];

            var sqlQuery = exporter.writeCommitFiles(commit, files);
            expect(sqlQuery).to.be.equal(
                "INSERT INTO `commit_file` (`commit`,`file_entry`,`path`) VALUES (" +
                "(SELECT `id` FROM `commit` " +
                "WHERE `commit_oid` = '1234567890123456789012345678901234567890' AND project = @project_id)," +
                "(SELECT `id` FROM `file_entry` " +
                "WHERE `entry_oid` = '0987654321098765432109876543210987654321' AND project = @project_id)," +
                "(SELECT `id` FROM `path` WHERE `path` = '/lib/foo/bar.js'));\n" +
                "INSERT INTO `commit_file` (`commit`,`file_entry`,`path`) VALUES (" +
                "(SELECT `id` FROM `commit` " +
                "WHERE `commit_oid` = '1234567890123456789012345678901234567890' AND project = @project_id)," +
                "(SELECT `id` FROM `file_entry` " +
                "WHERE `entry_oid` = '1234567890123456789012345678901234567890' AND project = @project_id)," +
                "(SELECT `id` FROM `path` WHERE `path` = '/test/bar/foo.js'));\n"
            );
        });

        it("File Metrics", function() {
            var fileOid = "1234567890123456789012345678901234567890";
            var metrics = {
                loc: 10,
                cyclomatic: 2,
                functionCount: 2,
                dependencyCount: 2,
                functions: [
                    {
                        name: "myFn",
                        line: 5,
                        loc: 10,
                        cyclomatic: 2,
                        params: 0
                    },
                    {
                        name: "otherFn",
                        line: 1,
                        loc: 2,
                        cyclomatic: 3,
                        params: 4
                    }
                ]
            };

            var sqlQuery = exporter.writeFileMetrics(fileOid, metrics);

            expect(sqlQuery).to.be.equal(
                "INSERT INTO `file_metrics` (`file_entry`,`loc`,`cyclomatic`,`functions`,`dependencies`) " +
                "VALUES (" +
                "(SELECT `id` FROM `file_entry` " +
                "WHERE `entry_oid` = '1234567890123456789012345678901234567890' AND project = @project_id)," +
                "10,2,2,2);\n" +

                "INSERT INTO `function_metrics` (`file_entry`,`name`,`line`,`loc`,`cyclomatic`,`params`) VALUES (" +
                "(SELECT `id` FROM `file_entry` " +
                "WHERE `entry_oid` = '1234567890123456789012345678901234567890' AND project = @project_id)," +
                "'myFn',5,10,2,0);\n" +

                "INSERT INTO `function_metrics` (`file_entry`,`name`,`line`,`loc`,`cyclomatic`,`params`) VALUES (" +
                "(SELECT `id` FROM `file_entry` " +
                "WHERE `entry_oid` = '1234567890123456789012345678901234567890' AND project = @project_id)," +
                "'otherFn',1,2,3,4);\n"
            )
        });

        it("Files Metrics", function() {
            var metrics = [
                {
                    id: '1234567890123456789012345678901234567890',
                    error: false,
                    data: {
                        loc: 10,
                        cyclomatic: 2,
                        functionCount: 0,
                        dependencyCount: 2,
                        functions: []
                    },
                },
                {
                    id: 'ERRORERRORERRORERRORERRORERRORERRORERROR',
                    error: true,
                    reason: 'Bad things happen.'
                },
                {
                    id:'0987654321098765432109876543210987654321',
                    error: false,
                    data: {
                        loc: 10,
                        cyclomatic: 1,
                        functionCount: 0,
                        dependencyCount: 1,
                        functions: []
                    }
                }
            ];

            var sqlQuery = exporter.writeFilesMetrics(metrics);
            expect(sqlQuery).to.be.equal(
                "INSERT INTO `file_metrics` (`file_entry`,`loc`,`cyclomatic`,`functions`,`dependencies`) " +
                "VALUES (" +
                "(SELECT `id` FROM `file_entry` " +
                "WHERE `entry_oid` = '1234567890123456789012345678901234567890' AND project = @project_id)," +
                "10,2,0,2);\n" +

                "INSERT INTO `file_metrics` (`file_entry`,`loc`,`cyclomatic`,`functions`,`dependencies`) " +
                "VALUES (" +
                "(SELECT `id` FROM `file_entry` " +
                "WHERE `entry_oid` = '0987654321098765432109876543210987654321' AND project = @project_id)," +
                "10,1,0,1);\n"
            );
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