var GitExplorer = require('../lib/GitExplorer.js');

var explorer = null;

function openRepository() {
    return GitExplorer.open('/Users/edupsousa/Documents/JSMetrics/repositories/express')
        .then(function(gitExplorer) {
            explorer = gitExplorer;
        });
}

var myFnCount = 0;

var myFn = function(commit, files) {
    myFnCount++;

    console.log('Date ' + commit.date);
    console.log('ID ' + commit.id);
    console.log('Files: ' + files.length)
    console.log('************************************');
};

console.time('Just did it in: ');

openRepository()
    .then(function() {
        return explorer.mapToBranchCommitsAndFiles('master', myFn);
    })
    .then(function(result) {
        console.log('Returned ' + result.length + ' results.\nInvoked ' + myFnCount + ' times.');
    })
    .done(function() {
        console.timeEnd('Just did it in: ');
    });