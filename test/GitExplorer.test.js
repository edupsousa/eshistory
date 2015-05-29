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
        var _commits;
        var _files;

        before(function(done) {
            GitExplorer.open(path)
                .then(function(explorer) {
                    gitExplorer = explorer;
                }).done(done);
        });

        it('getCommits', function(done) {
            gitExplorer.getCommits()
                .then(function(commits) {
                    expect(commits).to.be.a('array');
                    expect(commits).to.have.length.above(0);
                    for (var i = 0; i < commits.length; i++) {
                        expect(commits[i]).to.have.all.keys(['id','date','author','message']);
                        expect(commits[i].id).to.be.a('string').with.lengthOf(40);
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
                    _commits.forEach(function(commit) {
                        expect(files).to.have.property(commit.id)
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
