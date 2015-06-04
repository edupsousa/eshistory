var Commander = require('commander'),
    Path = require('path'),
    Package = require(Path.join(__dirname, '../package.json')),
    Benchmarker = require('../lib/Benchmarker.js'),
    GitExplorer = require('../lib/GitExplorer.js'),
    JSMetrics = require('../lib/JSMetrics.js'),
    MySqlExporter = require('../lib/MySqlExporter.js');

var ProjectMetricsCommand = {};

ProjectMetricsCommand.run = function () {
    var self = this;
    this.parseCommandLineArguments();
    if (this.incorrectCommandLineArguments())
        return;
    this.setCommandConfiguration();
    this.startBenchmarking();
    return this.processActions()
        .catch(function (error) {
            console.error(error);
        })
        .done(function() {
            console.warn(self.benchmarker.getMemory());
            self.verboseLog('Finished.');
        });
};

ProjectMetricsCommand.parseCommandLineArguments = function () {
    Commander
        .version(Package.version)
        .option('-c, --commits', 'Output commit details.')
        .option('-f, --files', 'Output commits files')
        .option('-m, --metrics', 'Output files metrics')
        .option('-v, --verbose', 'Verbose output (to stderr).')
        .option('-b, --benchmark', 'Display execution time and memory usage (on stderr).')
        .usage('<repository>')
        .parse(process.argv);
};

ProjectMetricsCommand.incorrectCommandLineArguments = function () {
    if (Commander.args.length !== 1) {
        Commander.help();
        return true;
    }
    return false;
};

ProjectMetricsCommand.setCommandConfiguration = function () {
    this.setOutputOptions();
    this.setToDoActions();
    this.setShowActions();
    this.setFormatter();
    this.setRepositoryPath();
    this.setRepositoryName();
};

ProjectMetricsCommand.setFormatter = function () {
    this.exporter = MySqlExporter;
};

ProjectMetricsCommand.setRepositoryPath = function () {
    this.repositoryPath = Path.resolve(Commander.args[0]);
};

ProjectMetricsCommand.setRepositoryName = function () {
    this.repositoryName = Path.basename(Path.resolve(this.repositoryPath));
};

ProjectMetricsCommand.setToDoActions = function () {
    this.actions = {
        commits: false,
        files: false,
        metrics: false
    };
    if (Commander.commits || Commander.files || Commander.metrics)
        this.actions.commits = true;
    if (Commander.files || Commander.metrics)
        this.actions.files = true;
    if (Commander.metrics)
        this.actions.metrics = true;
};

ProjectMetricsCommand.setShowActions = function () {
    this.show = {
        commits: false,
        files: false,
        metrics: false
    };
    if (Commander.commits)
        this.show.commits = true;
    if (Commander.files)
        this.show.files = true;
    if (Commander.metrics)
        this.show.metrics = true;
};

ProjectMetricsCommand.setOutputOptions = function () {
    this.showVerboseLog = Commander.verbose;
};

ProjectMetricsCommand.startBenchmarking = function () {
    this.benchmarker = new Benchmarker();
};

ProjectMetricsCommand.processActions = function () {
    var promise = this.openRepository();

    this.showSetProject();

    if (this.actions.commits) {
        promise = promise.then(this.getCommits.bind(this));
        if (this.show.commits) {
            promise = promise.then(this.showCommits.bind(this));
        }
        if (this.actions.files) {
            promise = promise.then(this.getFiles.bind(this));
            if (this.show.files)
                promise = promise.then(this.showFiles.bind(this));
            if (this.actions.metrics) {
                promise = promise.then(this.getMetrics.bind(this));
                if (this.show.metrics)
                    promise = promise.then(this.showMetrics.bind(this));
            }
        }
    }

    return promise;
};

ProjectMetricsCommand.openRepository = function () {
    var self = this;
    self.verboseLog('Opening Repository: %s.', self.repositoryPath)
    return GitExplorer.open(self.repositoryPath)
        .then(function (explorer) {
            self.verboseLog('Successfully Opened Repository: %s.', self.repositoryName)
            self.explorer = explorer;
        });
};

ProjectMetricsCommand.getCommits = function () {
    var self = this;
    self.verboseLog('Retrieving Commits.')
    return self.explorer.getCommitsAndAuthors()
        .then(function (result) {
            self.verboseLog('Successfully Retrieved %d commits and %d authors.',
                result.commits.length, result.authors.length);
            self.commits = result.commits;
            self.authors = result.authors;
        });
};

