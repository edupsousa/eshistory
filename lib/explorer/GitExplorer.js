var Q = require('q'),
    NodeGit = require('nodegit'),
    _ = require('lodash'),
    Workers = require('../util/Workers.js');

function GitExplorer(gitRepository) {
    this.gitRepository = gitRepository;
}

GitExplorer.open = function(url) {
    return NodeGit.Repository.open(url)
        .then(function(gitRepository) {
            return new GitExplorer(gitRepository);
        });
};

GitExplorer.prototype.createHistoryWalker = function(startCommitId) {
    var revWalk = this.gitRepository.createRevWalk();
    revWalk.sorting(NodeGit.Revwalk.SORT.TOPOLOGICAL, NodeGit.Revwalk.SORT.REVERSE);

    if (startCommitId !== undefined) {
        revWalk.push(startCommitId);
    } else {
        revWalk.pushHead();
    }

    var recursiveWalker = function(walkFn) {
        return revWalk.next().then(function(id) {
            if (!id) return;
            walkFn(id);
            return recursiveWalker(walkFn);;
        });
    };

    return recursiveWalker;
};


GitExplorer.prototype.getReferenceList = function() {
    var referenceList = [];

    return this.gitRepository.getReferences(NodeGit.Reference.TYPE.OID)
        .then(function(refs) {
            for (var i = 0 ; i < refs.length; i++) {
                var ref = refs[i];

                var target = ref.targetPeel();
                if (target === undefined)
                    target = ref.target();

                referenceList[referenceList.length] = {
                    target: target.toString(),
                    name: ref.name(),
                    isTag: ref.isTag(),
                    isBranch: ref.isBranch(),
                    isRemote: ref.isRemote(),
                };
            }
        }).then(function() {
            return referenceList;
        });
};

GitExplorer.prototype.getCommitsAndAuthors = function(filter) {
    var self = this;
    var commits = [];
    var authors = [];
    var signatures = [];

    var promise = Q();

    promise = promise.then(function() {
        return self.gitRepository.getBranchCommit(filter.branch);
    }).then(function(commit) {
        return self.createHistoryWalker(commit.id());
    }).then(function(walkHistory) {
            return walkHistory(function(id) {
                return self.gitRepository.getCommit(id)
                    .then(function(commit) {
                        var author = {
                            name: commit.author().name().toLowerCase(),
                            email: commit.author().email().toLowerCase(),
                        };
                        var signature = author.name + "<" + author.email + ">";
                        if (! _.contains(signatures, signature)) {
                            signatures[signatures.length] = signature;
                            authors[authors.length] = author;
                        }
                        commits.push({
                            id: commit.id().toString(),
                            date: commit.date(),
                            message: commit.message(),
                            author: author
                        });
                    });
            });
        });

    promise = promise.then(function() {
        return {
            commits: commits,
            authors: authors
        };
    });

    return promise;
};

GitExplorer.prototype.listFiles = function(commits, maxChilds) {
    var deferred = Q.defer();
    var paths = [],
        fileEntries = [],
        commitsFiles = [];
    var messagesToSend = [];

    for (var i = 0; i < commits.length; i++) {
        messagesToSend.push({
            command: 'commit',
            value: commits[i].id
        });
    }

    var messageReceiveCallback = function(message) {
        var commitId = message.commitId;
        var files = message.files;

        commitsFiles[commitId] = [];

        for (var i = 0; i < files.length; i++) {
            var file = files[i];

            var pathIndex = _.indexOf(paths, file.path);
            if (pathIndex === -1) {
                pathIndex = paths.length;
                paths[pathIndex] = file.path;
            }

            var entryIndex = _.indexOf(fileEntries, file.id);
            if (entryIndex === -1) {
                entryIndex = fileEntries.length;
                fileEntries[entryIndex] = file.id;
            }

            commitsFiles[commitId].push({
                id: fileEntries[entryIndex],
                path: paths[pathIndex]
            });
        }
    };

    var workers = new Workers(maxChilds, __dirname + "/GitExplorerWorker.js");
    workers.configure({repository: this.gitRepository.path()})
        .then(function() {
            return workers.doWork(messagesToSend, messageReceiveCallback)
        }).then(function() {
            workers.killAll();
            deferred.resolve({
                paths: paths,
                entries: fileEntries,
                files: commitsFiles
            });
        });


    return deferred.promise;
};

GitExplorer.prototype.listCommitFiles = function(commitId) {
    var def = Q.defer();
    var files = [];

    this.gitRepository.getCommit(commitId)
        .then(function(commit) {
            return commit.getTree()
                .then(function(tree) {
                    var walker = tree.walk(true);
                    walker.on('entry', function(entry) {
                        if (/.+\.js$/i.test(entry.path())) {
                            files[files.length] = {
                                id: entry.oid().toString(),
                                path: entry.path()
                            };
                        }
                    });
                    walker.on('end', function(entries) {
                        tree.free();
                        commit.free();
                        def.resolve(files);
                    });
                    walker.start();
                });
        });

    return def.promise;
};

GitExplorer.prototype.getDistinctFiles = function(files) {
    var distinctFiles = {};

    for (var commitId in files) {
        files[commitId].forEach(function(file) {
            if (! distinctFiles[file.id])
                distinctFiles[file.id] = true;
        });
    }

    return Object.keys(distinctFiles);
};

GitExplorer.prototype.createFileWalker = function(files) {
    var self = this;
    var i = 0;

    var walkFiles = function(callback) {
        if (!files[i]) return;
        return self.gitRepository.getBlob(files[i])
            .then(function(blob) {
                callback(files[i], blob.toString(), files.length);
                i++;
                return walkFiles(callback);
            });
    };
    return walkFiles;
};

GitExplorer.prototype.createDistinctFilesWalker = function(files) {
    var distinctFiles = this.getDistinctFiles(files);

    return this.createFileWalker(distinctFiles);
};

GitExplorer.prototype.getFilesContents = function(commits) {
    var filesContents = {};

    var walkFiles = this.createDistinctFilesWalker(commits);
    return walkFiles(function(id, contents) {
        filesContents[id] = contents;
    }).then(function() {
        return filesContents;
    });
};

exports = module.exports = GitExplorer;