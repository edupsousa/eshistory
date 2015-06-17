var Q = require('q'),
    NodeGit = require('nodegit'),
    _ = require('lodash');

function GitExplorer(gitRepository) {
    this.gitRepository = gitRepository;
}

GitExplorer.open = function(url) {
    return NodeGit.Repository.open(url)
        .then(function(gitRepository) {
            return new GitExplorer(gitRepository);
        });
};

GitExplorer.prototype.createHistoryWalker = function() {
    var revWalk = this.gitRepository.createRevWalk();
    revWalk.sorting(NodeGit.Revwalk.SORT.TOPOLOGICAL, NodeGit.Revwalk.SORT.TIME);
    revWalk.pushHead();

    var recursiveWalker = function(walkFn) {
        return revWalk.next().then(function(id) {
            if (!id) return;
            walkFn(id);
            return recursiveWalker(walkFn);;
        });
    }

    return recursiveWalker;
};

GitExplorer.prototype.getCommitsAndAuthors = function() {
    var self = this;
    var commits = [];
    var authors = [];
    var signatures = [];
    var walkHistory = this.createHistoryWalker();

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
    }).then(function() {
        return {
            commits: commits,
            authors: authors
        };
    });

};

GitExplorer.prototype.listFiles = function(commits) {
    var self = this;
    var cp = require('child_process');
    var workerA = cp.fork(__dirname + '/GitTreeExplorer.js');
    var workerB = cp.fork(__dirname + '/GitTreeExplorer.js');
    var commitsFiles = {};
    var paths = [];
    var entries = [];
    var todoCount = 0;
    var openCount = 0;
    var messagesToSend = [];
    var def = Q.defer();

    var receiveFiles = function(worker, message) {
        var commitId = message.commitId;
        var files = message.files;
        console.log('files received %d', todoCount);
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            if (! _.contains(paths, file.path)) {
                paths[paths.length] = file.path;
            }
            if (!_.contains(entries, file.id)) {
                entries[entries.length] = file.id;
            }
        }
        commitsFiles[commitId] = files;
        todoCount--;
        if (todoCount === 0) {
            workerA.kill();
            workerB.kill();
            def.resolve({
                paths: paths,
                entries: entries,
                files: commitsFiles
            });
        } else {
            worker.send(messagesToSend.pop());
        }
    };

    var waitToOpen = function() {
        openCount++;
        if (openCount === 2) {
            workerA.removeListener('message', waitToOpen);
            workerB.removeListener('message', waitToOpen);
            workerA.on('message', receiveFiles.bind(this, workerA));
            workerB.on('message', receiveFiles.bind(this, workerB));

            for (var i = 0; i < commits.length; i++) {
                messagesToSend.push({
                    what: 'commit',
                    value: commits[i].id
                });
                todoCount++;
            }
            workerA.send(messagesToSend.pop());
            workerB.send(messagesToSend.pop());
        }
    };

    workerA.on('message', waitToOpen);
    workerB.on('message', waitToOpen);

    workerA.send({
        what:"repository",
        value:this.gitRepository.path(),
    });

    workerB.send({
        what:"repository",
        value:this.gitRepository.path(),
    });

    return def.promise;
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