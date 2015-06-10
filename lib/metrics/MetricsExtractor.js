var _ = require('lodash'),
    JSMetrics = require('./JSMetrics.js'),
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

MetricsExtractor.prototype.getMetricsForEntries = function(fileEntries, onEntryCallBack) {
    var metrics = [];
    var walkFiles = this.explorer.createFileWalker(fileEntries);
    return walkFiles(function(id, contents, totalFiles) {
        try {
            var fileMetrics = JSMetrics(contents);
            metrics.push({
                id: id,
                error: false,
                data: fileMetrics
            });
        } catch (error) {
            metrics.push({
                id: id,
                error: true,
                reason: error.toString()
            });
        }
        if (onEntryCallBack)
            onEntryCallBack(metrics[metrics.length-1], totalFiles);
    }).then(function() {
        return metrics;
    });
};

exports = module.exports = MetricsExtractor;