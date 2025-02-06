const http = require('http')
const express = require('express')
const socketIo = require('socket.io')
const bodyParser = require('body-parser')
const baseRouter = require('./routes/loginR')
const checkAuth = require('./routes/auth')
const session = require('express-session')
const app = express()

var server = http.createServer(app)
users = {}
 
var sessionMiddleware = session({
    secret:"very secret",
    resave:false,
    saveUninitialized:false,
    cookie:{maxAge:new Date().getTime()+1000*60*60}
})

app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended:true}))
app.use(bodyParser.json())
app.use(sessionMiddleware)

app.use(checkAuth);
app.use('/',baseRouter);

const io =  socketIo(server)
io.engine.use(sessionMiddleware)

io.use((socket,next)=>{
    var session = socket.request.session;
    if(!session || !session.username){
        return next(new Error("Authentication Error"))
    }
    next()
})
io.on('connection',(socket)=>{
    users[socket.request.session.username] = socket.id;
    var username = socket.request.session.username
    socket.broadcast.emit('new-user',socket.request.session.username)
    socket.emit('current-users',users,username);
    socket.on('msg',(msg)=>{
        io.emit('message',msg,socket.id,username);
    });
    socket.on('disconnect',()=>{
        io.emit('user-disconnected',username)
    })
})
server.listen(9000,()=>{
    console.log('Running on port 9000')
})

