var Path = require('path'),
    Benchmarker = require('./../util/Benchmarker.js'),
    MetricsExtractor = require('./../metrics/MetricsExtractor.js')
    MySqlExporter = require('./../exporter/MySQLScriptFile.js');

var ProjectMetricsCommand = {};

ProjectMetricsCommand.run = function (repositoryPath, outputPath, options) {
    var self = this;

    this.setRepository(repositoryPath);
    this.setOutput(outputPath);
    this.setOptions(options);

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

ProjectMetricsCommand.setOptions = function (options) {
    this.showVerboseLog = (options.verbose === true);
};

ProjectMetricsCommand.setOutput = function (outputPath) {
    try {
        this.exporter = new MySqlExporter(Path.resolve(outputPath));
    } catch (error) {
        console.error(error.toString());
        process.exit(1);
    }
};

ProjectMetricsCommand.setRepository = function (repositoryPath) {
    this.repositoryPath = Path.resolve(repositoryPath);
    this.repositoryName = Path.basename(Path.resolve(this.repositoryPath));
};

ProjectMetricsCommand.startBenchmarking = function () {
    this.benchmarker = new Benchmarker();
};

ProjectMetricsCommand.processActions = function () {
    var promise = this.createExtractor();

    this.exportProject();

    promise = promise.then(this.getCommits.bind(this));
    promise = promise.then(this.exportCommits.bind(this));
    promise = promise.then(this.getFiles.bind(this));
    promise = promise.then(this.exportFiles.bind(this));
    promise = promise.then(this.getMetrics.bind(this));
    promise = promise.then(this.exportMetrics.bind(this));

    return promise;
};

ProjectMetricsCommand.createExtractor = function () {
    var self = this;
    self.verboseLog('Starting repository extraction for %s.', self.repositoryPath)
    return MetricsExtractor.getExtractorForRepository(self.repositoryPath)
        .then(function (extractor) {
            self.verboseLog('Repository %s successfully opened.');
            self.extractor = extractor;
        });
};

ProjectMetricsCommand.getCommits = function () {
    var self = this;
    self.verboseLog('Starting commits and authors extraction.');

    return self.extractor.getCommitsAndAuthors()
        .then(function (result) {
            self.verboseLog('Successfully extracted %d commits and %d authors.',
                result.commits.length, result.authors.length);
            self.commits = result.commits;
            self.authors = result.authors;
        });
};

ProjectMetricsCommand.exportProject = function () {
    this.exporter.exportProject(this.repositoryName);
};

ProjectMetricsCommand.exportCommits = function () {
    this.exportAuthors();
    this.verboseLog('Exporting commits.')
    this.exporter.exportCommits(this.commits);
};

ProjectMetricsCommand.exportAuthors = function () {
    this.verboseLog('Exporting authors.')
    this.exporter.exportAuthors(this.authors);
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

ProjectMetricsCommand.exportPaths = function() {
    this.verboseLog('Exporting paths');
    this.exporter.exportPaths(this.paths);
};

ProjectMetricsCommand.exportFileEntries = function() {
    this.verboseLog('Exporting file entries');
    this.exporter.exportFileEntries(this.fileEntries);
};

ProjectMetricsCommand.exportCommitsFiles = function() {
    this.verboseLog('Exporting commits Files.')
    var commitCount = 1;
    for (var commitId in this.files) {
        this.verboseLog('Writing commit %d of %d files.', commitCount, this.commits.length);
        this.exporter.exportCommitFiles(commitId, this.files[commitId]);
        commitCount++;
    }
};

ProjectMetricsCommand.exportFiles = function() {
    this.exportPaths();
    this.exportFileEntries();
    this.exportCommitsFiles();
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

ProjectMetricsCommand.exportMetrics = function() {
    this.verboseLog('Exporting metrics.')
    this.exporter.exportFilesMetrics(this.metrics);
};

ProjectMetricsCommand.verboseLog = function () {
    if (this.showVerboseLog || this.showVeryVerboseLog) {
        arguments[0] = this.benchmarker.getElapsedTime() + '\t' + arguments[0];
        console.warn.apply(this, arguments);
    }
};

exports = module.exports = ProjectMetricsCommand;