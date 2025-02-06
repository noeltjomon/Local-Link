const express = require('express')
const path = require('path')
const router = express.Router()

router.get('/',(req,res)=>{
    if(req.session.username){
        res.redirect('/chat')

    }
    else{
        //console.log(req.session.username)
        
    res.redirect('/login')    }
    
})
router.post('/authenticate',(req,res)=>{
    if(req.body.validation=="true"){
     if(req.body.user in users){
     res.json({ "unique": "false" });}
     else{
         req.session.username = req.body.user
         users[req.body.user] =  null
         res.json({"unique":"true"})
     }
    }else{
     res.redirect('/chat')
    }
 })
 
 router.get('/chat',(req,res)=>{
    res.sendFile(path.join(__dirname,"../public/chat.html"))
 })
 router.get('/login',(req,res,next)=>{
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.sendFile(path.join(__dirname,"../public/login.html"))
 })
 module.exports = router