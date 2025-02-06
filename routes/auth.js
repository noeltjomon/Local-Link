function checkAuth(req,res,next){
    if(req.url =="/" || req.url=="/login"|| req.url == "/authenticate"){
        return next()
    }
    if(!req.session||!req.session.username){
        res.redirect('/login')
        return
    }
    next()
}
module.exports = checkAuth