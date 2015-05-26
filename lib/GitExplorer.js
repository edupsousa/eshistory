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

GitExplorer.prototype.getLastCommitOnBranch = function(branch) {
    return this._repository.getBranchCommit(branch)
        .then(function(commit) {
            return commitToObject(commit);
        });
};

GitExplorer.prototype.listCommits = function(branch) {
    var deferred = Q.defer();

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

GitExplorer.prototype.mapToCommitFiles = function(commitId, callback) {
    return this.listCommitFiles(commitId)
        .then(function(files) {
            var result = [];
            files.forEach(function(file) {
                result.push(callback(file));
            });
            return result;
        });
};

GitExplorer.prototype.mapToBranchCommits = function(branch, callback) {
    return this.listCommits(branch)
        .then(function(commits) {
            var result = [];
            commits.forEach(function(commit) {
                result.push(callback(commit));
            });
            return result;
        });
};

GitExplorer.prototype.mapToBranchCommitsAndFiles = function(branch, callback) {
    var _self = this;
    return _self.listCommits(branch)
        .then(function(commits) {
            var results = [];
            return _self.walkCommitArray(commits, function(commit, files) {
                results.push(callback(commit, files));
            }).then(function() {
                return results;
            });
        });
};

GitExplorer.prototype.walkCommitArray = function(commits, callback, index) {
    var _self = this;

    if (index === undefined)
        index = 0;
    if (commits[index] === undefined)
        return;

    return _self.listCommitFiles(commits[index].id)
        .then(function(files) {
            return callback(commits[index], files);
        })
        .then(function() {
            return _self.walkCommitArray(commits, callback, index+1);
        });
};

function commitToObject(commit) {
    return {
        id: commit.sha(),
        date: commit.date(),
        author: commit.author().toString(),
        message: commit.message()
    };
}

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