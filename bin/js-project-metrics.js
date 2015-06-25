#! /usr/bin/env node
var commander = require("commander"),
    metricsCommand = require("../lib/commands/ProjectMetricsCommand.js"),
    config = {};

commander
    .version("0.0.1")
    .option("-v, --verbose", "Verbose output (to stderr)")
    .usage("[options] <repository> <output-file>")
    .parse(process.argv);

if (commander.args.length !== 2) {
    commander.help();
    return 1;
}

if (commander.verbose)
    config.verbose = true;

metricsCommand.run(commander.args[0], commander.args[1], config);
