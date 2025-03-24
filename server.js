const https = require('https')
const express = require('express')
const socketIo = require('socket.io')
const bodyParser = require('body-parser')
const baseRouter = require('./routes/loginR')
const chatRouter = require('./routes/chatR')
const checkAuth = require('./routes/auth')
const session = require('express-session')
const app = express()
const fs = require('fs')

const privateKey = fs.readFileSync('key.pem', 'utf8');
const certificate = fs.readFileSync('cert.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };

var server = https.createServer(credentials,app)
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
app.use('/chat',chatRouter);

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
    socket.data.username = username
    socket.broadcast.emit('new-user',socket.request.session.username)
    socket.emit('current-users',users,username);

    socket.on('msg',(msg)=>{
        io.emit('message',msg,socket.id,username);
    });

    socket.on('getVCusers',()=>{
        let userList = io.sockets.adapter.rooms.get("VoiceRoom")
        if(userList != undefined){
        var vcSet= Array.from(userList)
        var vcUsers = []
        for (let socketId of vcSet){
            vcUsers.push(io.sockets.sockets.get(socketId).data.username)
        }
        socket.emit('voice-users',vcUsers)
        }
        else{
            socket.emit('voice-users',undefined)
        }
    })

    socket.on('join-vc',()=>{
        socket.join("VoiceRoom")
        socket.to('VoiceRoom').emit('CreateConnection',socket.id,socket.data.username)
    })
    socket.on('leave-vc',()=>{
        socket.leave('VoiceRoom')
        socket.emit('exited-vc',username)
    })
    socket.on('disconnect',()=>{
        io.emit('user-disconnected',username)
    })
    socket.on('icecandidate',(candidate,socketid)=>{ //socketid->new-user
           socket.to(socketid).emit('icecandidate',candidate,socket.id) //socket.id -> existing user
    })
    socket.on('Sendoffer',(offer,socketid,)=>{
        socket.to(socketid).emit('offer',offer,socket.id,socket.data.username)
    })
    socket.on('Sendanswer',(answer,socketid)=>{
        socket.to(socketid).emit("answer",answer,socket.id)
    })
})
server.listen(9000,()=>{
    console.log('Running on port 9000')
})

