const connection=new WebSocket("ws://localhost:8080");let username;connection.onopen=()=>{console.log("connected"),username=prompt("Input your name","User")},connection.onclose=()=>{console.error("disconnected")},connection.onerror=e=>{console.error("failed to connect",e)},connection.onmessage=e=>{let n=JSON.parse(e.data),t=document.querySelector("#chat"),o=document.createElement("div");o.setAttribute("class","other-message_block"),o.innerHTML=`\n        <label>${n.username}:</label>\n        <p class="other-message">${n.message}</p>\n        <label class="time">${n.date}</label>\n    `,t.appendChild(o)},document.querySelector("form").addEventListener("submit",(e=>{e.preventDefault();let n=document.querySelector("#message").value;if(n.length>0){let e=(new Date).toLocaleTimeString([],{hour12:!1}),t={username:username,message:n,date:e};connection.send(JSON.stringify(t)),ownMessage(n),document.querySelector("#message").value=""}}));const ownMessage=e=>{let n=(new Date).toLocaleTimeString([],{hour12:!1}),t=document.querySelector("#chat"),o=document.createElement("div");o.setAttribute("class","my-message_block"),o.innerHTML=`\n          <label>${username}:</label>\n          <p class="my-message">${e}</p>\n          <label class="time">${n}</label>\n      `,t.appendChild(o)};
//# sourceMappingURL=index.9525799b.js.map
