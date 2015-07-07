var Q = require('q'),
    cp = require('child_process');

function Workers(numbeOfInstances, modulePath, timeout) {
    if (timeout === undefined) {
        this.timeout = false;
    } else {
        this.timeout = timeout;
    }
    this.modulePath = modulePath;
    this.workers = [];
    for (var i = 0; i < numbeOfInstances; i++) {
        this.workers[i] = cp.fork(modulePath);
        this.workers[i].sendTime = null;
    }
}

Workers.prototype.killAll = function() {
    for (var i = 0; i < this.workers.length; i++) {
        this.workers[i].kill();
    }
};

Workers.prototype.configure = function(configuration) {
    var self = this;
    var deferred = Q.defer();
    var answersCount = 0;
    var configListener = function(message) {
        if (message === "configured") {
            answersCount++;
        } else {
            deferred.reject();
        }

        if (answersCount === self.workers.length) {
            for (var i = 0; i < self.workers.length; i++) {
                self.workers[i].removeListener('message', configListener);
            }
            deferred.resolve(true);
        }
    };

    for (var i = 0; i < this.workers.length; i++) {
        this.workers[i].on('message', configListener);
        this.workers[i].send({
            command: 'configure',
            value: configuration
        });
    }

    return deferred.promise;
};

function sendWork(worker, workToDo) {
    if (workToDo.length > 0) {
        var work = workToDo.shift();
        worker.sendTime = process.uptime();
        worker.lastMessage = work;
        worker.send(work);
    }
}

Workers.prototype.doWork = function(workToDo, responseCallback, timeoutCallback) {
    var self = this;
    var deferred = Q.defer();
    var responsesExpected = workToDo.length;
    var watchdog;

    var responseListener = function(worker, message) {
        worker.sendTime = null;
        if (message === "timeout") {
            if (timeoutCallback !== undefined)
                timeoutCallback(worker.lastMessage, worker.pid);
        } else {
            responseCallback(message, worker.pid);
            sendWork(worker, workToDo);
        }

        responsesExpected--;
        if (responsesExpected === 0) {
            for (var i = 0; i < this.workers; i++) {
                self.workers[i].removeListener('message', responseListener);
            }
            if (watchdog !== undefined)
                clearInterval(watchdog);
            deferred.resolve(true);
        }
    };

    for (var i = 0; i < this.workers.length; i++) {
        this.workers[i].on('message', responseListener.bind(null, this.workers[i]));
        if (workToDo.length > 0) {
            this.workers[i].send(workToDo.shift());
            this.workers[i].sendTime = process.uptime();
        }
    }

    if (this.timeout !== false) {
        watchdog = setInterval(function() {
            var now = process.uptime();
            for (var i = 0; i < self.workers.length; i++) {
                if (self.workers[i].sendTime !== null && now - self.workers[i].sendTime > self.timeout) {
                    self.workers[i].emit("message", "timeout");
                    self.workers[i].kill();
                    self.workers[i] = cp.fork(self.modulePath);
                    self.workers[i].sendTime = null;
                    self.workers[i].on("message", responseListener.bind(null, self.workers[i]));
                    sendWork(self.workers[i], workToDo);
                }
            }
        }, this.timeout * 500);
    }

    return deferred.promise;
};

exports = module.exports = Workers;