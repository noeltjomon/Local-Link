const socket = io();
var sidebarEle = document.getElementsByClassName('sidebar');
var gcCont;
var vcCont;

var localStream;
var localAudio;
var constraints = {video:false,audio:true}
var peers = {}
var currentUsersEle;
var currentUsers = []
document.addEventListener("DOMContentLoaded", () => {
    gcCont = document.getElementById("chat-container")
    vcCont = document.getElementById("voice-chat-container")
    vcCont.style.display = "none"
    gcCont.style.display = "block"
    const chatContainer = document.querySelector(".chat-container");
    chatContainer.scrollTop = chatContainer.scrollHeight;
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
document.getElementById("fileInput").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
        uploadFile(file);
    }
});
sendB.addEventListener('click', () => {
    var msg = sendText.value.trim(); 
    if (msg === "") return; 
    socket.emit('msg', msg);
    
    sendText.value = ""; // Clear input field after sending
});
//End
const muteButton = document.getElementById("muteButton");
let isMuted = false;

muteButton.addEventListener("click", () => {
    if (!localStream) return;

    isMuted = !isMuted;

    localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
    });

    muteButton.textContent = isMuted ? "Unmute" : "Mute";
    muteButton.classList.toggle("unmuted", !isMuted);
});

//Voice Chat HTML elements event handlers
voiceChat.addEventListener('click',()=>{
    gcCont.style.display = "none"
    vcCont.style.display = "block"
    socket.emit("EnteredRoom")
    socket.emit('getVCusers');
    socket.emit("EnterVR")
})
connectButton.addEventListener('click',async ()=>{
    await setUpLocalUserMedia();
    connectButton.disabled = true
    disconnectButton.disabled = false;
    disconnectButton.style.background = "#FF0000"
    connectButton.style.background = "#808080"
})
disconnectButton.addEventListener('click',()=>{
    socket.emit('leave-vc')
    document.getElementById("Me").remove()
    disconnectButton.disabled = true
    connectButton.disabled = false;
    connectButton.style.background = "#00FF00"
    disconnectButton.style.background = "#808080"
    closeConnections();
})
//End


// Socket.io event handlers

socket.on('message', (msg, senderID, username) => {
    console.log("here "+username)
    var newText = document.createElement('p');
    if (socket.id === senderID) {
        newText.textContent = msg;
        newText.className = "message sent";
    } else {;
        newText.className = "message received";
        let sendername = document.createElement('span')
        sendername.classList.add('sender-name')
        sendername.classList.add('sent')
        sendername.textContent = username;
        newText.textContent =  msg;
        newText.prepend(sendername)
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
    users.forEach(user=>{
        if(user.Name!==username){
        var newContact = document.createElement('div');
    newContact.className = 'contact'
    newContact.innerText =  user.Name;
    sidebarEle[0].appendChild(newContact)}
})}
)
socket.on('pastMsgs',(msgs,currentUser)=>{
     
    console.log(msgs)
    msgs.forEach((msgDict)=>{
        var newText = document.createElement('div');
        var sendername = null;
        newText.className = "message-container"
    if (msgDict.Sender === currentUser) {
        newText.textContent = msgDict.Msg;
        newText.className = "message sent";
    } else {
        sendername = document.createElement('span')
        sendername.classList.add('sender-name')
        sendername.classList.add('sent')
        sendername.textContent = msgDict.Sender;
        newText.textContent =  msgDict.Msg;
        newText.className = "message received";
        newText.prepend(sendername)
    }
   
    chatMessages.appendChild(newText);
  
    chatMessages.scrollTop = chatMessages.scrollHeight;
    })
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

socket.on('exit.vc',(username)=>{
    
    currentUsersEle = document.getElementsByClassName('user-card')
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
socket.on("Fileshared", (fileUrl, fileName,username ) => {
    console.log(fileUrl)
    addFileMessage(fileUrl, fileName, false,username);
});

// Function to display file messages
function addFileMessage(fileUrl, fileName, isSent = false,username=null) {
    let messageP = document.createElement('div');
    let sendernamed
    const fileLink = document.createElement("a");
    fileLink.href = fileUrl;
    fileLink.textContent = `📂 ${fileName}`;
    fileLink.target = "_blank";
    messageP.className = "message-container"
    if(isSent){
        messageP.className = "message sent"
    }else{
        messageP.className = "message received"
    }    
    if(isSent == false){
         sendernamed = document.createElement('span')
        sendernamed.classList.add('sender-name')
        sendernamed.classList.add('sent')
        sendernamed.textContent = username;
        messageP.appendChild(sendernamed)
    }
    messageP.appendChild(fileLink)
    chatMessages.appendChild(messageP);
    chatMessages.scrollTop = chatMessages.scrollHeight;

}
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

function closeConnections(){
for(let [name,rtcpeer] of Object.entries(peers)){
    if(rtcpeer){
        rtcpeer.close()
    }
}
if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
}
peers = {}
}

async function  uploadFile(file){
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/upload", {
        method: "POST",
        body: formData,
    });

    const data = await response.json();
  
}
