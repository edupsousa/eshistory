var Commander = require('commander'),
    Path = require('path'),
    Package = require(Path.join(__dirname, '../package.json')),
    Benchmarker = require('./Benchmarker.js'),
    MetricsExtractor = require('./MetricsExtractor.js')
    MySqlExporter = require('./MySqlExporter.js');

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
            throw (error);
        })
        .done(function() {
            console.warn(self.benchmarker.getMemory());
            self.verboseLog('Finished.');
        });
};

ProjectMetricsCommand.parseCommandLineArguments = function () {
    Commander
        .version(Package.version)
        .option('-v, --verbose', 'Verbose output (to stderr).')
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
    this.setExporter();
    this.setRepositoryPath();
    this.setRepositoryName();
};

ProjectMetricsCommand.setOutputOptions = function () {
    this.showVerboseLog = Commander.verbose;
};

ProjectMetricsCommand.setExporter = function () {
    this.exporter = new MySqlExporter();
};

ProjectMetricsCommand.setRepositoryPath = function () {
    this.repositoryPath = Path.resolve(Commander.args[0]);
};

ProjectMetricsCommand.setRepositoryName = function () {
    this.repositoryName = Path.basename(Path.resolve(this.repositoryPath));
};

ProjectMetricsCommand.startBenchmarking = function () {
    this.benchmarker = new Benchmarker();
};

ProjectMetricsCommand.processActions = function () {
    var promise = this.createExtractor();

    this.showSetProject();

    promise = promise.then(this.getCommits.bind(this));
    promise = promise.then(this.showCommits.bind(this));
    promise = promise.then(this.getFiles.bind(this));
    promise = promise.then(this.showFiles.bind(this));
    promise = promise.then(this.getMetrics.bind(this));
    promise = promise.then(this.showMetrics.bind(this));

    return promise;
};

ProjectMetricsCommand.createExtractor = function () {
    var self = this;
    self.verboseLog('Starting repository extraction for %s.', self.repositoryPath)
    return MetricsExtractor.getExtractorForRepository(self.repositoryPath)
        .then(function (extractor) {
            self.verboseLog('Repository %s successfully opened.')
            self.extractor = extractor;
        });
};

ProjectMetricsCommand.getCommits = function () {
    var self = this;
    self.verboseLog('Starting commits and authors extraction.')
    return self.extractor.getCommitsAndAuthors()
        .then(function (result) {
            self.verboseLog('Successfully extracted %d commits and %d authors.',
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
    self.verboseLog('Writing commits.')
    self.print(self.exporter.writeCommits(self.commits));
};

ProjectMetricsCommand.showAuthors = function () {
    var self = this;
    self.verboseLog('Writing authors.')
    self.print(self.exporter.writeAuthors(self.authors));
};

ProjectMetricsCommand.getFiles = function () {
    var self = this;
    self.verboseLog('Extracting commits files.');
    return self.extractor.getFilesFromCommits(self.commits)
        .then(function (result) {
            self.verboseLog('Extracted %d commits files. With %d distinct paths and %d distinct entries.',
                result.filesLength, result.paths.length, result.entries.length);
            self.paths = result.paths;
            self.fileEntries = result.entries;
            self.files = result.files;
        });
};

ProjectMetricsCommand.showPaths = function() {
    this.verboseLog('Writing paths');
    this.print(this.exporter.writePaths(this.paths));
};

ProjectMetricsCommand.showFileEntries = function() {
    this.verboseLog('Writing file entries');
    this.print(this.exporter.writeFileEntries(this.fileEntries));
};

ProjectMetricsCommand.showCommitsFiles = function() {
    this.verboseLog('Writing commits Files.')
    var commitCount = 1;
    for (var commitId in this.files) {
        this.verboseLog('Writing commit %d of %d files.', commitCount, this.commits.length);
        this.print(this.exporter.writeCommitFiles(commitId, this.files[commitId]));
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
    var successCount = 0;
    var errorCount = 0;

    self.verboseLog('Extracting metrics from file entries.');
    return self.extractor.getMetricsForEntries(self.fileEntries, function(fileMetrics, totalFiles) {
        if (fileMetrics.error) {
            errorCount++;
        } else {
            successCount++;
        }
        self.verboseLog('Extracted %d of %d entries metrics.', successCount+errorCount, totalFiles);
    }).then(function(metrics) {
        self.verboseLog('Finished metrics extraction. Success: %d - Error: %d', successCount, errorCount);
        self.metrics = metrics;
    });
};

ProjectMetricsCommand.showMetrics = function() {
    this.verboseLog('Writing metrics.')
    this.print(this.exporter.writeFilesMetrics(this.metrics));
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