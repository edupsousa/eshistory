var FileSystem = require('fs');

function SqlGenerator() {
    var self = this;

    function parseValueType(value) {
        if (typeof value === "number") {
            return value;
        } else if (typeof value === "object") {
            if (value instanceof Date) {
                return parseValueType(value.toISOString().slice(0, 19).replace('T', ' '));
            } else if (value instanceof self.Expression) {
                return "(" + value.toString() + ")";
            } else {
                throw new Error("Couldn't parse unknown object: " + value);
            }
        } else {
            return "'" + self.escapeString(value) + "'";
        }
    }

    function parseFieldName(fieldName) {
        return "`" + fieldName + "`";
    }

    this.escapeString = function(value) {
        return String(value).replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
            switch (char) {
                case "\0":
                    return "\\0";
                case "\x08":
                    return "\\b";
                case "\x09":
                    return "\\t";
                case "\x1a":
                    return "\\z";
                case "\n":
                    return "\\n";
                case "\r":
                    return "\\r";
                case "\"":
                case "'":
                case "\\":
                case "%":
                    return "\\"+char;
            }
        });
    };

    function getInsertHeader(table, values, options) {
        if (!options)
            options = {};

        var insertFields = [];

        for (var fieldName in values) {
            insertFields.push(parseFieldName(fieldName));
        }
        insertFields = insertFields.join(',');

        var sqlQuery = "INSERT ";
        if (options.ignore)
            sqlQuery += "IGNORE ";
        sqlQuery += "INTO " + parseFieldName(table) + " ";
        sqlQuery += "(" + insertFields + ") ";
        return sqlQuery;
    }

    this.insert = function(table, values, options) {

        var insertValues = [];

        for (var fieldName in values) {
            insertValues.push(parseValueType(values[fieldName]));
        }

        var sqlQuery = getInsertHeader(table, values, options);
        sqlQuery += "VALUES (" + insertValues + ")";

        return sqlQuery;
    };

    this.insertMultiple = function(table, values, options) {
        if (values.length === 0)
            return '';

        var insertHeader = getInsertHeader(table, values[0], options);
        var sqlQuery = insertHeader + "VALUES\n";

        for (var i = 0; i < values.length; i++) {

            var rowValues = values[i];
            var insertValues = [];
            for (var fieldName in rowValues) {
                insertValues.push(parseValueType(rowValues[fieldName]));
            }
            sqlQuery += "\t(" + insertValues + ")";

            var isTheLastValue = (i == values.length - 1);
            var breakInsert = (i % 99 == 0 && i > 0);

            if (!isTheLastValue) {
                if (breakInsert) {
                    sqlQuery += ";\n" + insertHeader + "VALUES\n";
                } else {
                    sqlQuery += ",\n";
                }
            }
        }

        return sqlQuery + ';';
    };

    this.set = function(name, value) {
        return "SET @" + name + " = (" + value + ")";
    };

    this.select = function(fields, table, where) {
        var selectFields = fields.map(parseFieldName).join(',');
        var sqlQuery = "SELECT " + selectFields + " FROM " + parseFieldName(table);

        if (where) {
            sqlQuery += " WHERE " + where;
        }

        return sqlQuery;
    };

    this.Expression = function(value) {
        this.value = value;

        this.toString = function() {
            return this.value;
        }
    };
}

