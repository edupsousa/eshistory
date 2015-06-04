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
    var commitsFiles = {};
    var paths = [];
    var entries = [];

    var getFiles = function(commitIndex) {
        if (!commits[commitIndex]) return;

        return self.listCommitFiles(commits[commitIndex].id)
            .then(function(files) {
                for (var i = 0; i < files.length; i++) {
                    var file = files[i];
                    if (! _.contains(paths, file.path)) {
                        paths[paths.length] = file.path;
                    }
                    if (!_.contains(entries, file.id)) {
                        entries[entries.length] = file.id;
                    }
                }
                commitsFiles[commits[commitIndex].id] = files;
                return getFiles(commitIndex+1);
            });
    };

    return getFiles(0)
        .then(function() {
            return {
                paths: paths,
                entries: entries,
                files: commitsFiles
            };
        });
};

GitExplorer.prototype.listCommitFiles = function(commitId) {
    var def = Q.defer();
    var files = [];

    this.gitRepository.getCommit(commitId)
        .then(function(commit) {
            return commit.getTree();
        })
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
                def.resolve(files);
            });
            walker.start();
        })

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