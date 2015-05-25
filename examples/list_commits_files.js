var Q = require('q'),
    GitExplorer = require('../lib/GitExplorer.js');

var explorer = null;

function openRepository() {
    return GitExplorer.open('/Users/edupsousa/Documents/JSMetrics/repositories/express')
        .then(function(gitExplorer) {
            explorer = gitExplorer;
        });
}

function listCommits() {
    return explorer.listCommits('master');
}

function listFiles(commits) {
    return listCommitFiles(commits, 0);
}


function listCommitFiles(commits, index) {
    if (!commits[index])
        return;
    var commit = commits[index];
    return explorer.listCommitFiles(commit.id)
        .then(function(files) {
            console.log(commit.message);
            console.log(commit.date + ' ---> ' + files.length);
        })
        .then(function() {
            return listCommitFiles(commits, index+1);
        });
}

openRepository()
    .then(listCommits)
    .then(listFiles)
    .done(function() {
        console.log('did it!');
    });