var chai = require('chai'),
    expect = chai.expect,
    _ = require('lodash'),
    GitExplorer = require('../../lib/explorer/GitExplorer.js');

describe('GitExplorer', function() {
    var path = require('path').join(__dirname, '../../');

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
        var _files = [];

        before(function(done) {
            GitExplorer.open(path)
                .then(function(explorer) {
                    gitExplorer = explorer;
                }).done(done);
        });

        context('getCommitsAndAuthors', function() {
            var commits;
            var authors;

            it('retrieve commits and authors for all commits in repository', function(done) {
                gitExplorer.getCommitsAndAuthors()
                    .then(function(result) {
                        expect(result).to.have.all.keys(['commits','authors']);
                        commits = result.commits;
                        authors = result.authors;
                        _commits = commits;
                    })
                    .done(done);
            });

            it('commits must be a not empty array', function() {
                expect(commits).to.be.a('array');
                expect(commits).to.have.length.above(0);
            });

            it('all commits must have id, date, author and message properties', function() {
                for (var i = 0; i < commits.length; i++) {
                    expect(commits[i]).to.have.all.keys(['id','date','author','message']);
                    expect(commits[i].id).to.be.a('string').with.lengthOf(40);
                    expect(commits[i].date).to.be.instanceOf(Date);
                    expect(commits[i].author).to.be.a('object')
                        .with.have.all.keys(['name','email']);
                    expect(commits[i].message).to.be.a('string');
                }
            });

            it('authors should be unique', function() {
                for (var i = 0; i < authors.length; i++) {
                    expect(_.contains(authors, authors[i], i+1)).to.be.falsy;
                }
            });

            it('authors must have the author of each commit', function() {
                for (var i = 0; i < commits.length; i++) {
                    expect(authors).to.contain(commits[i].author);
                }
            });
        });

        context('listCommitFiles', function() {
            it('list files from the first commit retrieved', function(done) {
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
        });

        context('listFiles', function() {
            var files, paths, entries;

            it('list files, paths and entries', function(done) {
                gitExplorer.listFiles(_commits)
                    .then(function(result) {
                        expect(result).to.have.all.keys(['files','paths','entries']);

                        files = result.files;
                        paths = result.paths;
                        entries = result.entries;

                        _files = files;
                    })
                    .done(done);
            });

            it('all commits must be in files', function() {
                _commits.forEach(function(commit) {
                    expect(files).to.have.property(commit.id)
                        .that.is.an('array');
                    for (var i = 0; i < files[commit.id].length; i++) {
                        expect(paths).to.contain(files[commit.id][i].path);
                        expect(entries).to.contain(files[commit.id][i].id);
                    }
                });
            });

            it('paths should be unique', function() {
                for (var i = 0; i < paths.length; i++) {
                    expect(_.contains(paths, paths[i], i+1)).to.be.falsy;
                }
            });

            it('entries should be unique', function() {
                for (var i = 0; i < entries.length; i++) {
                    expect(_.contains(entries, entries[i], i+1)).to.be.falsy;
                }
            });

        });

        context('getFilesContents', function() {
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

});
