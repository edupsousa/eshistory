var nodeGit = require('nodegit'),
    Q = require('q');

var gitRepository;

process.on('message', function(message) {

    if (message.what === 'commit') {
        listCommitFiles(message.value)
            .then(function(files) {
                process.send({
                    commitId: message.value,
                    files: files
                });
            });
    } else if (message.what === 'repository') {
        openRepository(message.value)
            .then(function() {
                process.send('done');
            });
    }
});

function openRepository(path) {
    return nodeGit.Repository.open(path)
        .then(function(repository) {
            gitRepository = repository;
        }).catch(function(error) {
        });
}

function listCommitFiles(commitId) {
    var def = Q.defer();
    var files = [];


    gitRepository.getCommit(commitId)
        .then(function(commit) {
            return commit.getTree()
                .then(function(tree) {
                    var walker = tree.walk(true);
                    walker.on('entry', function(entry) {
                        if (/.+\.js$/i.test(entry.path())) {
                            files[files.length] = {
                                id: entry.oid().toString(),
                                path: entry.path()
                            };
                        }
                    });
                    walker.on('end', function(entries) {
                        tree.free();
                        commit.free();
                        def.resolve(files);
                    });
                    walker.start();
                });
        });

    return def.promise;
};
