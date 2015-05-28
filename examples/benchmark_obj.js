var GitExplorer = require('../lib/GitExplorer');

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

    var _commits;
    var _files;
    var _contents;

    function getRepositoryStatistics() {
        var commitCount = _commits.length;
        var maxFiles = 0;
        var minFiles = 0;
        var avgFiles = 0;
        var totalFiles = 0;

        _commits.forEach(function(commit) {
            var commitId = commit.id;
            if (totalFiles === 0) {
                totalFiles = avgFiles = minFiles = maxFiles = _files[commitId].length;
            } else {
                var commitFiles = _files[commitId].length;
                totalFiles += commitFiles;
                maxFiles = commitFiles > maxFiles ? commitFiles : maxFiles;
                minFiles = commitFiles < minFiles ? commitFiles : minFiles;
            }
        });
        console.log('\n*** Repository Statistics ***');
        console.log('Commits: %d', commitCount);
        console.log('Files: %d (Max: %d - Min: %d - Avg: %d)', totalFiles, maxFiles, minFiles, (totalFiles / commitCount).toFixed(2));
        console.log('Distinct Files: %d', Object.keys(_contents).length);
    }

    benchmarker.showTime('.open');
    GitExplorer.open('/Users/edupsousa/Documents/JSMetrics/repositories/express')
        .then(function(explorer) {
            benchmarker.showTime('.getHistory');
            explorer.getHistory()
                .then(function(history) {
                    benchmarker.showTime('.getCommits');
                    return explorer.getCommits(history);
                })
                .then(function(commits) {
                    _commits = commits;
                    benchmarker.showTime('.listFiles');
                    return explorer.listFiles(commits);
                })
                .then(function(files) {
                    _files = files;
                    benchmarker.showTime('.getFilesContents');
                    return explorer.getFilesContents(files);
                })
                .done(function(contents) {
                    _contents = contents;
                    benchmarker.showTime('Done');
                    benchmarker.showExecutionTime();
                    benchmarker.showMemory();

                    getRepositoryStatistics();
                });
        });

})(new Benchmarker());
