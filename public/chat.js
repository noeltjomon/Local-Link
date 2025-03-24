const socket = io();
var sidebarEle = document.getElementsByClassName('sidebar');
var gcCont;
var vcCont;

var localStream;
var localAudio;
var constraints = {video:false,audio:true}
var peers = {}
var currentUsersEle;
document.addEventListener("DOMContentLoaded", () => {
    gcCont = document.getElementById("chat-container")
    vcCont = document.getElementById("voice-chat-container")
    vcCont.style.display = "none"
    gcCont.style.display = "block"
});
    
    
var sendB = document.getElementById("sendButton"); 
var sendText = document.getElementById("chattext");
var chatMessages = document.querySelector('.chat-messages'); 
var voiceChat = document.getElementById('voice')
var groupChat = document.getElementById('group')
var voiceUsersContainer = document.getElementById('voice-users')
var connectButton = document.getElementById('connectButton')
var disconnectButton = document.getElementById('disconnectButton')
//Group chat HTML elements event handlers
groupChat.addEventListener('click',()=>{
     vcCont.style.display = "none"
    gcCont.style.display = "block"
})

sendB.addEventListener('click', () => {
    var msg = sendText.value.trim(); 
    if (msg === "") return; 
    socket.emit('msg', msg);
    
    sendText.value = ""; // Clear input field after sending
});
//End

//Voice Chat HTML elements event handlers
voiceChat.addEventListener('click',()=>{
    gcCont.style.display = "none"
    vcCont.style.display = "block"
    socket.emit('getVCusers');
})
connectButton.addEventListener('click',async ()=>{
    await setUpLocalUserMedia();
})
disconnectButton.addEventListener('click',()=>{
    socket.emit('leave-vc')
    document.getElementById("Me").remove()
})
//End


// Socket.io event handlers

socket.on('message', (msg, senderID, username) => {
    var newText = document.createElement('p');
    if (socket.id === senderID) {
        newText.textContent = msg;
        newText.className = "message sent";
    } else {
        newText.textContent = username + ": " + msg;
        newText.className = "message received";
    }

    chatMessages.appendChild(newText);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});
socket.on('new-user',(username)=>{
    var contacts = document.getElementsByClassName('contact')
    Array.from(contacts).forEach(contact => {
        let i = contact.textContent;
        if(username==i){
            return 
        }
    });
    var newContact = document.createElement('div');
    newContact.className = 'contact'
    newContact.innerText =  username;
    sidebarEle[0].appendChild(newContact)

})
socket.on('current-users',(users,username)=>{
    for(var user in users){
        if(user!==username){
        var newContact = document.createElement('div');
    newContact.className = 'contact'
    newContact.innerText =  user;
    sidebarEle[0].appendChild(newContact)}
    }
})
socket.on('user-disconnected',(username)=>{
    var contacts = document.getElementsByClassName('contact')
    Array.from(contacts).forEach(contact => {
        let i = contact.textContent;
        if(username==i){
            sidebarEle[0].removeChild(contact)
        }
    });
    currentUsersEle = document.getElementsByClassName('user-card')
    if(currentUsersEle!= undefined){
        for(let ele of currentUsersEle){
            if(ele.textContent == username){
                voiceUsersContainer.removeChild(ele)
            }
        }
    }
})
socket.on('connect_error',(error)=>{
    if(error.message == "Authentication Error"){
        window.location.href = '/login';
    }
})

//End

//Voice Chat Socket.io event handlers

socket.on('voice-users',(userList)=>{
    if(userList!=undefined){
 currentUsersEle = document.getElementsByClassName('user-card')
 currentUsers = []
for (let userele of currentUsersEle){
    currentUsers.push(userele.textContent)
}
for(let user of userList){
    if(!currentUsers.includes(user)){
        var userCard = document.createElement('div')
        userCard.textContent = user
        userCard.className = "user-card" 
        voiceUsersContainer.appendChild(userCard)
    }
}}
})

socket.on('exited-vc',(username)=>{
    
    if(currentUsersEle!= undefined){
        for(let ele of currentUsersEle){
            if(ele.textContent == username){
                voiceUsersContainer.removeChild(ele)
            }
        }
    }
})
socket.on('CreateConnection',(peerId,username)=>{
    initializePeer(peerId,username)
    peers[peerId].createOffer().then((offer)=>{
        peers[peerId].setLocalDescription(offer)
        socket.emit("Sendoffer",offer,peerId)
    }).catch((error)=>{
        console.log("Error creating offer: ",error);
    })
})
socket.on('offer',(offer,id,username)=>{
    initializePeer(id,username)
    peers[id].setRemoteDescription(offer).then(()=>{
        peers[id].createAnswer().then((answer)=>{
            peers[id].setLocalDescription(answer)
            socket.emit('Sendanswer',answer,id)
        })
    })
})
socket.on('answer',(answer,id)=>{
    peers[id].setRemoteDescription(new RTCSessionDescription(answer)).then(()=>{
        
    }).catch((error)=>{
        console.error("Failed to set answer as remote description: ",error)
    })
})
socket.on('icecandidate',(candidate,peerId)=>{
    if(peers[peerId]){
        console.log(candidate)
        peers[peerId].addIceCandidate(new RTCIceCandidate(candidate)).then(() => {
            console.log('ICE candidate added successfully');
        }).catch((err) => {
            console.error('Failed to add ICE candidate:', err);
        });
    }
})
//End

function setUpLocalUserMedia(){
    navigator.mediaDevices.getUserMedia(constraints).then((stream)=>{
        var userCard = document.createElement('div')
        userCard.id = "Me"
        localAudio = document.createElement('audio')
        userCard.textContent = "Me"
        localAudio.id = "MeAudio"
        userCard.className = "user-card" 
        localAudio.srcObject = stream
        localAudio.controls = false
        localAudio.autoplay = true
        localAudio.muted = true
        localStream = stream
        console.log(localStream);
        userCard.appendChild(localAudio)
        voiceUsersContainer.prepend(userCard)
        socket.emit('join-vc');

    })
}

function initializePeer(id,username){
    
    if(peers[id])
        return;
    let peer = new RTCPeerConnection();
    for( let track of localStream.getTracks()){
        peer.addTrack(track,localStream)
    }
    peer.ontrack = (event)=>{
        let userCard;
        if(currentUsersEle!=undefined){
        for(let it of currentUsersEle){
            if(it.textContent == username){
                userCard = it
            }
        }}
        if(userCard!=undefined){
            var remoteAudio = document.getElementById('remoteId'+id);
            if(!remoteAudio){
                remoteAudio = document.createElement('audio')
                remoteAudio.id = 'remoteId'+id;
                remoteAudio.controls = false
                remoteAudio.autoplay = true
                remoteAudio.muted = false
            }
            remoteAudio.srcObject = event.streams[0]

        }else{
         userCard = document.createElement('div')
        var remoteAudio = document.createElement('audio')
        console.log("user"+username)
        userCard.textContent = username
        remoteAudio.id = "remoteId"+id
        userCard.className = "user-card" 
        remoteAudio.controls = false
        remoteAudio.autoplay = true
        remoteAudio.muted = false
        remoteAudio.srcObject = event.streams[0]
        }
        userCard.appendChild(remoteAudio)
        voiceUsersContainer.append(userCard)
    }
    peer.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('icecandidate', event.candidate, id);
        } else {
            console.log("All ICE candidates sent for peer:", id);
        }
    };
    

    peers[id] = peer     
}
//End