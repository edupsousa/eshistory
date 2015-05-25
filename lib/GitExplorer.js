var NodeGit = require('nodegit'),
    _ = require('underscore'),
    Q = require('q');

function GitExplorer(repository) {
    this._repository = repository;
}

GitExplorer.open = function(url) {
    return NodeGit.Repository.open(url)
        .then(function(repository) {
            return new GitExplorer(repository);
        });
};

GitExplorer.prototype.listCommits = function(branch) {
    var deferred = Q.defer();

    var commitToObject = function(commit) {
        return {
            id: commit.sha(),
            date: commit.date(),
            author: commit.author().toString(),
            message: commit.message()
        };
    };

    var promise = this._repository.getBranchCommit(branch)
        .then(function(firstCommit) {
            var history = firstCommit.history(NodeGit.Revwalk.SORT.TIME);

            history.on('end', function(commits) {
                promise.then(function() {
                    deferred.resolve(commits.map(commitToObject));
                    commits.forEach(function(commit) {
                        commit.free();
                    });
                });
            });

            history.start();
        });

    return deferred.promise;
};

GitExplorer.prototype.listCommitFiles = function(commitId) {
    return this._repository.getCommit(commitId)
        .then(function(commit) {
            return commit.getTree();
        })
        .then(function(tree) {
            return getFilesRecursively(tree);
        })
        .then(function(files) {
            return _.flatten(files);
        });
};

function getFilesRecursively(tree) {
    var deferred = Q.defer();
    var promises = [];

    tree.entries().forEach(function(entry) {
        if (entry.isTree()) {
            promises.push(entry.getTree().then(getFilesRecursively));
        } else if(/.+\.js$/i.test(entry.path())) {
            promises.push(entry.getBlob().then(
                function(blob) {
                    var file = {
                        path: entry.path(),
                        code: blob.toString()
                    };
                    blob.free();
                    return file;
                }
            ));
        }
    });

    Q.all(promises).then(function(files) {
        deferred.resolve(files);
    });

    return deferred.promise;
}

exports = module.exports = GitExplorer;