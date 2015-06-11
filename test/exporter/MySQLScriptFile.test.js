var chai = require('chai'),
    expect = chai.expect
    sinon = require('sinon'),
    sinonChai = require('sinon-chai'),
    MySqlExporter = require('../../lib/exporter/MySQLScriptFile.js');

chai.use(sinonChai);

describe("MySQLScriptFile", function() {
    var exporter;

    beforeEach(function() {
        exporter = new MySqlExporter();
    });

    context("Export Items", function() {

        var sqlMock;

        beforeEach(function() {
            sqlMock = {
                insert: sinon.stub().returns('insert'),
                insertMultiple: sinon.stub().returns('insertMultiple;'),
                select: sinon.stub().returns('select'),
                set: sinon.stub().returns('set'),
                escapeString: sinon.stub().returns('escapeString'),
                Expression: sinon.stub().returns({})
            };
            exporter.sql = sqlMock;
        });

        it("Project", function() {
            var sqlQuery = exporter.exportProject("js-project-metrics");

            expect(sqlMock.insert)
                .to.have.been.calledWithExactly("project", {name: "js-project-metrics"});
            expect(sqlMock.select)
                .to.have.been.calledWithExactly(["id"], "project", "`name` = 'js-project-metrics'");
            expect(sqlMock.set)
                .to.have.been.calledWith("project_id", "select");
            expect(sqlQuery)
                .to.be.equal("insert;\nset;\n");
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
            var sqlQuery = exporter.exportAuthors(authors);

            expect(sqlMock.insertMultiple)
                .to.have.been.calledWithExactly("author",authors,{ignore:true});
            expect(sqlQuery)
                .to.be.equal("insertMultiple;\n")
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


            var sqlQuery = exporter.exportCommits(commits);


            expect(sqlMock.insertMultiple).to.have.been.calledWithExactly(
                "commit",
                [
                    {
                        project: {},
                        commit_oid: '1234567890123456789012345678901234567890',
                        date: new Date("2015-01-01T12:00:00.000Z"),
                        message: 'Multiline.\nCommit Message',
                        author: {}
                    },
                    {
                        project: {},
                        commit_oid: '0987654321098765432109876543210987654321',
                        date: new Date("2015-12-31T12:00:00.000Z"),
                        message: 'Commit Message',
                        author: {}
                    }
                ]);

            expect(sqlMock.insertMultiple)
                .to.have.been.calledAfter(sqlMock.select);

            expect(sqlQuery).to.be.equal("insertMultiple;\n");
        });

        it("File Entries", function() {
            var entries = [
                "1234567890123456789012345678901234567890",
                "AAAAAAAAAAAAAABBBBBBBBBBCCCCCCCCDDDDDDDD"
            ];

            var sqlQuery = exporter.exportFileEntries(entries);

            expect(sqlMock.insertMultiple)
                .to.have.been.calledWithExactly(
                "file_entry",
                [
                    {project: {}, entry_oid: "1234567890123456789012345678901234567890"},
                    {project: {}, entry_oid: "AAAAAAAAAAAAAABBBBBBBBBBCCCCCCCCDDDDDDDD"}
                ]
            );

            expect(sqlQuery).to.be.equal("insertMultiple;\n");
        });

        it("Write Paths", function() {
            var paths = ["/lib/foo/bar.js", "/test/bar/foo.js"];

            var sqlQuery = exporter.exportPaths(paths);

            expect(sqlMock.insertMultiple)
                .to.have.been.calledWithExactly(
                "path",
                [
                    {path: "/lib/foo/bar.js"},
                    {path: "/test/bar/foo.js"}
                ],
                {ignore: true}
            );
            expect(sqlQuery).to.be.equal("insertMultiple;\n");
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

            var sqlQuery = exporter.exportCommitFiles(commit, files);

            expect(sqlMock.insertMultiple)
                .to.have.been.calledWithExactly(
                "commit_file",
                [
                    {commit: {}, file_entry: {}, path: {}},
                    {commit: {}, file_entry: {}, path: {}}
                ]
            );
            expect(sqlQuery).to.be.equal("insertMultiple;\n");
        });

        it("Files Metrics", function() {
            var metrics = [
                {
                    id: '1234567890123456789012345678901234567890',
                    error: false,
                    data: {
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

            var sqlQuery = exporter.exportFilesMetrics(metrics);

            expect(sqlMock.set)
                .to.have.been.calledTwice
                .and.always.have.been.calledWithExactly("entry_id","select");
            expect(sqlMock.insert)
                .to.have.been.calledTwice
                .and.have.been.calledAfter(sqlMock.set)
                .and.always.have.been.calledWith("file_metrics");
            expect(sqlMock.insertMultiple)
                .to.have.been.calledOnce
                .and.have.been.calledWith("function_metrics");


            expect(sqlQuery).to.be.equal("set;\ninsert;\ninsertMultiple;\nset;\ninsert;\n");
        });
    });

    context("sql", function() {
        it("Create a insert with one field", function() {
            var sqlQuery = exporter.sql.insert("table", {field:"value"});
            expect(sqlQuery).to.be.equal("INSERT INTO `table` (`field`) VALUES ('value')")
        });

        it("Create a insert with a date value", function() {
            var sqlQuery = exporter.sql.insert("table", {field:new Date("2015-01-01T12:00:00.000Z")});
            expect(sqlQuery).to.be.equal("INSERT INTO `table` (`field`) VALUES ('2015-01-01 12:00:00')")
        });

        it("Create a insert with a unknown object should throw a error", function() {
            expect(function() {
                exporter.sql.insert("table", {field:new RegExp('')})
            }).to.throw(Error)
        });

        it("Create a insert with special characters on value", function() {
            var sqlQuery = exporter.sql.insert("table", {
                field:"\0\x08\x09\x1a\n\r'"
            });
            expect(sqlQuery).to.be.equal("INSERT INTO `table` (`field`) VALUES ('\\0\\b\\t\\z\\n\\r\\'')");
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

        it("Create a multi row insert", function() {
            var sqlQuery = exporter.sql.insertMultiple("table", [{field:"value1"},{field:"value2"}]);
            expect(sqlQuery).to.be.equal(
                "INSERT INTO `table` (`field`) VALUES\n" +
                "\t('value1'),\n" +
                "\t('value2');")
        });

        it("Create a multi row insert for empty array should return a empty string", function() {
            var sqlQuery = exporter.sql.insertMultiple("table", []);
            expect(sqlQuery).to.be.equal("");
        });

        it("A multi row insert with more than 100 rows should be broken in 2 inserts", function() {

            var rows = [];
            for (var i = 0; i < 101; i++) {
                rows[rows.length] = {field:'value' + (i+1)};
            }

            var match = /^INSERT.+\n(\t\('value\d{1,3}'\)[,;]\n){100}INSERT.+\n\t\('value101'\);$/;
            var sqlQuery = exporter.sql.insertMultiple("table", rows);
            expect(sqlQuery).to.match(match);
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