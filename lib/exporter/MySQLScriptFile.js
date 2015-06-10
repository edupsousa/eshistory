
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

function MySqlExporter() {
    var self = this;
    this.sql = new SqlGenerator();

    function selectIdFromFileEntry(fileOid) {
        return self.sql.select(["id"],"file_entry","`entry_oid` = '" + fileOid + "' AND project = @project_id");
    }

    function selectIdFromCommit(commitOid) {
        return self.sql.select(["id"],"commit", "`commit_oid` = '" + commitOid + "' AND project = @project_id");
    }

    function selectIdFromPath(path) {
        return self.sql.select(["id"],"path", "`path` = '" + path + "'");
    }

    this.writeProject = function(projectName) {
        return this.sql.insert("project", {name: projectName}) + ";\n" +
                this.sql.set("project_id",
                    this.sql.select(["id"], "project", "`name` = '" + projectName + "'")
                ) + ";\n";

    };

    this.writeAuthors = function(authors) {
        var sqlQuery = "";
        for (var i = 0; i < authors.length; i++) {
            sqlQuery += writeAuthor(authors[i]);
        }
        return sqlQuery;
    };

    function writeAuthor(author) {
        return self.sql.insert("author", author, { ignore: true }) + ';\n';
    }

    this.writeCommits = function(commits) {
        var sqlQuery = "";
        for (var i = 0; i < commits.length; i++)
            sqlQuery += writeCommit(commits[i]);
        return sqlQuery;
    };

    function writeCommit(commit) {
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

    this.writeFileEntries = function(entries) {
        var sqlQuery = "";
        for (var i = 0; i < entries.length; i++) {
            sqlQuery += writeFileEntry(entries[i]);
        }
        return sqlQuery;
    };

    function writeFileEntry(oid) {
        return self.sql.insert("file_entry",
                {
                    project: new self.sql.Expression("@project_id"),
                    entry_oid: oid
                }) + ";\n";
    }

    this.writePaths = function(paths) {
        var sqlQuery = "";
        for (var i = 0; i < paths.length; i++) {
            sqlQuery += writePath(paths[i]);
        }
        return sqlQuery;
    };

    function writePath(path) {
        return self.sql.insert("path",
                {
                    path: path
                }, {ignore: true}) + ";\n";
    }

    this.writeCommitFiles = function(commitOid, files) {
        var sqlQuery = "";
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            sqlQuery += writeCommitFile(commitOid, file.id, file.path);
        }
        return sqlQuery;
    };

    function writeCommitFile(commitOid, entryFileOid, path) {
        return self.sql.insert("commit_file",
                {
                    commit: new self.sql.Expression(selectIdFromCommit(commitOid)),
                    file_entry: new self.sql.Expression(selectIdFromFileEntry(entryFileOid)),
                    path: new self.sql.Expression(selectIdFromPath(path))
                }) + ";\n";
    };

    this.writeFilesMetrics = function(filesMetrics) {
        var sqlQuery = "";
        for (var i = 0; i < filesMetrics.length; i++) {
            var fileMetrics = filesMetrics[i];
            if (!fileMetrics.error)
                sqlQuery += writeFileMetrics(fileMetrics.id, fileMetrics.data);
        }
        return sqlQuery;
    };

    function writeFileMetrics(fileOid, metrics) {
        var sqlQuery = self.sql.insert("file_metrics",
            {
                file_entry: new self.sql.Expression(selectIdFromFileEntry(fileOid)),
                loc: metrics.loc,
                cyclomatic: metrics.cyclomatic,
                functions: metrics.functionCount,
                dependencies: metrics.dependencyCount
            }) + ";\n";

        for (var i = 0; i < metrics.functions.length; i++) {
            sqlQuery += writeFunctionMetrics(fileOid, metrics.functions[i]);
        }

        return sqlQuery;
    };

    function writeFunctionMetrics(fileOid, metrics) {
        var sqlQuery = self.sql.insert("function_metrics",
                {
                    file_entry: new self.sql.Expression(selectIdFromFileEntry(fileOid)),
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