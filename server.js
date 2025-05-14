const https = require('https')
const express = require('express')
const socketIo = require('socket.io')
const bodyParser = require('body-parser')
const baseRouter = require('./routes/loginR')
const chatRouter = require('./routes/chatR')
const checkAuth = require('./routes/auth')
const session = require('express-session')
const multer = require('multer')
const path = require('path')

const app = express()
const fs = require('fs')
const privateKey = fs.readFileSync('key.pem', 'utf8');
const certificate = fs.readFileSync('cert.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };
const mongo = require('./mongo')



var server = https.createServer(credentials,app)
//users = {}
 
var sessionMiddleware = session({
    secret:"very secret",
    resave:false,
    saveUninitialized:false,
    cookie:{maxAge:new Date().getTime()+1000*60*60}
})

app.use(express.static('public'));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(bodyParser.urlencoded({extended:true}))
app.use(bodyParser.json())
app.use(sessionMiddleware)

app.use(checkAuth);
app.use('/',baseRouter);
app.use('/chat',chatRouter);

const io =  socketIo(server)
io.engine.use(sessionMiddleware)

const storage = multer.diskStorage({
    destination: (req,file,cb)=>{
        cb(null,"uploads/")
    },
    filename: (req,file,cb)=>{
        cb(null,Date.now()+"-"+file.originalname)
    }
})
const upload = multer({storage:storage})

app.post("/upload",upload.single("file"),(req,res)=>{
        if(!req.file){
            res.status(400)
        }
        let mongoMsgs = db.collection('Messages')
        const fileurl = `/uploads/${req.file.filename}`
        console.log(fileurl)
        let musers = db.collection('Users')
        let socketid = musers.find({Name:req.session.username},{projection:{sock_id:1}}).toArray()
        mongoMsgs.insertOne({Msg:fileurl,Sender:req.session.username})
        io.emit("Fileshared",fileurl,req.file.originalname,req.session.username)
        res.json({fileurl:fileurl,filename:req.file.originalname})

})
io.use((socket,next)=>{
    var session = socket.request.session;
    
    if(!session || !session.username){
        return next(new Error("Authentication Error"))
    }
    
    next()
})
io.on('connection',async (socket)=>{
    db = await mongo.connectDB()
    let mongoUsers = db.collection('Users')
    let mongoMsgs = db.collection("Messages")
    //users[socket.request.session.username] = socket.id
    mongoUsers.updateOne({Name:socket.request.session.username},{$set:{sock_id:socket.id,online:true}})

    var username = socket.request.session.username
    socket.data.username = username
    let users = await mongoUsers.find({online:true},{ projection: { Name: 1, _id: 0 } }).toArray()
    socket.broadcast.emit('new-user',socket.request.session.username)
    let pastMsgs = await mongoMsgs.find({},{projection:{_id:0}}).toArray();
    socket.emit('current-users',users,username); 
    socket.emit('pastMsgs',pastMsgs,username)
    socket.on('msg',(msg)=>{
        io.emit('message',msg,socket.id,username);
        mongoMsgs.insertOne({Msg:msg,Sender:socket.data.username})
    });

    socket.on('getId',()=>{
        socket.emit('sockid',socket.id)
    })
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
    socket.on('leave-vc',async ()=>{
        await socket.to('VoiceRoom').emit('exit.vc',username)
        await socket.broadcast.emit('exit.vc',username)
        socket.leave('VoiceRoom')

    })
    socket.on('disconnect',()=>{
        mongoUsers.updateOne({Name:username},{$set:{online:false}})
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

