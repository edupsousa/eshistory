var expect = require('chai').expect,
    GitExplorer = require('../lib/GitExplorer.js');

describe('GitExplorer', function() {

    var openRepository = function() {
        return GitExplorer.open('/Users/edupsousa/Documents/JSMetrics/repositories/express');
    };

    var listMasterBranchCommits = function(gitExplorer) {
        return gitExplorer.listCommits('master');
    };

    var getLastCommitOnMasterBranch = function(gitExplorer) {
        return gitExplorer.getLastCommitOnBranch('master');
    };

    it('Open repository should return a instance of GitExplorer', function(done) {
        openRepository()
            .then(function(gitExplorer) {
                expect(gitExplorer).to.be.instanceOf(GitExplorer);
            })
            .done(done);
    });

    it('Get last commit on master branch return a commit', function(done) {
        openRepository()
            .then(getLastCommitOnMasterBranch)
            .then(function(commit) {
                expect(commit).to.have.all.keys(['id', 'date', 'author', 'message']);
            })
            .done(done);
    });

    it('List commits should return a array of commits', function(done) {
        openRepository()
            .then(listMasterBranchCommits)
            .then(function(commits) {
                expect(commits).to.be.a('array');
            })
            .done(done);
    });

    it('List commit files', function(done) {
        openRepository()
            .then(function(gitExplorer) {
                return gitExplorer.getLastCommitOnBranch('master')
                    .then(function(commit) {
                        return gitExplorer.listCommitFiles(commit.id);
                    })
            })
            .then(function(files) {
                expect(files).to.be.a('array');
                expect(files).to.have.length.above(0);
                files.forEach(function(file) {
                    expect(file).to.have.property('path')
                        .that.is.a('string').that.match(/.+\.js$/i);
                    expect(file).to.have.property('code')
                        .that.is.a('string');
                });
            })
            .done(done);
    });

});
