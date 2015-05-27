var NodeGit = require('nodegit'),
    Q = require('q');

function Benchmarker() {
    this.rss = 0;
    this.heapTotal = 0;
    this.heapUsed = 0;
    this.startTime = process.hrtime();
    this.lastTime = false;
    this.timeLabel = false;

    this.showTime = function(label) {
        if (this.lastTime) {
            var diff = process.hrtime(this.lastTime);
            console.log('Time Since ' + this.timeLabel + ': %ds %dms', diff[0], (diff[1]/1000000).toFixed(2));
        }
        this.timeLabel = label;
        this.lastTime = process.hrtime();
    };

    this.showExecutionTime = function() {
        var diff = process.hrtime(this.startTime);
        console.log('Total execution time: %ds %dms', diff[0], diff[1]/1000000);
    };

    this.showMemory = function() {
        var currentMemory = process.memoryUsage();
        console.log('********* Memory Usage *********');
        showParam('RSS', currentMemory.rss, this.rss);
        showParam('Heap Total', currentMemory.heapTotal, this.heapTotal);
        showParam('Heap Used', currentMemory.heapUsed, this.heapUsed);
        console.log('********************************');
        updateMemory(this, currentMemory);
    };

    function updateMemory(self, memory) {
        self.rss = memory.rss;
        self.heapTotal = memory.heapTotal;
        self.heapUsed = memory.heapUsed;
    }

    function showParam(label, current, previous) {
        var dif = current - previous;
        console.log(label + ': ' + toMb(current) + 'Mb (' + toMb(dif) + 'Mb)');
    }

    function toMb(bytes) {
        return (bytes / 1048576).toFixed(2);
    }
}

(function(benchmarker) {
    var repo;

    function openRepository(path) {
        benchmarker.showTime('openRepository');
        return NodeGit.Repository.open(path)
            .then(function(_repo) {
                repo = _repo;
                return repo;
            });
    }

    function getBaseCommit(repo) {
        benchmarker.showTime('getBaseCommit');
        return repo.getMasterCommit();
    }

    function walkCommitHistory(commit) {
        var limit = -1;
        benchmarker.showTime('walkCommitHistory');
        var commits = [];
        var revWalk = repo.createRevWalk();
        revWalk.sorting(NodeGit.Revwalk.SORT.TOPOLOGICAL, NodeGit.Revwalk.SORT.TIME);
        revWalk.push(commit.id());

        var walk = function() {
            return revWalk.next().then(function(id) {
                if (!id || limit == 0) return;

                commits.push(id.toString());
                limit--;

                return walk();
            });
        }

        return walk().then(function() {
            return commits;
        });
    }

    function getCommitDetails(ids) {
        benchmarker.showTime('getCommitDetails');
        var commits = [];
        var getDetails = function(i) {
            if (!ids[i]) return;

            return repo.getCommit(ids[i])
                .then(function(commit) {
                    commits.push({
                        id: commit.id(),
                        date: commit.date(),
                        message: commit.message(),
                        author: commit.author().toString()
                    });
                    return getDetails(i+1);
                });
        };
        return getDetails(0).then(function() {
            return commits;
        });
    }

    function getAllCommitsJSEntries(commits) {
        benchmarker.showTime('getAllCommitsJSEntries');

        var getFiles = function(i) {
            if (!commits[i]) return;

            return getCommitJSEntries(commits[i].id)
                .then(function(files) {
                    commits[i].files = files;
                    return getFiles(i+1);
                });
        };
        return getFiles(0)
            .then(function() {
                return commits;
            });
    }

    function getCommitJSEntries(commitId) {
        //benchmarker.showTime('getCommitJSEntries(' + commitId + ')');
        var files = [];
        var treeEntriesToDo = [];

        return repo.getCommit(commitId)
            .then(function(commit) {
                treeEntriesToDo.push(commit);
                var walkTreeEntry = function(treeEntry) {
                    if (!treeEntry) return;

                    return treeEntry.getTree().then(function(tree) {
                        tree.entries().forEach(function(entry) {
                            if (entry.isBlob() && /.+\.js$/i.test(entry.path())) {
                                files.push({
                                    id: entry.oid().toString(),
                                    path: entry.path()
                                });
                            } else if (entry.isTree()) {
                                treeEntriesToDo.push(entry);
                            }
                        })
                    }).then(function() {
                        return walkTreeEntry(treeEntriesToDo.pop());
                    });
                }
                return walkTreeEntry(treeEntriesToDo.pop());
            })
            .then(function() {
                return files;
            });
    }

    function getEntriesContents(commits) {
        benchmarker.showTime('getEntriesContents');
        var cache = {};

        var walkCommits = function(commitIndex) {
            var commit = commits[commitIndex];
            if (!commit) return;

            var walkFiles = function(fileIndex) {
                var file = commit.files[fileIndex];
                if (!file) return;

                if (cache[file.id] !== undefined) {
                    file.contents = cache[file.id];
                    return walkFiles(fileIndex+1);
                } else {
                    return repo.getBlob(file.id)
                        .then(function(blob) {
                            cache[file.id] = blob.toString();
                            file.contents = cache[file.id];
                            return walkFiles(fileIndex+1);
                        });
                }
            }

            return Q.when(walkFiles(0)).then(function() {
                return walkCommits(commitIndex+1);
            });
        }

        return walkCommits(0).then(function() {
            console.log('Distinct files: %d', Object.keys(cache).length);
            return commits;
        });
    }

    function getRepositoryStatistics(commits) {
        var commitCount = commits.length;
        var maxFiles = 0;
        var minFiles = 0;
        var avgFiles = 0;
        var totalFiles = 0;

        commits.forEach(function(commit) {
            if (totalFiles === 0) {
                totalFiles = avgFiles = minFiles = maxFiles = commit.files.length;
            } else {
                var commitFiles = commit.files.length;
                totalFiles += commitFiles;
                maxFiles = commitFiles > maxFiles ? commitFiles : maxFiles;
                minFiles = commitFiles < minFiles ? commitFiles : minFiles;
            }
        });
        console.log('\n*** Repository Statistics ***');
        console.log('Commits: %d', commitCount);
        console.log('Files: %d (Max: %d - Min: %d - Avg: %d)', totalFiles, maxFiles, minFiles, (totalFiles / commitCount).toFixed(2));
    }

    openRepository('/Users/edupsousa/Documents/JSMetrics/repositories/express')
        .then(getBaseCommit)
        .then(walkCommitHistory)
        .then(getCommitDetails)
        .then(getAllCommitsJSEntries)
        .then(getEntriesContents)
        .done(function(commits) {
            benchmarker.showTime('Done');
            benchmarker.showExecutionTime();
            benchmarker.showMemory();

            getRepositoryStatistics(commits);
        });

})(new Benchmarker());
