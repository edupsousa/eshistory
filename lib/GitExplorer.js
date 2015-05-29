var Q = require('q'),
    NodeGit = require('nodegit');

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
            return Q.when(walkFn(id)).then(function() { recursiveWalker(walkFn); });
        });
    }

    return recursiveWalker;
};

GitExplorer.prototype.getCommits = function() {
    var self = this;
    var commits = [];
    var walkHistory = this.createHistoryWalker();

    return walkHistory(function(id) {
        return self.gitRepository.getCommit(id)
            .then(function(commit) {
                commits.push({
                    id: commit.id().toString(),
                    date: commit.date(),
                    message: commit.message(),
                    author: commit.author().toString()
                });
            });
    }).then(function() {
        return commits;
    });

};

GitExplorer.prototype.listFiles = function(commits) {
    var self = this;
    var commitsFiles = {};
    var getFiles = function(i) {
        if (!commits[i]) return;

        return self.listCommitFiles(commits[i].id)
            .then(function(files) {
                commitsFiles[commits[i].id] = files;
                return getFiles(i+1);
            });
    };

    return getFiles(0)
        .then(function() {
            return commitsFiles;
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

GitExplorer.prototype.getFilesContents = function(commits) {
    var self = this;
    var filesContents = {};
    var commitIds = Object.keys(commits);

    var walkCommits = function(commitIndex) {
        var commitFiles = commits[commitIds[commitIndex]];
        if (!commitFiles) return;

        var walkFiles = function(fileIndex) {
            var file = commitFiles[fileIndex];
            if (!file) return;

            if (filesContents[file.id]) {
                return walkFiles(fileIndex+1);
            } else {
                return self.gitRepository.getBlob(file.id)
                    .then(function(blob) {
                        filesContents[file.id] = blob.toString();
                        return walkFiles(fileIndex+1);
                    });
            }
        }

        return Q.when(walkFiles(0)).then(function() {
            return walkCommits(commitIndex+1);
        });
    }

    return walkCommits(0).then(function() {
        return filesContents;
    });
};

exports = module.exports = GitExplorer;