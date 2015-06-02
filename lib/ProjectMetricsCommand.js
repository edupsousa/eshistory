var Commander = require('commander'),
    Path = require('path'),
    Package = require(Path.join(__dirname, '../package.json')),
    Benchmarker = require('../lib/Benchmarker.js'),
    GitExplorer = require('../lib/GitExplorer.js'),
    JSMetrics = require('../lib/JSMetrics.js');

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
    this.formatter = new (require('../lib/MySqlFormatter.js'))();
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
    var self = this;
    var promise = this.openRepository();

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
    return self.explorer.getCommits()
        .then(function (commits) {
            self.verboseLog('Successfully Retrieved %d Commits.', commits.length);
            self.commits = commits;
        });
};

ProjectMetricsCommand.showCommits = function () {
    var self = this;
    self.verboseLog('Showing/Writing Commits.')
    self.print(self.formatter.commitsHeader());
    self.commits.forEach(function (commit) {
        self.print(self.formatter.commitEntry(self.repositoryName, commit));
    });
    self.print(self.formatter.commitsFooter());
};

ProjectMetricsCommand.getFiles = function () {
    var self = this;
    self.verboseLog('Retrieving Files.');
    return self.explorer.listFiles(self.commits)
        .then(function (files) {
            if (self.showVerboseLog) {
                var fileCount = 0;
                for (var commitId in files) {
                    fileCount += files[commitId].length;
                }
                self.verboseLog('Retrieved %d Files.', fileCount);
            }
            self.files = files;
        });
};

ProjectMetricsCommand.showFiles = function() {
    this.verboseLog('Showing/Writing Files.')
    this.print(this.formatter.commitFilesHeader());
    for (var commitId in this.files) {
        this.print(this.formatter.commitFilesEntry(commitId, this.files[commitId]));
    }
    this.print(this.formatter.commitFilesFooter());
};

ProjectMetricsCommand.getMetrics = function() {
    var self = this;
    self.verboseLog('Starting Metrics Calculation.');
    var metrics = [];
    var successCount = 0;
    var errorCount = 0;
    var walkFiles = self.explorer.createDistinctFilesWalker(self.files);
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
    self.print(self.formatter.fileMetricsHeader());
    self.metrics.forEach(function(file) {
        self.print(self.formatter.fileMetricsEntry(file));
        if (! file.error)
            self.showFunctionsMetrics(file.id, file.data.functions);
    });
    self.print(self.formatter.fileMetricsFooter());
};

ProjectMetricsCommand.showFunctionsMetrics = function(fileId, functions) {
    var self = this;
    functions.forEach(function(fn, index) {
        self.print(self.formatter.functionMetricsEntry(fileId, index+1, fn));
    });
};

ProjectMetricsCommand.verboseLog = function () {
    if (this.showVerboseLog) {
        arguments[0] = this.benchmarker.getElapsedTime() + '\t' + arguments[0];
        console.warn.apply(this, arguments);
    }
};

ProjectMetricsCommand.print = function () {
    arguments[0] = arguments[0].trim();
    console.log.apply(this, arguments);
};

exports = module.exports = ProjectMetricsCommand;