ProjectMetricsCommand.showSetProject = function () {
    this.print(this.exporter.writeProject(this.repositoryName));
};

ProjectMetricsCommand.showCommits = function () {
    var self = this;

    self.showAuthors();
    self.verboseLog('Writing Commits.')
    for (var i = 0; i < self.commits.length; i++) {
        self.print(self.exporter.writeCommit(self.commits[i]));
    }
};

ProjectMetricsCommand.showAuthors = function () {
    var self = this;
    self.verboseLog('Writing Authors.')
    for (var i = 0; i < self.authors.length; i++) {
        self.print(self.exporter.writeAuthor(self.authors[i]));
    }
};

ProjectMetricsCommand.getFiles = function () {
    var self = this;
    self.verboseLog('Retrieving Files.');
    return self.explorer.listFiles(self.commits)
        .then(function (result) {
            var files = result.files;
            var paths = result.paths;
            var entries = result.entries;
            if (self.showVerboseLog) {
                var fileCount = 0;
                for (var commitId in files) {
                    fileCount += files[commitId].length;
                }
                self.verboseLog('Retrieved %d files. With %d distinct paths and %d distinct entries.',
                    fileCount, paths.length, entries.length);
            }
            self.paths = paths;
            self.fileEntries = entries;
            self.files = files;
        });
};

ProjectMetricsCommand.showPaths = function() {
    this.verboseLog('Writing paths');
    for (var  i = 0; i < this.paths.length; i++) {
        this.print(this.exporter.writePath(this.paths[i]));
    }
};

ProjectMetricsCommand.showFileEntries = function() {
    this.verboseLog('Writing file entries');
    for (var  i = 0; i < this.fileEntries.length; i++) {
        this.print(this.exporter.writeFileEntry(this.fileEntries[i]));
    }
};

ProjectMetricsCommand.showCommitsFiles = function() {
    this.verboseLog('Writing Commits Files.')
    var commitCount = 1;
    for (var commitId in this.files) {
        this.verboseLog('Showing commit %s files. (%d/%d)', commitId, commitCount, this.commits.length);
        var files = this.files[commitId];
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            this.print(this.exporter.writeCommitFile(commitId, file.id, file.path));
        }
        commitCount++;
    }
};

ProjectMetricsCommand.showFiles = function() {
    this.showPaths();
    this.showFileEntries();
    this.showCommitsFiles();
};

ProjectMetricsCommand.getMetrics = function() {
    var self = this;
    self.verboseLog('Starting Metrics Calculation.');
    var metrics = [];
    var successCount = 0;
    var errorCount = 0;
    var walkFiles = self.explorer.createFileWalker(self.fileEntries);
    return walkFiles(function (id, contents, totalCount) {
        var fileComplexity = {};
        fileComplexity.id = id;
        self.verboseLog('(%d/%d) - Calculating Metrics For File: %s', (successCount+errorCount+1), totalCount, id);
        try {
            fileComplexity.data = JSMetrics(contents);
            fileComplexity.error = false;
            successCount++;
            self.verboseLog('Successfully Calculated Metrics For: %s', id);
        } catch (error) {
            fileComplexity.error = true;
            fileComplexity.reason = error.toString();
            errorCount++;
            self.verboseLog('Error Calculating Metrics For: %s', id);
        }
        metrics.push(fileComplexity);
    }).then(function() {
        self.verboseLog('Finished Metrics Calculation. Success: %d - Error: %d', successCount, errorCount);
        self.metrics = metrics;
    });
};

ProjectMetricsCommand.showMetrics = function() {
    this.verboseLog('Showing/Writing Metrics.')
    var self = this;
    self.metrics.forEach(function(file, i) {
        self.verboseLog("Displaying metrics for file %d of %d.", i+1, self.metrics.length);
        if (! file.error) {
            self.print(self.exporter.writeFileMetrics(file.id, file.data));
            self.verboseLog("Displaying %d functions metrics.", file.data.functions.length);
            for (var i = 0; i < file.data.functions.length; i++) {
                self.print(self.exporter.writeFunctionMetrics(file.id, file.data.functions[i]));
            }
        }
    });
};

ProjectMetricsCommand.verboseLog = function () {
    if (this.showVerboseLog || this.showVeryVerboseLog) {
        arguments[0] = this.benchmarker.getElapsedTime() + '\t' + arguments[0];
        console.warn.apply(this, arguments);
    }
};

ProjectMetricsCommand.print = function () {
    arguments[0] = arguments[0].trim();
    console.log.apply(this, arguments);
};

exports = module.exports = ProjectMetricsCommand;