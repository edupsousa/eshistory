var _ = require('lodash'),
    q = require('q'),
    Workers = require('../util/Workers.js'),
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

MetricsExtractor.prototype.getReferences = function(commitList) {
    return this.explorer.getReferenceList()
        .then(function(refs) {
            var filteredList = [];
            for (var i = 0; i < refs.length; i++) {
                ref = refs[i];
                var refExists = commitList.some(function(commit) {
                    return commit.id === ref.target;
                });
                if (refExists)
                    filteredList[filteredList.length] = ref;
            }
            return filteredList;
        });
};

MetricsExtractor.prototype.getCommits = function(branch) {
    return this.explorer.getCommits(branch)
        .then(function(commits) {
            return commits;
        });
};

MetricsExtractor.prototype.getUniqueAuthors = function(commits) {
    var authors = [];

    for (var i = 0; i < commits.length; i++) {
        var commit = commits[i];
        var hasAuthor = authors.some(function(author) {
            return (author.name == commit.author.name && author.email == commit.author.email);
        });
        if (!hasAuthor) {
            authors[authors.length] = commit.author;
        }
    }
    return authors;
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

MetricsExtractor.prototype.getMetricsForEntries = function(fileEntries, entryCallback) {
    var self = this;
    var metrics = [];
    var messagesToSend = [];

    var messageCallback = function(result, pid) {
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
        if (entryCallback)
            entryCallback(pid, metrics[metrics.length-1]);
    };

    var timeoutCallback = function(message, pid) {
        metrics.push({
            id: message.entry.id,
            error: true,
            reason: "TIMEOUT " + message.entry.source.length
        });
        if (entryCallback)
            entryCallback(pid, metrics[metrics.length-1]);
    };

    var walkFiles = this.explorer.createFileWalker(fileEntries);
    return walkFiles(function(id, contents) {
        messagesToSend.push({
            command: "metrics",
            entry: {
                id:id,
                source:contents
            }
        });
    }).then(function() {
        var workers = new Workers(self.maxChilds, __dirname + "/JSMetricsWorker.js", 10);
        return workers.doWork(messagesToSend, messageCallback, timeoutCallback).then(function() {
            workers.killAll();
            return metrics;
        });
    });
};

exports = module.exports = MetricsExtractor;