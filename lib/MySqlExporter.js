
function SqlGenerator() {

    function parseValueType(value) {
        if (typeof value === 'number') {
            return value;
        } else {
            return "'" + value + "'";
        }
    }

    function parseFieldName(fieldName) {
        return "`" + fieldName + "`";
    }

    this.insert = function(table, values) {
        var insertFields = [];
        var insertValues = [];

        for (var fieldName in values) {
            insertFields.push(parseFieldName(fieldName));
            insertValues.push(parseValueType(values[fieldName]));
        }
        insertFields = insertFields.join(',');
        insertValues = insertValues.join(',');

        return "INSERT INTO `" + table + "` (" + insertFields + ") VALUES (" + insertValues + ")"
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
}

function MySqlExporter() {
    this.sql = new SqlGenerator();

    this.writeProject = function(projectName) {
        return this.sql.insert("project", {name: projectName}) + ";\n" +
                this.sql.set("project_id",
                    this.sql.select(["id"], "project", "`name` = '" + projectName + "'")
                ) + ";\n";

    }
}

exports = module.exports = new MySqlExporter();