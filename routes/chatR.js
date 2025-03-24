const express = require('express')
const path = require('path')
const router = express.Router()

router.get('/chat.js',(req,res)=>{
res.sendFile(path.join(__dirname,"../public/chat.js"))
})
module.exports = router