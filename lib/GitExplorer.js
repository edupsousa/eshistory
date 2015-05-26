var NodeGit = require('nodegit');

function GitExplorer(repository) {
    this._repository = repository;
}

GitExplorer.open = function(url) {
    return NodeGit.Repository.open(url)
        .then(function(repository) {
            return new GitExplorer(repository);
        });
};


exports = module.exports = GitExplorer;