
function SqlGenerator() {
    var self = this;

    function espaceString(value) {
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
    }

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
            return "'" + espaceString(value) + "'";
        }
    }

    function parseFieldName(fieldName) {
        return "`" + fieldName + "`";
    }

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
    this.sql = new SqlGenerator();

    this.writeProject = function(projectName) {
        return this.sql.insert("project", {name: projectName}) + ";\n" +
                this.sql.set("project_id",
                    this.sql.select(["id"], "project", "`name` = '" + projectName + "'")
                ) + ";\n";

    };

    this.writeAuthor = function(author) {
        return this.sql.insert("author",
            {
                name: author.name,
                email: author.email
            }, {ignore: true}) + ';\n';
    };

    this.writeCommit = function(commit) {
        var authorQuery = new this.sql.Expression(this.sql.select(
            ["id"],
            "author",
            "`name`='" + commit.author.name + "' AND `email`='" + commit.author.email + "'"));

        return this.sql.insert("commit",
            {
                project: new this.sql.Expression('@project_id'),
                commit_oid: commit.id,
                date: commit.date,
                message: commit.message.trim(),
                author: authorQuery
            }) + ";\n";
    };

    this.writeFileEntry = function(oid) {
        return this.sql.insert("file_entry",
            {
                project: new this.sql.Expression("@project_id"),
                entry_oid: oid
            }) + ";\n";
    };

    this.writePath = function(path) {
        return this.sql.insert("path",
            {
                path: path
            }, {ignore: true}) + ";\n";
    };

    this.writeCommitFile = function(commitOid, entryFileOid, path) {
        var commitQuery = new this.sql.Expression(this.sql.select(["id"],"commit",
            "`commit_oid` = '" + commitOid + "' AND project = @project_id"));
        var fileQuery = new this.sql.Expression(this.sql.select(["id"],"file_entry",
            "`entry_oid` = '" + entryFileOid + "' AND project = @project_id"));
        var pathQuery = new this.sql.Expression(this.sql.select(["id"],"path",
            "`path` = '" + path + "'"));

        return this.sql.insert("commit_file",
            {
                commit: commitQuery,
                file: fileQuery,
                path: pathQuery
            }) + ";\n";
    };

    this.queryFileEntryId = function(fileOid) {
        return this.sql.select(["id"],"file_entry","`entry_oid` = '" + fileOid + "' AND project = @project_id");
    };

    this.writeFileMetrics = function(fileOid, metrics) {
        var fileQuery = new this.sql.Expression(this.queryFileEntryId(fileOid));

        var sqlQuery = this.sql.insert("file_metrics",
            {
                file_entry: fileQuery,
                loc: metrics.loc,
                cyclomatic: metrics.cyclomatic,
                functions: metrics.functionCount
            }) + ";\n";

        return sqlQuery;
    };

    this.writeFunctionMetrics = function(fileOid, metrics) {
        var fileQuery = new this.sql.Expression(this.queryFileEntryId(fileOid));

        var sqlQuery = this.sql.insert("function_metrics",
                {
                    file_entry: fileQuery,
                    name: metrics.name,
                    line: metrics.line,
                    loc: metrics.loc,
                    cyclomatic: metrics.cyclomatic,
                    params: metrics.params
                }) + ";\n";

        return sqlQuery;
    };
}

exports = module.exports = new MySqlExporter();