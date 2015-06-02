var Squel = require('squel');

function MySqlFormatter() {
    this.squel = Squel.useFlavour('mysql');
    this.squel.registerValueHandler(Date, function (date) {
        return "'" + date.toISOString().slice(0, 19).replace('T', ' ') + "'";
    });
}

MySqlFormatter.prototype.commitsHeader = function () {
    return '';
};

MySqlFormatter.prototype.commitEntry = function (repositoryName, commit) {
    return this.squel
            .insert()
            .into('commit')
            .set('commit_id', commit.id)
            .set('repository', repositoryName)
            .set('date', commit.date)
            .set('author', espaceString(commit.author))
            .set('message', espaceString(commit.message.trim())) + ';\n';
};

MySqlFormatter.prototype.commitsFooter = function () {
    return '';
};

MySqlFormatter.prototype.commitFilesHeader = function () {
    return '';
};

MySqlFormatter.prototype.commitFilesEntry = function (commitId, files) {
    var self = this;
    var output = '';
    files.forEach(function (file) {
        output += self.squel
                .insert()
                .into('commit_file')
                .set('file_id', file.id)
                .set('commit_id', commitId)
                .set('path', file.path).toString() + ';\n';
    });
    return output;
};

MySqlFormatter.prototype.commitFilesFooter = function () {
    return '';
};

MySqlFormatter.prototype.fileMetricsHeader = function () {
    return '';
};

MySqlFormatter.prototype.fileMetricsEntry = function (file) {
    if (file.error) {
        return this.squel
                .insert()
                .into('file_error')
                .set('file_id', file.id)
                .set('reason', file.reason).toString() + ';\n';
    } else {
        return this.squel
                .insert()
                .into('file_metrics')
                .set('file_id', file.id)
                .set('loc', file.data.loc)
                .set('cyclomatic', file.data.cyclomatic)
                .set('functions', file.data.functionCount).toString() + ';\n';
    }
};

MySqlFormatter.prototype.fileMetricsFooter = function () {
    return '';
};

MySqlFormatter.prototype.functionMetricsEntry = function (id, index, metrics) {
    return this.squel
            .insert()
            .into('function_metrics')
            .set('file_id', id)
            .set('fn_index', index)
            .set('name', metrics.name)
            .set('line', metrics.line)
            .set('loc', metrics.loc)
            .set('cyclomatic', metrics.cyclomatic)
            .set('params', metrics.params)
            .toString() + ';' + '\n';
};

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

exports = module.exports = MySqlFormatter;