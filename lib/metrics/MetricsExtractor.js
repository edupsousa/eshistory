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
    var def = q.defer();
    var metrics = [];
    var cp = require('child_process');
    var instances = this.maxChilds;
    var workers = [];
    var workingOn = [];
    var messagesToSend = [];
    var liveWorkers = 0;

    var messageReceived = function(workerIndex, result) {
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
            entryCallback(workerIndex, metrics[metrics.length-1]);

        if (messagesToSend.length > 0) {
            workers[workerIndex].send(messagesToSend.shift());
        } else {
            workers[workerIndex].kill();
            liveWorkers--;
            if (liveWorkers == 0)
                def.resolve(metrics);
        }
    };

    var walkFiles = this.explorer.createFileWalker(fileEntries);
    walkFiles(function(id, contents, totalFiles) {
        messagesToSend.push({
            id:id,
            source:contents,
            total: totalFiles
        });
    }).then(function() {
        for (var i = 0; i < instances; i++) {
            liveWorkers++;
            workers[i] = cp.fork(__dirname + '/JSMetricsWorker.js');
            workers[i].on('message', messageReceived.bind(null, i));
            if (messagesToSend.length > 0)
                workers[i].send(messagesToSend.shift());
        }
    });

    return def.promise;
};

exports = module.exports = MetricsExtractor;