var io = require('socket.io');
var http = require('http');
var config = require('../../modules/config/configUtils').getConfigs();

module.exports.createServer = createServer;
module.exports.addUser = addUser;
module.exports.otherUsers = otherUsers;

/*
 * 内部数据结构：用户列表
 *  [{name, session_id, socket} ...]
 * */
var users = [];

function findInUsers(session_id) {//通过session_id查找
    var index = -1;
    for (var j = 0, len = users.length; j < len; j++) {
        if (users[j].session_id === session_id)
            index = j;
    }
    return index;
}
function addUser(name, session_id) {//添加用户
    var index = findInUsers(session_id);
    if (index === -1) //not exist
        users.push({name: name, session_id: session_id, socket: null});
    else {
        if (users[index].name !== name) //update name
            users[index].name = name;
    }
}
function setUserSocket(session_id, socket){//更新用户socket
    var index = findInUsers(session_id);
    if (index !== -1){
        users[index].socket = socket;
    }
}
function findUser(session_id) {//查找
    var index = findInUsers(session_id);
    return index > -1 ? users[index] : null;
}
function otherUsers(session_id){//其他人
    var results = [];
    for (var j = 0, len = users.length; j < len; j++) {
        if (users[j].session_id !== session_id)
            results.push({session_id: users[j].session_id, name: users[j].name});
    }
    return results;
}

/*
 * @app: Koa application
 * */
function createServer(app) {
    var server = http.Server(app.callback());
    io = io(server);
    messageHandler(io);
    return server;
}

/*
 * socket event handler
 */
function messageHandler(io) {
    io.on('connection', function (socket) {
        console.log(socket.id, ' just connected.');
        var sessionId = getSessionId(socket.request.headers.cookie, 'koa:sess');
        if(sessionId){
            setUserSocket(sessionId, socket);
        }

        socket.on('broadcast', function (data) {
            //广播
            var fromUser = findUser(sessionId);
            if(fromUser) {
                socket.broadcast.emit('broadcast', {
                    name: fromUser.name,
                    msg: data.msg
                });
            }
        });

        socket.on('private', function (data) {
            //私聊　{to_session_id, msg}
            var fromUser = findUser(sessionId);
            if(fromUser) {
                var toUser = findUser(data.to_session_id);
                if (toUser)
                    toUser.socket.emit('private', {
                        name: fromUser.name,
                        msg: data.msg
                    });
            }
        });

        socket.on('disconnect', function () {
            console.log(this.id, ' has been disconnect.');
        });
    });
}

function getSessionId(cookieString, cookieName) {
    var matches = new RegExp(cookieName + '=([^;]+);', 'gmi').exec(cookieString);
    return matches[1] ? matches[1] : null;
}