var chai = require('chai'),
    expect = chai.expect,
    GitExplorer = require('../lib/GitExplorer.js');

describe('GitExplorer', function() {
    var path = require('path').join(__dirname, '../');

    context('.open', function() {
        it('should return a GitExplorer', function(done) {
            GitExplorer.open(path)
                .then(function(explorer) {
                    expect(explorer).to.be.instanceOf(GitExplorer);
                })
                .done(done);
        });
    });

    context('#', function() {
        var gitExplorer;
        var _history;
        var _commits;
        var _files;

        before(function(done) {
            GitExplorer.open(path)
                .then(function(explorer) {
                    gitExplorer = explorer;
                }).done(done);
        });

        it('getHistory', function(done) {
            gitExplorer.getHistory()
                .then(function(commitHistory) {
                    expect(commitHistory).to.be.a('array');
                    expect(commitHistory).to.have.length.above(0);
                    commitHistory.forEach(function(commitId) {
                        expect(commitId).to.have.lengthOf(40);
                    });
                    _history = commitHistory;
                })
                .done(done);
        });

        it('getCommits', function(done) {
            gitExplorer.getCommits(_history)
                .then(function(commits) {
                    expect(commits).to.be.a('array');
                    expect(commits).to.have.lengthOf(_history.length);
                    for (var i = 0; i < commits.length; i++) {
                        expect(commits[i]).to.have.all.keys(['id','date','author','message']);
                        expect(commits[i].id).to.be.equal(_history[i]);
                    }
                    _commits = commits;
                })
                .done(done);
        });

        it('listCommitFiles', function(done) {
            gitExplorer.listCommitFiles(_commits[0].id)
                .then(function(files) {
                    expect(files).to.be.an('array')
                        .with.length.above(0);
                    files.forEach(function(file) {
                        expect(file).to.have.all.keys(['id','path']);
                    });
                })
                .done(done);
        });

        it('listFiles', function(done) {
            gitExplorer.listFiles(_commits)
                .then(function(files) {
                    _history.forEach(function(commitId) {
                        expect(files).to.have.property(commitId)
                            .that.is.an('array');
                    });
                    _files = files;
                })
                .done(done);
        });

        it('getFilesContents', function(done) {
            gitExplorer.getFilesContents(_files)
                .then(function(contents) {
                    for (var commitId in _files) {
                        for (var fileId in contents[commitId]) {
                            expect(contents[commitId][fileId]).to.be.a('string');
                        }
                    }
                })
                .done(done);
        });
    });

});
