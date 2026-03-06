let username;const connection=new WebSocket("wss://websocket-chat-s2s0.onrender.com");let online=0;connection.onopen=()=>{console.log("connected"),username=prompt("Input your name","User")||"Anonymous"},connection.onclose=()=>{console.error("disconnected")},connection.onerror=e=>{console.error("failed to connect",e)},connection.onmessage=e=>{let n=JSON.parse(e.data);if(document.querySelector(".online").textContent=`${n.online} ONLINE`,void 0!=n.username){let e=document.querySelector("#chat"),s=document.createElement("div");s.setAttribute("class","other-message_wrapper"),s.innerHTML=`
            <div class="other-message_block">
                <div class="left-message">
                    <label>${n.username}:</label>
                    <p class="other-message">${n.message}</p>
                    <label class="time">${n.date}</label>
                </div>
            </div>
        `,e.appendChild(s),e.scrollTop=e.scrollHeight}},document.querySelector("form").addEventListener("submit",e=>{e.preventDefault();let n=document.querySelector("#message").value;if(n.length&&n.trim()){let e=new Date().toLocaleTimeString([],{hour12:!1}),s={username:username,message:n,date:e};connection.send(JSON.stringify(s)),ownMessage(n),document.querySelector("#message").value=""}});const ownMessage=e=>{let n=new Date().toLocaleTimeString([],{hour12:!1}),s=document.querySelector("#chat"),t=document.createElement("div");t.setAttribute("class","my-message_wrapper"),t.innerHTML=`
        <div class="my-message_block">
            <div class="right-message">
                <label>${username}:</label>
                <p class="my-message">${e}</p>
                <label class="time">${n}</label>
            </div>
        </div>
      `,s.appendChild(t),s.scrollTop=s.scrollHeight};
//# sourceMappingURL=client.08c27527.js.map