function MySqlExporter(outputPath) {
    var self = this;
    this.sql = new SqlGenerator();
    this.outputPath = outputPath;
    if (FileSystem.existsSync(this.outputPath))
        throw new Error("Output file already exists: " + this.outputPath);

    function selectIdFromFileEntry(fileOid) {
        return self.sql.select(["id"],"file_entry","`entry_oid` = '" + fileOid + "' AND project = @project_id");
    }

    function selectIdFromCommit(commitOid) {
        return self.sql.select(["id"],"commit", "`commit_oid` = '" + commitOid + "' AND project = @project_id");
    }

    function selectIdFromPath(path) {
        return self.sql.select(["id"],"path", "`path` = '" + path + "'");
    }

    function appendToOutput(data) {
        if (self.outputPath === undefined)
            return data;

        FileSystem.appendFileSync(self.outputPath, data);
    }

    this.exportProject = function(projectName) {
        var sql = getExportProjectSQL(projectName);
        return appendToOutput(sql);
    };

    function getExportProjectSQL(projectName) {
        return self.sql.insert("project", {name: projectName}) + ";\n" +
            self.sql.set("project_id",
                self.sql.select(["id"], "project", "`name` = '" + projectName + "'")
            ) + ";\n";
    }

    this.exportAuthors = function(authors) {
        var sql = getInsertAuthorsSQL(authors);
        return appendToOutput(sql);
    };

    function getInsertAuthorsSQL(authors) {
        return self.sql.insertMultiple("author", authors, {ignore:true}) + "\n";
    }

    this.exportCommits = function(commits) {
        var sql = getExportCommitsSQL(commits);
        return appendToOutput(sql);
    };

    function getExportCommitsSQL(commits) {
        var commitsToInsert = [];
        for (var i = 0; i < commits.length; i++) {
            var commit = commits[i];

            var authorQuery = new self.sql.Expression(self.sql.select(
                ["id"],
                "author",
                "`name`='" + self.sql.escapeString(commit.author.name) +
                "' AND `email`='" + self.sql.escapeString(commit.author.email) + "'"));

            commitsToInsert.push({
                project: new self.sql.Expression('@project_id'),
                commit_oid: commit.id,
                date: commit.date,
                message: commit.message.trim(),
                author: authorQuery
            });
        }

        return getInsertCommitsSQL(commitsToInsert);
    }

    function getInsertCommitsSQL(commits) {
        return self.sql.insertMultiple("commit", commits) + "\n";
    }

    this.exportFileEntries = function(entries) {
        var sql = getExportFileEntriesSQL(entries);
        return appendToOutput(sql);
    };

    function getExportFileEntriesSQL(entries) {
        var fileEntriesToInsert = [];
        for (var i = 0; i < entries.length; i++) {
            fileEntriesToInsert.push({
                project: new self.sql.Expression("@project_id"),
                entry_oid: entries[i]
            });
        }
        return getInsertFileEntrySQL(fileEntriesToInsert);
    }

    function getInsertFileEntrySQL(entries) {
        return self.sql.insertMultiple("file_entry", entries) + "\n";
    }

    this.exportPaths = function(paths) {
        var sql = getExportPathsSQL(paths);
        return appendToOutput(sql);
    };

    function getExportPathsSQL(paths) {
        var pathsToInsert = [];
        for (var i = 0; i < paths.length; i++) {
            pathsToInsert.push({
                path: paths[i]
            });
        }
        return getInsertPathsSQL(pathsToInsert);
    }

    function getInsertPathsSQL(paths) {
        return self.sql.insertMultiple("path", paths, {ignore: true}) + "\n";
    }

    this.exportCommitFiles = function(commitId, files) {
        var sql = getExportCommitFilesSQL(commitId, files);
        return appendToOutput(sql);
    };

    function getExportCommitFilesSQL(commitId, files) {
        var commitFilesToInsert = [];

        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            commitFilesToInsert.push(
                {
                    commit: new self.sql.Expression(selectIdFromCommit(commitId)),
                    file_entry: new self.sql.Expression(selectIdFromFileEntry(file.id)),
                    path: new self.sql.Expression(selectIdFromPath(file.path))
                }
            );
        }

        return getInsertCommitFilesSQL(commitFilesToInsert);
    }

    function getInsertCommitFilesSQL(commitFiles) {
        return self.sql.insertMultiple("commit_file", commitFiles) + "\n";
    };

    this.exportFilesMetrics = function(filesMetrics) {
        var sql = getExportFileMetricsSQL(filesMetrics);
        return appendToOutput(sql);
    };

    function getExportFileMetricsSQL(filesMetrics) {
        var sqlQuery = "";

        for (var i = 0; i < filesMetrics.length; i++) {
            var fileMetrics = filesMetrics[i];
            if (!fileMetrics.error) {
                sqlQuery += self.sql.set("entry_id", selectIdFromFileEntry(filesMetrics[i].id)) + ";\n";
                sqlQuery += getInsertFileMetricsSQL(fileMetrics.data);
            }
        }
        return sqlQuery;
    }

    function getInsertFileMetricsSQL(metrics) {
        var sqlQuery = self.sql.insert("file_metrics",
            {
                file_entry: new self.sql.Expression("@entry_id"),
                loc: metrics.loc,
                cyclomatic: metrics.cyclomatic,
                functions: metrics.functionCount,
                dependencies: metrics.dependencyCount
            }) + ";\n";
        if (metrics.functions.length > 0)
            sqlQuery += getExportFunctionsMetricsSQL(metrics.functions);

        return sqlQuery;
    }

    function getExportFunctionsMetricsSQL(functions) {
        var fnMetricsToInsert = [];

        for (var i = 0; i < functions.length; i++) {
            var metrics = functions[i];
            fnMetricsToInsert.push({
                file_entry: new self.sql.Expression("@entry_id"),
                name: metrics.name,
                line: metrics.line,
                loc: metrics.loc,
                cyclomatic: metrics.cyclomatic,
                params: metrics.params
            });
        }

        return getInsertFunctionMetricsSQL(fnMetricsToInsert);
    }

    function getInsertFunctionMetricsSQL(metrics) {
        return self.sql.insertMultiple("function_metrics", metrics) + "\n";
    };
}

exports = module.exports = MySqlExporter;