var _ = require('lodash'),
    q = require('q'),
    GitExplorer = require('./../explorer/GitExplorer.js');

function MetricsExtractor(explorer) {
    this.explorer = explorer;
}

MetricsExtractor.getExtractorForRepository = function(repositoryPath) {
    return GitExplorer.open(repositoryPath)
        .then(function(explorer) {
            return new MetricsExtractor(explorer);
        });
};

MetricsExtractor.prototype.getCommitsAndAuthors = function() {
    return this.explorer.getCommitsAndAuthors();
};

MetricsExtractor.prototype.getFilesFromCommits = function(commits) {
    return this.explorer.listFiles(commits)
        .then(function(result) {
            result.fileLength = 0;
            for (var commitId in result.files) {
                result.fileLength += result.files[commitId].length;
            }
            return result;
        });
};

MetricsExtractor.prototype.getMetricsForEntries = function(fileEntries) {
    var def = q.defer();
    var metrics = [];
    var cp = require('child_process');
    var instances = 2;
    var workers = [];

    var todoCount = 0;
    var nextWorker = 0;

    var messageReceived = function(result) {
        if (result.error) {
            metrics.push({
                id: result.id,
                error: true,
                reason: result.reason
            });
        } else {
            metrics.push({
                id: result.id,
                error: false,
                data: result.data
            });
        }
        todoCount--;
        if (todoCount === 0) {
            for (var i = 0; i < workers.length; i++) {
                workers[i].kill();
            }
            def.resolve(metrics);
        }
    };

    for (var i = 0; i < instances; i++) {
        workers[i] = cp.fork(__dirname + '/JSMetricsWorker.js');
        workers[i].on('message', messageReceived)
    }

    var walkFiles = this.explorer.createFileWalker(fileEntries);
    walkFiles(function(id, contents, totalFiles) {
        workers[nextWorker].send({
            id:id,
            source:contents,
            total: totalFiles
        });
        nextWorker++;
        if (nextWorker == instances) nextWorker = 0;
        todoCount++;
    });

    return def.promise;
};

exports = module.exports = MetricsExtractor;