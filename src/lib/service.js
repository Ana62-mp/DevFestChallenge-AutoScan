import { createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, RecaptchaVerifier, signInWithPhoneNumber, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import app, {auth,db,functions,storage,firebaseConfig} from './firebaseConfig';
export const call = async (name,data) => (await httpsCallable(functions,name)(data)).data;
export const loginEmail = (email,password,register=false) => register ? createUserWithEmailAndPassword(auth,email,password) : signInWithEmailAndPassword(auth,email,password);
export const loginGoogle = () => signInWithPopup(auth,new GoogleAuthProvider());
let verifier;
export async function sendSMS(phone){if(!verifier)verifier=new RecaptchaVerifier(auth,'recaptcha',{size:'normal'});try{return await signInWithPhoneNumber(auth,phone,verifier);}catch(error){verifier.clear();verifier=null;throw error;}}
export const logout = () => signOut(auth);
export const watchAuth = fn => onAuthStateChanged(auth,fn);
export async function getProfile(uid){const snapshot=await getDoc(doc(db,'users',uid));return snapshot.exists()?snapshot.data():null;}
export async function getCommunity(id,uid){const [community,member]=await Promise.all([getDoc(doc(db,'communities',id)),getDoc(doc(db,'communities',id,'members',uid))]);return {...community.data(),id,role:member.data()?.role};}
export function watchCollection(name,id,fn,onError){return onSnapshot(query(collection(db,name),where('communityId','==',id)),snapshot=>fn(snapshot.docs.map(d=>({...d.data(),id:d.id,createdAt:d.data().timestamp?.toMillis()||Date.now()})).sort((a,b)=>b.createdAt-a.createdAt)),onError);}
export async function addVehicle(communityId,uid,vehicle,file){let photo='';const id=crypto.randomUUID();if(file){const target=ref(storage,`vehiclePhotos/${communityId}/${uid}/${id}`);await uploadBytes(target,file);photo=await getDownloadURL(target);}await addDoc(collection(db,'vehicles'),{...vehicle,communityId,createdBy:uid,photo,timestamp:serverTimestamp()});}
export const resolveAlert = id => updateDoc(doc(db,'alerts',id),{status:'Resuelta'});
export async function enablePush(communityId,notify){if(!await isSupported())throw new Error('Este navegador no admite notificaciones push.');if(!import.meta.env.VITE_FIREBASE_VAPID_KEY)throw new Error('Falta configurar la clave Web Push de Firebase.');const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Activa el permiso de notificaciones en tu navegador.');const sw=await navigator.serviceWorker.register('/firebase-messaging-sw.js');await navigator.serviceWorker.ready;sw.active?.postMessage({type:'CONFIG',config:firebaseConfig});const token=await getToken(getMessaging(app),{vapidKey:import.meta.env.VITE_FIREBASE_VAPID_KEY,serviceWorkerRegistration:sw});await call('registerPush',{communityId,token});return onMessage(getMessaging(app),payload=>notify(payload.notification?.title||'Nueva alerta'));}
