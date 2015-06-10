var _ = require('lodash'),
    JSMetrics = require('./JSMetrics.js'),
    GitExplorer = require('./GitExplorer.js');

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
    return this.explorer.listFiles(commits);
};

MetricsExtractor.prototype.getMetricsForEntries = function(fileEntries) {
    var metrics = [];
    var walkFiles = this.explorer.createFileWalker(fileEntries);
    return walkFiles(function(id, contents) {
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
    }).then(function() {
        return metrics;
    });
};

exports = module.exports = MetricsExtractor;