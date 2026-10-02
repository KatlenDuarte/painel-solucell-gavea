// Camada de dados. Funciona de dois jeitos:
//  • Firebase (quando as variáveis VITE_FIREBASE_* existem): conteúdo,
//    calendário e pedidos ficam online e o que a proprietária muda no painel
//    aparece na hora para todos os visitantes.
//  • Modo local (sem Firebase): tudo fica salvo no navegador. Serve para
//    testar e montar o conteúdo antes de colocar no ar.

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type Auth,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { DEFAULT_CONTENT } from "./defaults";
import type { BookingRequest, Calendar, SiteContent } from "./types";

const env = import.meta.env;
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const isFirebase = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
if (isFirebase) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
}

type Listener<T> = (value: T) => void;
type Unsub = () => void;

/** Completa o conteúdo salvo com campos novos que não existiam quando foi salvo. */
export function withDefaults(saved: Partial<SiteContent> | undefined | null): SiteContent {
  if (!saved) return structuredClone(DEFAULT_CONTENT);
  return {
    ...structuredClone(DEFAULT_CONTENT),
    ...saved,
    general: { ...DEFAULT_CONTENT.general, ...(saved.general || {}) },
    cabins: (saved.cabins ?? DEFAULT_CONTENT.cabins).map((c) => ({ ...DEFAULT_CONTENT.cabins[0], ...c })),
  };
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/* -------------------------------------------------------------------------- */
/*  Modo local (localStorage)                                                 */
/* -------------------------------------------------------------------------- */

const LS = {
  content: "bc-content",
  calendar: "bc-calendar",
  requests: "bc-requests",
  session: "bc-admin-session",
  password: "bc-admin-password",
};
export const LOCAL_DEFAULT_PASSWORD = "bambu123";

const localBus = new EventTarget();

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    throw new Error("O navegador não tem mais espaço para salvar. Use imagens menores ou configure o Firebase.", { cause: err });
  }
  localBus.dispatchEvent(new Event(key));
}

function lsSubscribe<T>(key: string, read: () => T, cb: Listener<T>): Unsub {
  const fire = () => cb(read());
  fire();
  localBus.addEventListener(key, fire);
  const onStorage = (e: StorageEvent) => e.key === key && fire();
  window.addEventListener("storage", onStorage);
  return () => {
    localBus.removeEventListener(key, fire);
    window.removeEventListener("storage", onStorage);
  };
}

/* -------------------------------------------------------------------------- */
/*  Conteúdo do site                                                          */
/* -------------------------------------------------------------------------- */

export function subscribeContent(cb: Listener<SiteContent>): Unsub {
  if (db) {
    return onSnapshot(
      doc(db, "site", "content"),
      (snap) => cb(withDefaults(snap.exists() ? (snap.data() as SiteContent) : null)),
      () => cb(withDefaults(null)),
    );
  }
  return lsSubscribe(LS.content, () => withDefaults(lsGet<SiteContent | null>(LS.content, null)), cb);
}

export async function saveContent(content: SiteContent) {
  const data = { ...content, updatedAt: Date.now() };
  if (db) await setDoc(doc(db, "site", "content"), JSON.parse(JSON.stringify(data)));
  else lsSet(LS.content, data);
}

/* -------------------------------------------------------------------------- */
/*  Calendário (noites ocupadas / bloqueadas)                                 */
/* -------------------------------------------------------------------------- */

export function subscribeCalendar(cb: Listener<Calendar>): Unsub {
  if (db) {
    return onSnapshot(
      doc(db, "site", "calendar"),
      (snap) => cb(snap.exists() ? ((snap.data().days as Calendar) ?? {}) : {}),
      () => cb({}),
    );
  }
  return lsSubscribe(LS.calendar, () => lsGet<Calendar>(LS.calendar, {}), cb);
}

export async function saveCalendar(calendar: Calendar) {
  if (db) await setDoc(doc(db, "site", "calendar"), { days: calendar, updatedAt: Date.now() });
  else lsSet(LS.calendar, calendar);
}

/* -------------------------------------------------------------------------- */
/*  Pedidos de pré-reserva                                                    */
/* -------------------------------------------------------------------------- */

export async function createRequest(req: Omit<BookingRequest, "id">) {
  if (db) {
    await addDoc(collection(db, "requests"), req);
    return;
  }
  const list = lsGet<BookingRequest[]>(LS.requests, []);
  lsSet(LS.requests, [{ ...req, id: uid() }, ...list]);
}

export function subscribeRequests(cb: Listener<BookingRequest[]>): Unsub {
  if (db) {
    return onSnapshot(query(collection(db, "requests"), orderBy("createdAt", "desc")), (snap) =>
      cb(snap.docs.map((d) => ({ ...(d.data() as BookingRequest), id: d.id }))),
    );
  }
  return lsSubscribe(LS.requests, () => lsGet<BookingRequest[]>(LS.requests, []), cb);
}

