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

    this.insert = function(table, values, options) {
        if (!options)
            options = {};

        var insertFields = [];
        var insertValues = [];

        for (var fieldName in values) {
            insertFields.push(parseFieldName(fieldName));
            insertValues.push(parseValueType(values[fieldName]));
        }
        insertFields = insertFields.join(',');
        insertValues = insertValues.join(',');

        var sqlQuery = "INSERT ";
        if (options.ignore)
            sqlQuery += "IGNORE ";
        sqlQuery += "INTO " + parseFieldName(table) + " ";
        sqlQuery += "(" + insertFields + ") ";
        sqlQuery += "VALUES (" + insertValues + ")";

        return sqlQuery;
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

        FileSystem.appendFile(self.outputPath, data, function(error) {
            if (error)
                throw error;
        });
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
        var sql = getExportAuthorsSQL(authors);
        return appendToOutput(sql);
    };

    function getExportAuthorsSQL(authors) {
        var sqlQuery = "";
        for (var i = 0; i < authors.length; i++) {
            sqlQuery += getInsertAuthorSQL(authors[i]);
        }
        return sqlQuery;
    }

    function getInsertAuthorSQL(author) {
        return self.sql.insert("author", author, { ignore: true }) + ';\n';
    }

    this.exportCommits = function(commits) {
        var sql = getExportCommitsSQL(commits);
        return appendToOutput(sql);
    };

    function getExportCommitsSQL(commits) {
        var sqlQuery = "";
        for (var i = 0; i < commits.length; i++)
            sqlQuery += getInsertCommitSQL(commits[i]);
        return sqlQuery;
    }

    function getInsertCommitSQL(commit) {
        var authorQuery = new self.sql.Expression(self.sql.select(
            ["id"],
            "author",
            "`name`='" + self.sql.escapeString(commit.author.name) +
            "' AND `email`='" + self.sql.escapeString(commit.author.email) + "'"));

        return self.sql.insert("commit",
                {
                    project: new self.sql.Expression('@project_id'),
                    commit_oid: commit.id,
                    date: commit.date,
                    message: commit.message.trim(),
                    author: authorQuery
                }) + ";\n";
    }

    this.exportFileEntries = function(entries) {
        var sql = getExportFileEntriesSQL(entries);
        return appendToOutput(sql);
    };

    function getExportFileEntriesSQL(entries) {
        var sqlQuery = "";
        for (var i = 0; i < entries.length; i++) {
            sqlQuery += getInsertFileEntrySQL(entries[i]);
        }
        return sqlQuery;
    }

    function getInsertFileEntrySQL(oid) {
        return self.sql.insert("file_entry",
                {
                    project: new self.sql.Expression("@project_id"),
                    entry_oid: oid
                }) + ";\n";
    }

    this.exportPaths = function(paths) {
        var sql = getExportPathsSQL(paths);
        return appendToOutput(sql);
    };

    function getExportPathsSQL(paths) {
        var sqlQuery = "";
        for (var i = 0; i < paths.length; i++) {
            sqlQuery += getInsertPathSQL(paths[i]);
        }
        return sqlQuery;
    }

    function getInsertPathSQL(path) {
        return self.sql.insert("path",
                {
                    path: path
                }, {ignore: true}) + ";\n";
    }

    this.exportCommitFiles = function(commitId, files) {
        var sql = getExportCommitFilesSQL(commitId, files);
        return appendToOutput(sql);
    };

    function getExportCommitFilesSQL(commitId, files) {
        var sqlQuery = "";
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            sqlQuery += getInsertCommitFileSQL(commitId, file.id, file.path);
        }
        return sqlQuery;
    }

    function getInsertCommitFileSQL(commitOid, entryFileOid, path) {
        return self.sql.insert("commit_file",
                {
                    commit: new self.sql.Expression(selectIdFromCommit(commitOid)),
                    file_entry: new self.sql.Expression(selectIdFromFileEntry(entryFileOid)),
                    path: new self.sql.Expression(selectIdFromPath(path))
                }) + ";\n";
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
                sqlQuery += getInsertFileMetricsSQL(fileMetrics.id, fileMetrics.data);
            }
        }
        return sqlQuery;
    }

    function getInsertFileMetricsSQL(fileId, metrics) {
        var sqlQuery = self.sql.insert("file_metrics",
            {
                file_entry: new self.sql.Expression(selectIdFromFileEntry(fileId)),
                loc: metrics.loc,
                cyclomatic: metrics.cyclomatic,
                functions: metrics.functionCount,
                dependencies: metrics.dependencyCount
            }) + ";\n";

        for (var i = 0; i < metrics.functions.length; i++) {
            sqlQuery += getInsertFunctionMetricsSQL(fileId, metrics.functions[i]);
        }

        return sqlQuery;
    };

    function getInsertFunctionMetricsSQL(fileId, metrics) {
        var sqlQuery = self.sql.insert("function_metrics",
                {
                    file_entry: new self.sql.Expression(selectIdFromFileEntry(fileId)),
                    name: metrics.name,
                    line: metrics.line,
                    loc: metrics.loc,
                    cyclomatic: metrics.cyclomatic,
                    params: metrics.params
                }) + ";\n";

        return sqlQuery;
    };
}

exports = module.exports = MySqlExporter;