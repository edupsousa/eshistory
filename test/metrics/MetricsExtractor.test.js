var MetricsExtractor = require('../../lib/metrics/MetricsExtractor.js'),
    chai = require('chai'),
    expect = chai.expect;

describe('MetricsExtractor', function() {
    var testRepositoryPath = require('path').join(__dirname,'../../');
    var metricsExtractor;

    beforeEach(function(done) {
        MetricsExtractor.getExtractorForRepository(testRepositoryPath)
            .then(function(extractor) {
                metricsExtractor = extractor;
            }).done(done);
    });

    it('Get all commits and his authors from repository', function(done) {
        metricsExtractor.getCommitsAndAuthors()
            .then(function(result) {
                expect(result).to.have.all.keys(['authors','commits']);
                expect(result.commits).to.be.an('array').with.length.above(0);
                expect(result.authors).to.be.an('array').with.length.above(0);
            }).done(done);
    });

    context('Methods that depends on a commit list', function() {
        var commitList;

        before(function(done) {
           metricsExtractor.getCommitsAndAuthors()
               .then(function(result) {
                   commitList = result.commits;
               }).done(done);
        });

        it('Get files from commit list', function() {
            metricsExtractor.getFilesFromCommits(commitList)
                .then(function(result) {
                    expect(result).to.have.all.keys(['entries', 'files', 'paths', 'filesLength']);
                });
        });

    });

    context('Methods that depends on a file entry list', function() {
        var entryList;

        before(function(done) {
            metricsExtractor.getCommitsAndAuthors()
                .then(function(result) {
                    return metricsExtractor.getFilesFromCommits(result.commits);
                })
                .then(function(result) {
                    entryList = result.entries;
                })
                .done(done);
        });

        it('Get metrics for files in entry list', function(done) {
            var callCount = 0;
            var callbackSpy = function() {
                callCount++;
            };

            metricsExtractor.getMetricsForEntries(entryList, callbackSpy)
                .then(function(metrics) {
                    expect(metrics).to.be.an('array').with.length.above(0);
                    expect(callCount).to.be.equal(metrics.length);
                    for(var i = 0; i < metrics.length; i++) {
                        var fileMetric = metrics[i];
                        expect(fileMetric).to.have.property('id')
                            .that.is.a('string');
                        expect(fileMetric).to.have.property('error')
                            .that.is.a('boolean');
                        if (fileMetric.error) {
                            expect(fileMetric).to.have.property('reason')
                                .that.is.a('string');
                        } else {
                            expect(fileMetric).to.have.property('data')
                                .that.is.an('object');
                        }
                    }
                })
                .done(done);
        });
    });


});