#! /usr/bin/env node
var commander = require("commander"),
    metricsCommand = require("../lib/commands/ProjectMetricsCommand.js"),
    config = {
        verbose: false,
        showHeapUsage: false,
        maxChildProcesses: 2,
        commitFilter: {
            branch: false,
            onlyTagged: false
        }
    };

commander
    .version("0.0.1")
    .option("-c, --child-processes <n>", "Fork tasks in <n> child processes (Default: 2).", parseInt)
    .option("-h, --heap-usage <n>", "Report memory heap usage every <n> seconds (on stderr).", parseInt)
    .option("-v, --verbose", "Verbose output on stderr.")

    .option("--branch <name>", "Extract commits from the specified branch.")
    .option("--only-tagged-commits", "Extract only commits pointed by tags.")

    .usage("[options] <repository> <output-file>")
    .parse(process.argv);

if (commander.args.length !== 2) {
    commander.help();
    return 1;
}

if (commander.verbose)
    config.verbose = true;

if (commander.heapUsage)
    config.showHeapUsage = commander.heapUsage;

if (commander.childProcesses)
    config.maxChildProcesses = commander.childProcesses;

if (commander.branch)
    config.commitFilter.branch = commander.branch;

if (commander.onlyTaggedCommits)
    config.commitFilter.onlyTagged = true;

metricsCommand.run(commander.args[0], commander.args[1], config);