export async function updateRequest(id: string, patch: Partial<BookingRequest>) {
  if (db) return updateDoc(doc(db, "requests", id), patch);
  const list = lsGet<BookingRequest[]>(LS.requests, []);
  lsSet(LS.requests, list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

export async function deleteRequest(id: string) {
  if (db) return deleteDoc(doc(db, "requests", id));
  const list = lsGet<BookingRequest[]>(LS.requests, []);
  lsSet(LS.requests, list.filter((r) => r.id !== id));
}

/* -------------------------------------------------------------------------- */
/*  Login do painel                                                           */
/* -------------------------------------------------------------------------- */

export function onAdminChange(cb: Listener<boolean>): Unsub {
  if (auth) return onAuthStateChanged(auth, (u) => cb(Boolean(u)));
  const read = () => {
    try {
      return sessionStorage.getItem(LS.session) === "1";
    } catch {
      return false;
    }
  };
  cb(read());
  localBus.addEventListener(LS.session, () => cb(read()));
  return () => {};
}

export async function adminLogin(email: string, password: string) {
  if (auth) {
    await signInWithEmailAndPassword(auth, email.trim(), password);
    return;
  }
  if (password !== lsGet<string>(LS.password, LOCAL_DEFAULT_PASSWORD)) throw new Error("Senha incorreta");
  sessionStorage.setItem(LS.session, "1");
  localBus.dispatchEvent(new Event(LS.session));
}

export async function adminLogout() {
  if (auth) return signOut(auth);
  sessionStorage.removeItem(LS.session);
  localBus.dispatchEvent(new Event(LS.session));
}

export async function changeAdminPassword(newPassword: string) {
  if (auth) {
    if (!auth.currentUser) throw new Error("Faça login novamente");
    await updatePassword(auth.currentUser, newPassword);
    return;
  }
  lsSet(LS.password, newPassword);
}

/* -------------------------------------------------------------------------- */
/*  Upload de imagens e vídeos                                                */
/* -------------------------------------------------------------------------- */

/** Reduz a foto para no máximo `max` px e devolve um JPEG em data URL. */
export async function compressImage(file: File, max = 1600, maxBytes = 850_000): Promise<string> {
  const bitmap = await createImageBitmap(file);
  let scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  let quality = 0.82;
  for (let i = 0; i < 8; i++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length < maxBytes) return url;
    quality = Math.max(0.5, quality - 0.08);
    scale *= 0.85;
  }
  throw new Error("Imagem muito grande");
}

/**
 * Envia uma foto e devolve o endereço para usar no site.
 * Com Firebase: tenta o Storage; se o projeto não tiver Storage ativo
 * (plano gratuito), guarda a foto comprimida no Firestore ("media:<id>").
 * Sem Firebase: guarda comprimida no próprio navegador.
 */
export async function uploadImage(file: File): Promise<string> {
  if (app && db) {
    try {
      const blob = await (await fetch(await compressImage(file, 2000, 3_000_000))).blob();
      const r = ref(getStorage(app), `uploads/${Date.now()}-${uid()}.jpg`);
      await uploadBytes(r, blob, { contentType: "image/jpeg" });
      return await getDownloadURL(r);
    } catch {
      const data = await compressImage(file);
      const id = uid();
      await setDoc(doc(db, "media", id), { data, createdAt: Date.now() });
      return `media:${id}`;
    }
  }
  return compressImage(file, 1400, 450_000);
}

export async function uploadVideo(file: File): Promise<string> {
  if (!app) throw new Error("Envio de vídeo exige o Firebase configurado. Use um link do YouTube ou Vimeo.");
  try {
    const r = ref(getStorage(app), `videos/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`);
    await uploadBytes(r, file, { contentType: file.type });
    return await getDownloadURL(r);
  } catch {
    throw new Error("Não foi possível enviar o vídeo (o Storage do Firebase está ativo?). Use um link do YouTube ou Vimeo.");
  }
}

const mediaCache = new Map<string, Promise<string>>();

/** Resolve "media:<id>" para a imagem guardada no Firestore. */
export function resolveMedia(src: string): Promise<string> {
  if (!src.startsWith("media:") || !db) return Promise.resolve(src);
  const id = src.slice(6);
  if (!mediaCache.has(id)) {
    mediaCache.set(
      id,
      getDoc(doc(db, "media", id)).then((s) => (s.exists() ? (s.data().data as string) : "")),
    );
  }
  return mediaCache.get(id)!;
}

/* -------------------------------------------------------------------------- */
/*  Backup                                                                    */
/* -------------------------------------------------------------------------- */

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
