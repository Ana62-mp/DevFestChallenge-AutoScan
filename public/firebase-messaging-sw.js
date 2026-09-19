/* Config is delivered by the signed-in client; Firebase config is public, not a credential. */
importScripts('https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js');
let ready=false;
const database=new Promise((resolve,reject)=>{const request=indexedDB.open('autoscan-push',1);request.onupgradeneeded=()=>request.result.createObjectStore('config');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
function initialize(config){if(!config||ready)return;firebase.initializeApp(config);firebase.messaging();ready=true;}
self.addEventListener('message',event=>{if(event.data?.type!=='CONFIG')return;event.waitUntil(database.then(db=>new Promise(resolve=>{const tx=db.transaction('config','readwrite');tx.objectStore('config').put(event.data.config,'firebase');tx.oncomplete=()=>{initialize(event.data.config);resolve();};})));});
database.then(db=>{const request=db.transaction('config').objectStore('config').get('firebase');request.onsuccess=()=>initialize(request.result);});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.openWindow('/'));});
