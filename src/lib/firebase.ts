// src/lib/firebase.ts

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // ❗ Adicione o getFirestore

const firebaseConfig = {
  apiKey: "AIzaSyBHFDpA0WlVOYga1eVoBsd90P_l8Pdnzzg",
  authDomain: "painel-gavea.firebaseapp.com",
  projectId: "painel-gavea",
  storageBucket: "painel-gavea.firebasestorage.app",
  messagingSenderId: "148762250666",
  appId: "1:148762250666:web:f59f0fa8ce0c17a543efd3",
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta os serviços
export const auth = getAuth(app);
export const db = getFirestore(app); // ❗ Exporta o Firestore (db)
