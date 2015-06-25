var _ = require('lodash'),
    q = require('q'),
    GitExplorer = require('./../explorer/GitExplorer.js');

function MetricsExtractor(explorer, maxChilds) {
    this.explorer = explorer;
    this.maxChilds = maxChilds;
}

MetricsExtractor.getExtractorForRepository = function(repositoryPath, maxChilds) {
    return GitExplorer.open(repositoryPath)
        .then(function(explorer) {
            return new MetricsExtractor(explorer, maxChilds);
        });
};

MetricsExtractor.prototype.getCommitsAndAuthors = function(commitFilter) {
    return this.explorer.getCommitsAndAuthors(commitFilter);
};

MetricsExtractor.prototype.getFilesFromCommits = function(commits) {
    return this.explorer.listFiles(commits, this.maxChilds)
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
    var instances = this.maxChilds;
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