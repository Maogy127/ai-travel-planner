import {state,control,authListeners} from './firebase-app.js';
export const getAuth=()=>({});
export function onAuthStateChanged(auth,fn){authListeners.add(fn);queueMicrotask(()=>fn(state.user));return ()=>authListeners.delete(fn);}
export class GoogleAuthProvider{}
export async function signInWithPopup(){const user={uid:'owner',displayName:'Sam',email:'sam@example.com'};control.setUser(user);return {user};}
export async function signInAnonymously(){const user={uid:'guest-'+Math.random().toString(36).slice(2),isAnonymous:true};control.setUser(user);return {user};}
export async function updateProfile(user,data){Object.assign(user,data);}
export async function signOut(){control.setUser(null);}
export async function sendSignInLinkToEmail(auth,email,settings){state.calls.push(['email',email,settings]);}
export const isSignInWithEmailLink=(auth,url)=>url.includes('oobCode=');
export async function signInWithEmailLink(auth,email){const user={uid:'email-user',email};control.setUser(user);return {user};}
